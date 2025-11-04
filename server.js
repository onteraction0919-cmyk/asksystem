// server.js
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  // 프록시/공용망에서도 잘 붙도록 기본 옵션
  transports: ['websocket', 'polling'],
  pingTimeout: 30000,
  pingInterval: 25000
});

// -------------------------------
// In-memory 저장소 (간단 버전)
// -------------------------------
let questions = [];     // { id, text, createdAt }
let spotlightId = null; // 현재 방송중인 질문 id

// 헬스체크
app.get('/health', (_req, res) => res.type('text').send('OK'));

// 정적(로고 등)
app.use('/static', express.static(path.join(__dirname, 'static')));

// 페이지 라우팅
app.get('/', (_req, res) => res.redirect('/ask'));
app.get('/ask', (_req, res) =>
  res.sendFile(path.join(__dirname, 'ask.html'))
);
app.get('/mod', (_req, res) =>
  res.sendFile(path.join(__dirname, 'mod.html'))
);
app.get('/spotlight', (_req, res) =>
  res.sendFile(path.join(__dirname, 'spotlight.html'))
);

// -------------------------------
// Socket.IO
// -------------------------------
io.on('connection', (socket) => {
  // 연결된 클라이언트(주로 사회자)에게 현재 상태 전달
  socket.emit('questions:update', { list: questions });

  // 질문 추가
  socket.on('question:add', (payload) => {
    const text = (payload?.text ?? '').trim();
    if (!text) return;

    const q = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      text,
      createdAt: Date.now()
    };
    questions.unshift(q); // 최신이 앞으로
    io.emit('questions:update', { list: questions });
  });

  // 질문 제거
  socket.on('question:remove', (id) => {
    questions = questions.filter(q => q.id !== id);
    if (spotlightId === id) spotlightId = null;
    io.emit('questions:update', { list: questions });
    io.emit('spotlight:update', spotlightId ? questions.find(q => q.id === spotlightId) : null);
  });

  // 전체 삭제
  socket.on('questions:clear', () => {
    questions = [];
    spotlightId = null;
    io.emit('questions:update', { list: questions });
    io.emit('spotlight:update', null);
  });

  // 방송 표출 설정
  socket.on('spotlight:set', (id) => {
    spotlightId = id || null;
    const obj = spotlightId ? questions.find(q => q.id === spotlightId) : null;
    io.emit('spotlight:update', obj || null);
  });
});

// Render/일반 서버 포트
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`ASK SYSTEM ON : http://localhost:${PORT}`);
});
