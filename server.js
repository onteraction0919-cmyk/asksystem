// server.js  — CommonJS 버전 (Render/일반 Node에서 바로 실행 가능)
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ===== 인메모리 상태 =====
let questions = [];          // [{ id, text, createdAt, selected }]
let currentSpotlight = null; // { id, text, createdAt } | null

// ===== 미들웨어 =====
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 정적 파일 (/static/logo.png 등)
app.use('/static', express.static(path.join(__dirname, 'static')));

// ===== 라우팅 =====
app.get('/', (_req, res) => {
  res.redirect('/mod'); // 필요시 변경
});

app.get('/ask', (_req, res) => {
  res.sendFile(path.join(__dirname, 'ask.html'));
});

app.get('/mod', (_req, res) => {
  res.sendFile(path.join(__dirname, 'mod.html'));
});

app.get('/spotlight', (_req, res) => {
  res.sendFile(path.join(__dirname, 'spotlight.html'));
});

// 헬스체크 (Render 등에서 유용)
app.get('/health', (_req, res) => res.status(200).send('OK'));

// ===== 소켓 =====
io.on('connection', (socket) => {
  // 초기 상태 싱크
  socket.emit('mod:list:update', questions);
  socket.emit('spotlight:update', currentSpotlight);

  // 질문 등록 (ask 페이지에서 전송)
  socket.on('ask:new', (payload) => {
    const text = (payload?.text || '').toString().trim();
    if (!text) return;
    const q = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      text,
      createdAt: Date.now(),
      selected: false,
    };
    questions.unshift(q); // 최신이 앞에 보이도록
    io.emit('mod:list:update', questions);
  });

  // 선택 토글(사회자 체크박스/버튼)
  socket.on('mod:select', ({ id, value }) => {
    const idx = questions.findIndex((q) => q.id === id);
    if (idx >= 0) {
      questions[idx].selected = !!value;
      io.emit('mod:list:update', questions);
    }
  });

  // 질문 삭제
  socket.on('mod:remove', (id) => {
    questions = questions.filter((q) => q.id !== id);
    if (currentSpotlight?.id === id) currentSpotlight = null;
    io.emit('mod:list:update', questions);
    io.emit('spotlight:update', currentSpotlight);
  });

  // 방송 표시(스포트라이트)
  socket.on('mod:spotlight', (id) => {
    const q = questions.find((x) => x.id === id) || null;
    currentSpotlight = q;
    io.emit('spotlight:update', currentSpotlight);
  });

  // 전체 초기화 (질문/스포트라이트 모두)
  socket.on('mod:clearAll', () => {
    questions = [];
    currentSpotlight = null;
    io.emit('mod:list:update', questions);
    io.emit('spotlight:update', currentSpotlight);
  });
});

// ===== 서버 기동 =====
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('ASK SYSTEM 서버가 시작되었습니다. 포트:', PORT);
});
