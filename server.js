// server.js — 로고 제외, 최소 구성 리셋본
// 기능: 질문 등록/목록/삭제 + 사회자 방송 지정/해제 + 실시간 반영(Socket.IO)

const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET','POST','DELETE'] } });

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// 정적: /static/ask.html, /static/mod.html, /static/spotlight.html
app.use('/static', express.static(path.join(__dirname, 'static')));

// 메모리 저장소
let questions = [];      // { id, text, createdAt }
let spotlightId = null;  // 방송 중인 질문 id

const makeId = () =>
  (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)).toUpperCase();

const now = () => Date.now();
const byTimeAsc = (a, b) => a.createdAt - b.createdAt;
const currentSpotlight = () => questions.find(q => q.id === spotlightId) || null;

// 페이지 라우팅
app.get('/', (_, res) => res.redirect('/ask'));
app.get('/ask', (_, res) => res.sendFile(path.join(__dirname, 'static', 'ask.html')));
app.get('/mod', (_, res) => res.sendFile(path.join(__dirname, 'static', 'mod.html')));
app.get('/spotlight', (_, res) => res.sendFile(path.join(__dirname, 'static', 'spotlight.html')));

// API
app.get('/api/questions', (_, res) =>
  res.json({ ok: true, data: [...questions].sort(byTimeAsc) })
);

app.post('/api/questions', (req, res) => {
  const text = String(req.body?.text || '').trim();
  if (!text) return res.status(400).json({ ok: false, message: '빈 질문은 등록할 수 없습니다.' });
  if (text.length > 2000) return res.status(413).json({ ok: false, message: '질문이 너무 깁니다.' });

  const q = { id: makeId(), text, createdAt: now() };
  questions.push(q);
  io.emit('questions:update', [...questions].sort(byTimeAsc));
  res.json({ ok: true, data: q });
});

app.delete('/api/questions/:id', (req, res) => {
  const { id } = req.params;
  const before = questions.length;
  questions = questions.filter(q => q.id !== id);
  if (before === questions.length) return res.status(404).json({ ok: false, message: '없음' });

  if (spotlightId === id) {
    spotlightId = null;
    io.emit('spotlight:update', null);
  }
  io.emit('questions:update', [...questions].sort(byTimeAsc));
  res.json({ ok: true });
});

app.get('/api/spotlight', (_, res) => res.json({ ok: true, data: currentSpotlight() }));

app.post('/api/spotlight', (req, res) => {
  const { id } = req.body || {};
  const hit = questions.find(q => q.id === id);
  if (!hit) return res.status(404).json({ ok: false, message: '질문 없음' });
  spotlightId = id;
  const cur = currentSpotlight();
  io.emit('spotlight:update', cur);
  res.json({ ok: true, data: cur });
});

app.post('/api/spotlight/clear', (_, res) => {
  spotlightId = null;
  io.emit('spotlight:update', null);
  res.json({ ok: true });
});

// Socket.IO
io.on('connection', socket => {
  socket.emit('questions:update', [...questions].sort(byTimeAsc));
  socket.emit('spotlight:update', currentSpotlight());
});

// 서버 시작
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`ASK SYSTEM on http://localhost:${PORT}`);
  console.log('- 질문 입력:      /ask');
  console.log('- 사회자 화면:    /mod');
  console.log('- 방송 출력:      /spotlight');
});
