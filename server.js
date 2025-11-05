// server.js
const express = require("express");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 10000;

// ---------------- 기본 설정 ----------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/static", express.static(path.join(__dirname, "static")));

// ---------------- 메모리 데이터 ----------------
let questions = [];
let activeId = null;
let sseClients = new Set();

// ---------------- SSE ----------------
app.get("/sse", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders?.();

  const client = { res };
  sseClients.add(client);

  send(client.res, "init", { questions, activeId });
  req.on("close", () => sseClients.delete(client));
});

function send(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}
function broadcast(event, data) {
  for (const c of sseClients) send(c.res, event, data);
}

// ---------------- API ----------------
app.get("/api/questions", (_, res) => res.json(questions));

app.post("/api/questions", (req, res) => {
  const text = (req.body.text || "").trim();
  if (!text) return res.status(400).json({ error: "text required" });

  const q = { id: Date.now().toString(36), text, createdAt: Date.now() };
  questions.unshift(q);
  broadcast("questions", questions);
  res.json(q);
});

app.delete("/api/questions/:id", (req, res) => {
  const { id } = req.params;
  questions = questions.filter((q) => q.id !== id);
  if (activeId === id) activeId = null;
  broadcast("questions", questions);
  broadcast("spotlight", { activeId });
  res.json({ ok: true });
});

app.delete("/api/questions", (_, res) => {
  questions = [];
  activeId = null;
  broadcast("questions", questions);
  broadcast("spotlight", { activeId });
  res.json({ ok: true });
});

app.post("/api/spotlight/:id", (req, res) => {
  const { id } = req.params;
  activeId = id;
  broadcast("spotlight", { activeId });
  res.json({ activeId });
});

app.get("/api/spotlight", (_, res) => res.json({ activeId }));

// ---------------- 페이지 ----------------
app.get("/", (_, res) => res.redirect("/ask"));
app.get("/ask", (_, res) => res.sendFile(path.join(__dirname, "static", "ask.html")));
app.get("/mod", (_, res) => res.sendFile(path.join(__dirname, "static", "mod.html")));
app.get("/spotlight", (_, res) => res.sendFile(path.join(__dirname, "static", "spotlight.html")));

// ---------------- 시작 ----------------
app.listen(PORT, () => console.log(`ASK SYSTEM ON : http://localhost:${PORT}`));
