import express from "express";

const app = express();
app.use(express.json());

// ================== ENV ==================
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ULTRAMSG_TOKEN = process.env.ULTRAMSG_TOKEN;
const ULTRAMSG_INSTANCE = process.env.ULTRAMSG_INSTANCE;

const ULTRAMSG_BASE = `https://api.ultramsg.com/${ULTRAMSG_INSTANCE}`;

// ================== SEND WHATSAPP ==================
async function sendWhatsAppMessage(to, body) {
  const url = `${ULTRAMSG_BASE}/messages/chat?token=${ULTRAMSG_TOKEN}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to, body }),
  });

  return res.json();
}

// ================== OPENAI ==================
async function askOpenAI(userText) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.9,
      messages: [
        {
          role: "system",
          content:
            "أنت مساعد دعم إنترنت محترف في لبنان. جاوب بشكل طبيعي وذكي بدون جمل جاهزة أو تكرار.",
        },
        {
          role: "user",
          content: userText,
        },
      ],
    }),
  });

  const data = await res.json();

  if (!data.choices || !data.choices[0]) {
    console.error("OPENAI ERROR:", data);
    return "";
  }

  return data.choices[0].message.content;
}

// ================== WEBHOOK ==================
app.post("/whatsapp", async (req, res) => {
  try {
    console.log("=== WEBHOOK HIT ===");

    const msg = req.body?.data;
    if (!msg) return res.sendStatus(200);

    // تجاهل رسائل البوت نفسه
    if (msg.fromMe === true) return res.sendStatus(200);

    // فقط نص
    if (msg.type !== "chat") return res.sendStatus(200);

    const text = (msg.body || "").trim();
    if (!text) return res.sendStatus(200);

    console.log("FROM:", msg.from);
    console.log("TEXT:", text);

    const aiReply = await askOpenAI(text);

    // إذا الذكاء ما رد → لا تبعت شي
    if (!aiReply) return res.sendStatus(200);

    await sendWhatsAppMessage(msg.from, aiReply);

    console.log("AI REPLY SENT");

    res.sendStatus(200);
  } catch (err) {
    console.error("WEBHOOK ERROR:", err);
    res.sendStatus(200);
  }
});

// ================== HEALTH ==================
app.get("/", (req, res) => {
  res.send("OK");
});

// ================== START ==================
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
