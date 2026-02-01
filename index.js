import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// ========= ENV =========
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ULTRAMSG_TOKEN = process.env.ULTRAMSG_TOKEN;
const ULTRAMSG_INSTANCE = process.env.ULTRAMSG_INSTANCE;

const ULTRAMSG_BASE = `https://api.ultramsg.com/${ULTRAMSG_INSTANCE}`;

// ========= SEND WHATSAPP =========
async function sendWhatsAppMessage(to, body) {
  const url = `${ULTRAMSG_BASE}/messages/chat?token=${ULTRAMSG_TOKEN}`;

  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to, body }),
  });
}

// ========= OPENAI =========
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
          content: `
أنت خبير دعم فني إنترنت في لبنان.
جاوب باللهجة اللبنانية.
جاوب مباشرة بدون أسئلة إضافية.
اعطِ حل أو تفسير واضح.
          `,
        },
        {
          role: "user",
          content: userText,
        },
      ],
    }),
  });

  const data = await res.json();
  return data.choices[0].message.content;
}

// ========= WEBHOOK =========
app.post("/whatsapp", async (req, res) => {
  try {
    const msg = req.body?.data;
    if (!msg) return res.sendStatus(200);

    // ❌ تجاهل أي رسالة جاية من البوت نفسه
    if (msg.fromMe === true) {
      return res.sendStatus(200);
    }

    // ❌ فقط نص
    if (msg.type !== "chat") {
      return res.sendStatus(200);
    }

    const text = (msg.body || "").trim();
    if (!text) return res.sendStatus(200);

    console.log("USER TEXT:", text);

    // ✅ الذكاء فقط
    const aiReply = await askOpenAI(text);

    await sendWhatsAppMessage(msg.from, aiReply);

    res.sendStatus(200);
  } catch (err) {
    console.error("ERROR:", err);
    res.sendStatus(500);
  }
});

// ========= HEALTH =========
app.get("/", (req, res) => {
  res.send("AI WhatsApp Bot Running");
});

// ========= START =========
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
