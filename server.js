// server.js
const path = require("path");
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 정적 파일
const ROOT = __dirname;
app.use("/static", express.static(path.join(ROOT, "static")));

// 간단 메모리 저장소 (프로덕션에서는 DB 권장)
let seq = 1;
let questions = [];      // {id, text, createdAt}
let activeId = null;

// 라우팅: 페이지
app.get("/", (_, res) => res.redirect("/ask"));
app.get("/ask", (_, res) => res.sendFile(path.join(ROOT, "ask.html")));
app.get("/mod", (_, res) => res.sendFile(path.join(ROOT, "mod.html")));
app.get("/spotlight/active", (_, res) => res.sendFile(path.join(ROOT, "spotlight.html")));

// 라우팅: API
app.get("/api/questions", (_, res) => {
  res.json({ ok: true, items: questions });
});

app.post("/api/ask", (req, res) => {
  const text = (req.body?.text || "").trim();
  if (!text) return res.status(400).json({ ok: false, message: "text required" });

  const q = { id: seq++, text, createdAt: Date.now() };
  questions.unshift(q);        // 최신이 위로 오도록
  io.emit("new_question", q);  // 실시간 목록 반영
  res.json({ ok: true, item: q });
});

app.post("/api/spotlight", (req, res) => {
  const id = Number(req.body?.id);
  const q = questions.find((x) => x.id === id);
  if (!q) return res.status(404).json({ ok: false, message: "not found" });
  activeId = id;
  io.emit("spotlight", q);    // 방송 화면에 반영
  res.json({ ok: true, item: q });
});

app.get("/api/active", (_, res) => {
  const q = questions.find((x) => x.id === activeId) || null;
  res.json({ ok: true, item: q });
});

// 소켓 연결 로그(선택)
io.on("connection", (socket) => {
  // console.log("socket connected:", socket.id);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("LiveQ running on port", PORT);
});
