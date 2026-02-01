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

  const data = await res.json();
  console.log("ULTRAMSG:", data);
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
      temperature: 0.8,
      messages: [
        {
          role: "system",
          content: `
أنت موظف دعم فني لشركة إنترنت في لبنان.

مهمتك:
- تفهم السؤال مباشرة
- تجاوب باللهجة اللبنانية
- تعطي حلول عملية وواضحة
- إذا المستخدم قال "الانترنت مقطوع" → أعطي خطوات فحص
- إذا قال "الواي فاي ضعيف" → حلول واي فاي
- إذا قال "ما عم يفتح" → اسأل عن لمبة الراوتر أو السرعة

ممنوع تعطي جواب عام.
ممنوع تقول "صار في مشكلة تقنية".
ممنوع تقول "وضح أكتر" إلا إذا الرسالة غير مفهومة حرفيًا.
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

  const reply = data?.choices?.[0]?.message?.content;

  if (!reply || reply.length < 5) {
    return "جرب تطفّي الراوتر دقيقة وترجّع تشغّلو، وقلي شو بيصير.";
  }

  return reply;
}


// ================== WEBHOOK ==================
app.post("/whatsapp", async (req, res) => {
  try {
    console.log("=== WEBHOOK HIT ===");

    const payload = req.body;
    const msg = payload?.data;

    if (!msg) {
      console.log("NO MESSAGE");
      return res.sendStatus(200);
    }

    // ❌ تجاهل رسائل البوت نفسه
    if (msg.fromMe === true) {
      console.log("IGNORED fromMe");
      return res.sendStatus(200);
    }

    // ❌ تجاهل ACK
    if (msg.ack && msg.ack !== "") {
      console.log("IGNORED ACK");
      return res.sendStatus(200);
    }

    // ❌ فقط نص
    if (msg.type !== "chat") {
      await sendWhatsAppMessage(
        msg.from,
        "حالياً بدعم الرسائل النصية فقط."
      );
      return res.sendStatus(200);
    }

    const text = (msg.body || "").trim();
    if (!text) {
      console.log("EMPTY TEXT");
      return res.sendStatus(200);
    }

    console.log("FROM:", msg.from);
    console.log("TEXT:", text);

    // ✅ كل شي يروح عالذكاء
    const aiReply = await askOpenAI(text);

    console.log("AI:", aiReply);

    await sendWhatsAppMessage(msg.from, aiReply);

    return res.sendStatus(200);
  } catch (err) {
    console.error("ERROR:", err);
    return res.sendStatus(200);
  }
});

// ================== HEALTH ==================
app.get("/", (req, res) => {
  res.send("WhatsApp AI Bot Running");
});

// ================== START ==================
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
