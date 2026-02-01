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

  const data = await res.json();
  console.log("ULTRAMSG RESPONSE:", data);
}

// ================== OpenAI ==================
async function askOpenAI(userText) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.8,
      messages: [
        {
          role: "system",
          content: `
أنت موظف دعم إنترنت في لبنان.
تجاوب باللهجة اللبنانية.
إعطي حلول واضحة لمشاكل:
- الإنترنت
- السرعة
- الاشتراك
- الراوتر
- الواي فاي
ممنوع تقول "فيك توضح أكتر" إلا إذا الرسالة فعلاً غير مفهومة.
          `,
        },
        { role: "user", content: userText },
      ],
    }),
  });

  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "في مشكلة تقنية، جرّب بعد شوي.";
}

// ================== WEBHOOK ==================
app.post("/whatsapp", async (req, res) => {
  try {
    console.log("=== WEBHOOK HIT ===");

    const msg = req.body?.data;
    if (!msg) {
      console.log("NO DATA");
      return res.sendStatus(200);
    }

    console.log("RAW:", JSON.stringify(msg));

    // ❌ تجاهل رسائل البوت نفسه
    if (msg.fromMe === true) {
      console.log("IGNORED: fromMe");
      return res.sendStatus(200);
    }

    // ❌ تجاهل غير النص
    if (msg.type !== "chat") {
      await sendWhatsAppMessage(
        msg.from,
        "حالياً بدعم الرسائل النصية فقط 🙏"
      );
      return res.sendStatus(200);
    }

    const text = (msg.body || "").trim();
    if (!text) {
      console.log("EMPTY MESSAGE");
      return res.sendStatus(200);
    }

    console.log("FROM:", msg.from);
    console.log("TEXT:", text);

    const aiReply = await askOpenAI(text);

    console.log("AI REPLY:", aiReply);

    await sendWhatsAppMessage(msg.from, aiReply);

    return res.sendStatus(200);
  } catch (err) {
    console.error("WEBHOOK ERROR:", err);
    return res.sendStatus(200);
  }
});

// ================== HEALTH ==================
app.get("/", (req, res) => {
  res.send("WhatsApp AI Bot is running");
});

// ================== START ==================
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
