import express from "express";

const app = express();
app.use(express.json());

// ================== ENV ==================
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ULTRAMSG_TOKEN = process.env.ULTRAMSG_TOKEN;
const ULTRAMSG_INSTANCE = process.env.ULTRAMSG_INSTANCE;

const ULTRAMSG_BASE = `https://api.ultramsg.com/${ULTRAMSG_INSTANCE}`;

// ================== WhatsApp Send ==================
async function sendWhatsAppMessage(to, body) {
  const url = `${ULTRAMSG_BASE}/messages/chat?token=${ULTRAMSG_TOKEN}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to, body }),
  });
  return res.json();
}

// ================== OpenAI ==================
async function askOpenAI(prompt) {
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
            "انت مساعد واتساب لبناني، ردودك قصيرة، مهذبة، وباللهجة اللبنانية.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "فيك تعيد سؤالك لو سمحت؟";
}

// ================== (اختياري) جلب المشترك ==================
// بدّل هالدالة لتربطها بقاعدة بياناتك/API تبعك
async function getSubscriberByPhone(phone) {
  // مثال افتراضي:
  // return { name: "محمد", status: "paid", due_amount: 0, expiry_date: "2026-02-10" };
  return null; // حالياً ما في DB
}

// ================== Webhook Receiver ==================
app.post("/", async (req, res) => {
  try {
    const data = req.body?.data;

    // حماية من أي webhook بدون رسائل
    if (!data || !data.messages || data.messages.length === 0) {
      return res.sendStatus(200);
    }

    const message = data.messages[0];
    const from = message.from;

    // تشخيص (مفيد)
    console.log("📦 Message:", JSON.stringify(message, null, 2));

    // 🎤 صوت
    if (message.type === "voice" || message.type === "audio") {
      await sendWhatsAppMessage(
        from,
        "وصلني صوتك 🎧\nحاليًا بخدمك بالرسائل النصية ✍️، ابعتلي مكتوب لو سمحت 🙏"
      );
      return res.sendStatus(200);
    }

    // 📷 صورة / 📎 ملف / 📍 موقع / أي شي غير نص
    if (message.type !== "chat") {
      await sendWhatsAppMessage(
        from,
        "وصلتني رسالتك 👍\nحاليًا بخد
