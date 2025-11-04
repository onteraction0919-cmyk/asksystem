// -----------------------------
// ASK SYSTEM SERVER
// -----------------------------
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import bodyParser from "body-parser";

const app = express();
const PORT = process.env.PORT || 10000;

// 현재 디렉토리 경로 계산
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -----------------------------
// 미들웨어 설정
// -----------------------------
app.use(bodyParser.json());
app.use("/static", express.static(path.join(__dirname, "static"))); // 정적 파일 제공
app.use(express.urlencoded({ extended: true }));

// -----------------------------
// 메모리 데이터 저장소
// -----------------------------
let questions = [];     // { id, text, ts, selected }
let spotlight = null;   // 현재 방송 중 질문 ID

// -----------------------------
// HTML 라우트
// -----------------------------
app.get("/", (req, res) => {
  res.redirect("/ask");
});

app.get("/ask", (req, res) => {
  res.sendFile(path.join(__dirname, "ask.html"));
});

app.get("/mod", (req, res) => {
  res.sendFile(path.join(__dirname, "mod.html"));
});

app.get("/spotlight/active", (req, res) => {
  res.sendFile(path.join(__dirname, "spotlight.html"));
});

// -----------------------------
// API 라우트
// -----------------------------

// 질문 등록
app.post("/api/questions", (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: "내용이 비어 있습니다." });
  }
  const q = {
    id: Date.now().toString(),
    text: text.trim(),
    ts: Date.now(),
    selected: false,
  };
  questions.push(q);
  console.log(`[NEW] ${q.text}`);
  res.json({ ok: true, q });
});

// 질문 전체 목록 (사회자 화면용)
app.get("/api/questions", (req, res) => {
  res.json(questions);
});

// 방송 중인 질문 변경
app.post("/spotlight/active", (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: "ID 누락" });

  const found = questions.find((q) => q.id === id);
  if (!found) return res.status(404).json({ error: "해당 질문 없음" });

  questions = questions.map((q) => ({
    ...q,
    selected: q.id === id, // 선택한 것만 true
  }));
  spotlight = found;
  console.log(`[SPOTLIGHT] ${found.text}`);
  res.json({ ok: true, spotlight });
});

// 현재 방송 중 질문 가져오기
app.get("/api/spotlight", (req, res) => {
  res.json(spotlight || {});
});

// -----------------------------
// 서버 시작
// -----------------------------
app.listen(PORT, () => {
  console.log(`✅ ASK SYSTEM 서버 실행 중: 포트 ${PORT}`);
  console.log(`➡  http://localhost:${PORT}/ask`);
});
