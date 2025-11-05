// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

app.use(express.json());

// 정적 제공
app.use("/static", express.static(path.join(__dirname, "static")));

// 라우팅 바로가기
app.get("/", (req, res) => res.redirect("/ask"));
app.get("/ask", (req, res) => res.sendFile(path.join(__dirname, "static", "ask.html")));
app.get("/mod", (req, res) => res.sendFile(path.join(__dirname, "static", "mod.html")));
app.get("/spotlight", (req, res) => res.sendFile(path.join(__dirname, "static", "spotlight.html")));

/* ---------- 인메모리 데이터 ---------- */
let seq = 1;
let questions = []; // { id, text, createdAt }
let activeId = null;

/* ---------- REST API ---------- */
// 질문 목록
app.get("/api/questions", (req, res) => {
  const list = [...questions].sort((a, b) => a.createdAt - b.createdAt);
  res.json(list);
});

// 질문 등록
app.post("/api/questions", (req, res) => {
  const text = (req.body?.text || "").trim();
  if (!text) return res.status(400).json({ ok: false, message: "내용이 비어있습니다." });

  const item = { id: seq++, text, createdAt: Date.now() };
  questions.push(item);

  io.emit("list:update", { type: "add", item });
  res.json({ ok: true, item });
});

// 질문 삭제
app.delete("/api/questions/:id", (req, res) => {
  const id = Number(req.params.id);
  const before = questions.length;
  questions = questions.filter((q) => q.id !== id);
  if (activeId === id) activeId = null;

  io.emit("list:update", { type: "remove", id });
  io.emit("spotlight:update", getActivePayload());
  res.json({ ok: true, removed: before !== questions.length });
});

// 질문 전체 삭제
app.delete("/api/questions", (req, res) => {
  questions = [];
  activeId = null;

  io.emit("list:update", { type: "clear" });
  io.emit("spotlight:update", getActivePayload());
  res.json({ ok: true });
});

// 방송 중인 질문 조회
app.get("/api/spotlight", (req, res) => res.json(getActivePayload()));

// 방송할 질문 선택
app.post("/api/spotlight", (req, res) => {
  const id = Number(req.body?.id);
  const target = questions.find((q) => q.id === id);
  activeId = target ? id : null;

  const payload = getActivePayload();
  io.emit("spotlight:update", payload);
  res.json({ ok: true, ...payload });
});

// 방송 중지
app.delete("/api/spotlight", (req, res) => {
  activeId = null;
  const payload = getActivePayload();
  io.emit("spotlight:update", payload);
  res.json({ ok: true, ...payload });
});

/* ---------- 소켓 ---------- */
io.on("connection", () => {
  // 필요 시 연결 이벤트 추적 가능
});

/* ---------- 유틸 ---------- */
function getActivePayload() {
  const active = questions.find((q) => q.id === activeId) || null;
  return { active };
}

/* ---------- 서버 시작 ---------- */
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`ASK SYSTEM ON : http://localhost:${PORT}`);
});
