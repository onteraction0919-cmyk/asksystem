import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import compression from 'compression';
import cors from 'cors';
import dayjs from 'dayjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: "*" }
});

app.use(cors());
app.use(compression());
app.use(express.json());
app.use('/static', express.static(path.join(__dirname, 'static')));

// 인메모리 저장소 (서버 재시작 시 초기화됨)
let questions = []; // {id, text, ts}
let activeId = null;

// 페이지 라우트
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'static/ask.html')));
app.get('/mod', (req, res) => res.sendFile(path.join(__dirname, 'static/mod.html')));
app.get('/spotlight', (req, res) => res.sendFile(path.join(__dirname, 'static/spotlight.html')));

// REST API (백업용/직접호출용)
app.get('/api/questions', (req, res) => res.json({ ok: true, questions }));
app.get('/api/active', (req, res) => {
  const active = questions.find(q => q.id === activeId) || null;
  res.json({ ok: true, active });
});

app.post('/api/questions', (req, res) => {
  const text = (req.body?.text || '').trim();
  if (!text) return res.status(400).json({ ok: false, msg: 'empty text' });
  const q = {
    id: String(Date.now()),
    text,
    ts: dayjs().format('YYYY.MM.DD HH:mm:ss')
  };
  questions.unshift(q); // 최근 것이 위로
  io.emit('questions:update', questions);
  return res.json({ ok: true, q });
});

app.delete('/api/questions/:id', (req, res) => {
  const { id } = req.params;
  questions = questions.filter(q => q.id !== id);
  if (activeId === id) activeId = null;
  io.emit('questions:update', questions);
  io.emit('spotlight:update', { activeId, active: getActive() });
  return res.json({ ok: true });
});

app.post('/api/spotlight', (req, res) => {
  const { id } = req.body || {};
  if (id === null) {
    activeId = null;
  } else {
    const exists = questions.some(q => q.id === id);
    if (!exists) return res.status(404).json({ ok: false, msg: 'not found' });
    activeId = id;
  }
  const active = getActive();
  io.emit('spotlight:update', { activeId, active });
  return res.json({ ok: true, activeId, active });
});

app.delete('/api/questions', (req, res) => {
  questions = [];
  activeId = null;
  io.emit('questions:update', questions);
  io.emit('spotlight:update', { activeId, active: null });
  return res.json({ ok: true });
});

function getActive() {
  return questions.find(q => q.id === activeId) || null;
}

// 소켓 이벤트
io.on('connection', (socket) => {
  // 초기 상태 전송
  socket.emit('init', {
    questions,
    activeId,
    active: getActive()
  });

  // 질문 추가
  socket.on('question:add', (text) => {
    const clean = String(text || '').trim();
    if (!clean) return;
    const q = {
      id: String(Date.now()),
      text: clean,
      ts: dayjs().format('YYYY.MM.DD HH:mm:ss')
    };
    questions.unshift(q);
    io.emit('questions:update', questions);
  });

  // 질문 삭제(사회자/사용자 공통)
  socket.on('question:delete', (id) => {
    questions = questions.filter(q => q.id !== id);
    if (activeId === id) activeId = null;
    io.emit('questions:update', questions);
    io.emit('spotlight:update', { activeId, active: getActive() });
  });

  // 방송 선택/해제
  socket.on('spotlight:set', (id) => {
    if (id === null) {
      activeId = null;
    } else if (questions.some(q => q.id === id)) {
      activeId = id;
    }
    io.emit('spotlight:update', { activeId, active: getActive() });
  });

  // 전체 삭제
  socket.on('questions:clear', () => {
    questions = [];
    activeId = null;
    io.emit('questions:update', questions);
    io.emit('spotlight:update', { activeId, active: null });
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`ASK SYSTEM ON : http://localhost:${PORT}`);
});
