// server.js (CommonJS)
const path = require('path');
const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());

// 정적 파일 (로고 등)
app.use('/static', express.static(path.join(__dirname, 'static')));

// 메모리 저장소
let questions = [];        // { id, text, ts }
let spotlightId = null;    // 현재 방송 중인 질문 id (없으면 null)

// 유틸
const nowTS = () => new Date().toISOString();
const byNewest = (a, b) => (a.ts < b.ts ? 1 : -1);
const sendAll = (data) => {
  const msg = JSON.stringify(data);
  wss.clients.forEach((c) => {
    if (c.readyState === WebSocket.OPEN) c.send(msg);
  });
};

// 라우팅 (화면)
app.get('/', (_, res) => res.redirect('/ask'));
app.get('/ask', (req, res) =>
  res.sendFile(path.join(__dirname, 'ask.html'))
);
app.get('/mod', (req, res) =>
  res.sendFile(path.join(__dirname, 'mod.html'))
);
app.get('/spotlight', (req, res) =>
  res.sendFile(path.join(__dirname, 'spotlight.html'))
);

// API
app.get('/api/questions', (req, res) => {
  res.json({ items: [...questions].sort(byNewest) });
});

app.post('/api/questions', (req, res) => {
  const text = (req.body?.text || '').trim();
  if (!text) return res.status(400).json({ ok: false, error: 'empty' });

  const item = { id: String(Date.now()), text, ts: nowTS() };
  questions.push(item);
  res.json({ ok: true, item });
});

app.delete('/api/questions', (req, res) => {
  questions = [];
  spotlightId = null;
  sendAll({ type: 'spotlight', item: null });
  res.json({ ok: true });
});

app.post('/api/questions/:id/spotlight', (req, res) => {
  const { id } = req.params;
  const item = questions.find((q) => q.id === id);
  spotlightId = item ? id : null;
  sendAll({ type: 'spotlight', item: item || null });
  res.json({ ok: true, item: item || null });
});

app.delete('/api/spotlight', (req, res) => {
  spotlightId = null;
  sendAll({ type: 'spotlight', item: null });
  res.json({ ok: true });
});

// WebSocket: 접속 시 현재 방송 상태 1회 전달
wss.on('connection', (ws) => {
  const item = questions.find((q) => q.id === spotlightId) || null;
  ws.send(JSON.stringify({ type: 'spotlight', item }));
});

// 서버 시작
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('ASK SYSTEM ON :: http://localhost:' + PORT);
});
