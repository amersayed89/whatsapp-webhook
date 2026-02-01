import express from "express";

const app = express();
app.use(express.json());

// ================= ENV =================
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ULTRAMSG_TOKEN = process.env.ULTRAMSG_TOKEN;
const ULTRAMSG_INSTANCE = process.env.ULTRAMSG_INSTANCE;

const ULTRAMSG_BASE = `https://api.ultramsg.com/${ULTRAMSG_INSTANCE}`;

// ================= WhatsApp Send =================
async function sendWhatsAppMessage(to, body) {
  const url = `${ULTRAMSG_BASE}/messages/chat?token=${ULTRAMSG_TOKEN}`;

  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to, body })
  });
}

// ================= OpenAI =================
async function askAI(userText) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
أنت موظف دعم فني إنترنت لبناني.
تفهم أي سؤال عن:
- قطع الإنترنت
- بطء السرعة
- الراوتر
- الاشتراكات
- الدفع
- الشبكات

ردودك:
- قصيرة
- واضحة
- باللهجة اللبنانية
- بدون فلسفة
`
        },
        {
          role: "user",
          content: userText
        }
      ],
      temperature: 0.7
    })
  });

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "كيف فيني ساعدك؟";
}

// ================= Webhook =================
app.post("/whatsapp", async (req, res) => {
  try {
    const data = req.body?.data;
    if (!data?.messages?.length) return res.sendStatus(200);

    const msg = data.messages[0];
    const from = msg.from;
    const text = (msg.body || "").trim();

    console.log("INCOMING:", text);

    // صوت
    if (msg.type === "voice" || msg.type === "audio") {
      await sendWhatsAppMessage(from, "فيك تبعتلي رسالتك كتابة؟");
      return res.sendStatus(200);
    }

    // غير نص
    if (msg.type !== "chat") {
      await sendWhatsAppMessage(from, "حالياً بدعم الرسائل النصية بس.");
      return res.sendStatus(200);
    }

    if (!text) {
      await sendWhatsAppMessage(from, "اكتبلي شو المشكلة بالتحديد.");
      return res.sendStatus(200);
    }

    const reply = await askAI(text);
    await sendWhatsAppMessage(from, reply);

    res.sendStatus(200);
  } catch (err) {
    console.error("ERROR:", err);
    res.sendStatus(200);
  }
});

// ================= Health =================
app.get("/", (req, res) => {
  res.send("WhatsApp AI Bot Running");
});

// ================= Start =================
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
