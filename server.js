// server.js
// 단일 파일로 돌아가는 간단 Q&A 서버
// - 질문 등록/목록/삭제
// - 방송 표시(Active 질문 지정)
// - 정적 파일 /static 제공
// - HTML: / , /mod, /spotlight

const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const app = express();

const PORT = process.env.PORT || 3000;

// 메모리 저장소 (간단 버전)
let questions = []; // { id, text, createdAt }
let activeId = null; // 방송에 내보내는 질문 id

app.use(bodyParser.json({ limit: "1mb" }));
app.use("/static", express.static(path.join(__dirname, "static")));

// ====== HTML 라우트 ======
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "ask.html"));
});
app.get("/mod", (req, res) => {
  res.sendFile(path.join(__dirname, "mod.html"));
});
app.get("/spotlight", (req, res) => {
  res.sendFile(path.join(__dirname, "spotlight.html"));
});

// ====== API ======

// 질문 등록
app.post("/api/questions", (req, res) => {
  const text = (req.body?.text || "").trim();
  if (!text) return res.status(400).json({ ok: false, message: "텍스트 없음" });

  const q = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    text,
    createdAt: Date.now(),
  };
  questions.unshift(q);
  return res.json({ ok: true, item: q });
});

// 질문 목록
app.get("/api/questions", (req, res) => {
  res.json({ ok: true, items: questions });
});

// 질문 삭제
app.delete("/api/questions/:id", (req, res) => {
  const id = req.params.id;
  questions = questions.filter((q) => q.id !== id);
  if (activeId === id) activeId = null;
  res.json({ ok: true });
});

// 전체 삭제
app.delete("/api/questions", (req, res) => {
  questions = [];
  activeId = null;
  res.json({ ok: true });
});

// 방송 표시(Active 설정)
app.post("/api/active/:id", (req, res) => {
  const id = req.params.id;
  const exists = questions.find((q) => q.id === id);
  if (!exists) return res.status(404).json({ ok: false, message: "존재하지 않음" });
  activeId = id;
  res.json({ ok: true, activeId });
});

// 현재 방송중 질문
app.get("/api/active", (req, res) => {
  const active = questions.find((q) => q.id === activeId) || null;
  res.json({
    ok: true,
    active: active
      ? { id: active.id, text: active.text, updatedAt: Date.now() }
      : null,
  });
});

// 헬스체크(배포용)
app.get("/healthz", (req, res) => res.send("ok"));

app.listen(PORT, () => {
  console.log(`ASK SYSTEM ON : http://localhost:${PORT}`);
});
