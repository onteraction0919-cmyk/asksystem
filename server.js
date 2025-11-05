// server.js  — 전체 교체본
// ------------------------------------------------------------
// 요구사항:
// - 정적 파일: /static/*  (ask.html, mod.html, spotlight.html, 로고 등)
// - 페이지 라우트: /ask, /mod, /spotlight
// - API: 질문 추가/목록/삭제, 스포트라이트(방송) 지정/해제
// - 실시간: Socket.IO로 질문 목록/방송 변경 즉시 반영
// - Render/일반 Node 모두 지원 (PORT 환경변수)
// ------------------------------------------------------------

const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  // 필요 시 CORS 허용 (동일 도메인이면 없어도 됨)
  cors: { origin: '*', methods: ['GET', 'POST', 'DELETE'] },
});

// 기본 설정
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use('/static', express.static(path.join(__dirname, 'static'), {
  etag: true,
  lastModified: true,
  maxAge: '1h',
}));

// 간단한 메모리 저장소 (서버 재시작 시 초기화됨)
let questions = [];  // { id, text, createdAt }
let spotlightId = null;

// 유틸: 고유 ID
function makeId() {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).substring(2, 8)
  ).toUpperCase();
}

// 정렬용
function sortByTimeAsc(a, b) {
  return a.createdAt - b.createdAt;
}

// 현재 스포트라이트 질문 객체 반환
function currentSpotlight() {
  return questions.find(q => q.id === spotlightId) || null;
}

// --------------------------
// 라우트 (페이지)
// --------------------------
app.get('/', (req, res) => res.redirect('/ask'));

app.get('/ask', (req, res) => {
  res.sendFile(path.join(__dirname, 'static', 'ask.html'));
});

app.get('/mod', (req, res) => {
  res.sendFile(path.join(__dirname, 'static', 'mod.html'));
});

app.get('/spotlight', (req, res) => {
  res.sendFile(path.join(__dirname, 'static', 'spotlight.html'));
});

// 헬스체크
app.get('/health', (req, res) => res.status(200).json({ ok: true }));

// --------------------------
// API (질문/방송)
// --------------------------

// 질문 목록
app.get('/api/questions', (req, res) => {
  const list = [...questions].sort(sortByTimeAsc);
  res.json({ ok: true, data: list });
});

// 질문 추가
app.post('/api/questions', (req, res) => {
  const text = (req.body?.text || '').trim();
  if (!text) {
    return res.status(400).json({ ok: false, message: '빈 질문은 등록할 수 없습니다.' });
  }
  // 길이 제한 (안전)
  if (text.length > 2000) {
    return res.status(413).json({ ok: false, message: '질문이 너무 깁니다 (최대 2000자).' });
  }

  const q = {
    id: makeId(),
    text,
    createdAt: Date.now(),
  };
  questions.push(q);

  // 전체 클라이언트에 업데이트 브로드캐스트
  io.emit('questions:update', [...questions].sort(sortByTimeAsc));

  return res.json({ ok: true, data: q });
});

// 질문 삭제
app.delete('/api/questions/:id', (req, res) => {
  const { id } = req.params;
  const before = questions.length;
  questions = questions.filter(q => q.id !== id);
  const removed = before !== questions.length;

  if (!removed) {
    return res.status(404).json({ ok: false, message: '해당 ID의 질문이 없습니다.' });
  }

  // 스포트라이트가 지워진 경우 해제
  if (spotlightId === id) {
    spotlightId = null;
    io.emit('spotlight:update', null);
  }

  io.emit('questions:update', [...questions].sort(sortByTimeAsc));
  return res.json({ ok: true });
});

// 현재 스포트라이트 조회
app.get('/api/spotlight', (req, res) => {
  res.json({ ok: true, data: currentSpotlight() });
});

// 스포트라이트 지정
app.post('/api/spotlight', (req, res) => {
  const { id } = req.body || {};
  if (!id) {
    return res.status(400).json({ ok: false, message: 'id가 필요합니다.' });
  }
  const exists = questions.find(q => q.id === id);
  if (!exists) {
    return res.status(404).json({ ok: false, message: '해당 ID의 질문이 없습니다.' });
  }
  spotlightId = id;

  const spotlight = currentSpotlight();
  io.emit('spotlight:update', spotlight);
  return res.json({ ok: true, data: spotlight });
});

// 스포트라이트 해제
app.post('/api/spotlight/clear', (req, res) => {
  spotlightId = null;
  io.emit('spotlight:update', null);
  return res.json({ ok: true });
});

// --------------------------
// Socket.IO
// --------------------------
io.on('connection', (socket) => {
  // 접속 시 즉시 현재 상태 전송
  socket.emit('questions:update', [...questions].sort(sortByTimeAsc));
  socket.emit('spotlight:update', currentSpotlight());

  // (선택) 클라이언트에서 소켓으로도 추가/삭제/지정 이벤트를 쏠 수 있게 허용
  socket.on('question:add', (text) => {
    if (!text || typeof text !== 'string') return;
    const t = text.trim();
    if (!t) return;
    if (t.length > 2000) return;

    const q = { id: makeId(), text: t, createdAt: Date.now() };
    questions.push(q);
    io.emit('questions:update', [...questions].sort(sortByTimeAsc));
  });

  socket.on('question:delete', (id) => {
    const before = questions.length;
    questions = questions.filter(q => q.id !== id);
    if (before !== questions.length) {
      if (spotlightId === id) {
        spotlightId = null;
        io.emit('spotlight:update', null);
      }
      io.emit('questions:update', [...questions].sort(sortByTimeAsc));
    }
  });

  socket.on('spotlight:set', (id) => {
    const exists = questions.find(q => q.id === id);
    if (!exists) return;
    spotlightId = id;
    io.emit('spotlight:update', currentSpotlight());
  });

  socket.on('spotlight:clear', () => {
    spotlightId = null;
    io.emit('spotlight:update', null);
  });
});

// --------------------------
// 서버 시작
// --------------------------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`ASK SYSTEM running on http://localhost:${PORT}`);
  console.log(`- Ask page:        /ask`);
  console.log(`- Moderator page:  /mod`);
  console.log(`- Spotlight page:  /spotlight`);
});
