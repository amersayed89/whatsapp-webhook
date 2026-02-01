import express from "express";

const app = express();
app.use(express.json());

// ================== إعدادات ==================
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ULTRAMSG_TOKEN = process.env.ULTRAMSG_TOKEN;
const ULTRAMSG_INSTANCE = process.env.ULTRAMSG_INSTANCE;

const ULTRAMSG_BASE = `https://api.ultramsg.com/${ULTRAMSG_INSTANCE}`;

// ================== إرسال واتساب ==================
async function sendWhatsAppMessage(to, body) {
  const url = `${ULTRAMSG_BASE}/messages/chat?token=${ULTRAMSG_TOKEN}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to,
      body,
    }),
  });

  return res.json();
}

// ================== رد OpenAI ==================
async function askOpenAI(userText) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "انت مساعد واتساب لبناني، ردودك قصيرة، ودودة، وباللهجة اللبنانية.",
        },
        { role: "user", content: userText },
      ],
    }),
  });

  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "ما فهمت عليك، فيك تعيد؟";
}

// ================== Webhook ==================
app.post("/", async (req, res) => {
  try {
    const data = req.body?.data;

    // 🔐 حماية من الكراش (مهم جدًا)
    if (!data || !data.messages || data.messages.length === 0) {
      return res.sendStatus(200);
    }

    const message = data.messages[0];
    const from = message.from;
    const text = message.body || "";

    console.log("📩 Message from:", from);
    console.log("📝 Text:", text);

    // سؤال الذكاء الاصطناعي
    const aiReply = await askOpenAI(text);

    // إرسال الرد
    await sendWhatsAppMessage(from, aiReply);

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ Webhook error:", err);
    res.sendStatus(500);
  }
});

// ================== Health Check ==================
app.get("/", (req, res) => {
  res.send("Webhook is running 🚀");
});

// ================== تشغيل السيرفر ==================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
