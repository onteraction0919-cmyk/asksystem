// server.js
// Express + Socket.IO (CommonJS) — Render/로컬 모두 호환

const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  // 로컬+렌더 공용 접속
  cors: { origin: '*', methods: ['GET','POST'] }
});

// ---- 정적 파일 (로고, CSS 등) ----
app.use('/static', express.static(path.join(__dirname, 'static')));

// ---- 페이지 라우트 ----
app.get('/', (_req, res) => res.redirect('/ask'));
app.get('/ask', (_req, res) => res.sendFile(path.join(__dirname, 'ask.html')));
app.get('/mod', (_req, res) => res.sendFile(path.join(__dirname, 'mod.html')));
app.get('/spotlight', (_req, res) => res.sendFile(path.join(__dirname, 'spotlight.html')));
app.get('/spotlight/active', (_req, res) => res.redirect('/spotlight'));

// 헬스체크(옵션)
app.get('/health', (_req, res) => res.status(200).send('OK'));

// ---- 메모리 상태 ----
let questions = [];           // { id, text, ts, status: 'new'|'selected'|'deferred' }
let currentSpotlight = null;  // { id, text, ts } | null
let seq = 1;

// ---- 소켓 처리 ----
io.on('connection', (socket) => {
  // 초기 동기화
  socket.on('init:please', () => {
    socket.emit('init:data', { questions, currentSpotlight });
  });

  // 질문 등록
  socket.on('ask:submit', (text) => {
    const clean = (text || '').trim();
    if (!clean) return;
    const q = { id: seq++, text: clean, ts: Date.now(), status: 'new' };
    questions.unshift(q);
    io.emit('mod:list:update', questions);
  });

  // 사회자: 상태 업데이트
  socket.on('mod:updateStatus', ({ id, status }) => {
    const q = questions.find(v => v.id === id);
    if (!q) return;
    if (['new', 'selected', 'deferred'].includes(status)) q.status = status;
    io.emit('mod:list:update', questions);
  });

  // 사회자: 방송 설정/해제
  socket.on('spotlight:set', ({ id }) => {
    const q = questions.find(v => v.id === id);
    if (!q) return;
    currentSpotlight = { id: q.id, text: q.text, ts: q.ts };
    io.emit('spotlight:update', currentSpotlight);
  });

  socket.on('spotlight:clear', () => {
    currentSpotlight = null;
    io.emit('spotlight:update', null);
  });
});

// ---- 서버 기동 ----
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`ASK SYSTEM 서버 시작 : 포트 ${PORT}`);
});
