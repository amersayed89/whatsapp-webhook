import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// ========== ENV ==========
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ULTRAMSG_TOKEN = process.env.ULTRAMSG_TOKEN;
const ULTRAMSG_INSTANCE = process.env.ULTRAMSG_INSTANCE;

const ULTRAMSG_BASE = `https://api.ultramsg.com/${ULTRAMSG_INSTANCE}`;

// ========== WhatsApp Send ==========
async function sendWhatsAppMessage(to, body) {
  const url = `${ULTRAMSG_BASE}/messages/chat?token=${ULTRAMSG_TOKEN}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to, body }),
  });

  return res.json();
}

// ========== OpenAI ==========
async function askOpenAI(userText) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: `
انت مساعد دعم تقني لشركة انترنت في لبنان.
ممنوع تقول "فيك توضح اكتر" او "ما فهمت".
اذا الرسالة قصيرة، افترض انها مشكلة انترنت ورد بحل منطقي.

اعطِ اقتراحات مباشرة مثل:
- فحص الراوتر
- اعادة تشغيل
- سؤال عن وقت المشكلة
- سؤال عن اللمبات

احكي بلهجة لبنانية محترمة، مختصرة، ومفيدة.
`
        },
        {
          role: "user",
          content: userText
        }
      ],
    }),
  });

  const data = await res.json();
  return (
    data?.choices?.[0]?.message?.content ||
    "في مشكلة تقنية حالياً، جرّب بعد شوي."
  );
}


// ========== WEBHOOK ==========
app.post("/whatsapp", async (req, res) => {
  try {
    const message = req.body?.data;

    if (!message || message.self === true) {
      return res.sendStatus(200);
    }

    const from = message.from;
    const text = (message.body || "").trim();
    // ====== FIX: ردود مباشرة لمشاكل واضحة ======
const lower = text.toLowerCase();

if (
  lower.includes("بطئ") ||
  lower.includes("بطيء") ||
  lower.includes("ضعيف") ||
  lower.includes("مقطوع") ||
  lower.includes("ما في") ||
  lower.includes("مافي") ||
  lower.includes("انترنت") ||
  lower.includes("نت")
) {
  await sendWhatsAppMessage(
    from,
    "تمام، المشكلة وصلت. فيك تقلي من أي ساعة بلشت؟ وهل اللمبة بالراوتر شغالة؟"
  );
  return res.sendStatus(200);
}

if (
  lower === "شو بعمل" ||
  lower === "كيف" ||
  lower === "؟" ||
  lower === "فيك توضح"
) {
  await sendWhatsAppMessage(
    from,
    "خبرني أكتر عن المشكلة: بطء، انقطاع، أو ما في اتصال نهائي؟"
  );
  return res.sendStatus(200);
}


    console.log("TEXT:", text);

    // === فلترة الرسائل الغامضة ===
    const vagueMessages = [
      "مرحبا",
      "أهلا",
      "نعم",
      "شو",
      "كيف",
      "فيك توضح",
      "وضح",
      "؟",
      "شو في",
    ];

    if (text.length < 6 || vagueMessages.includes(text)) {
      await sendWhatsAppMessage(
        from,
        "أكيد. خبرني شو المشكلة بالضبط؟ بطء، انقطاع، اشتراك، أو فاتورة."
      );
      return res.sendStatus(200);
    }

    // === ذكاء اصطناعي ===
    const aiReply = await askOpenAI(
      `المستخدم عم يسأل عن مشكلة إنترنت. سؤاله: ${text}`
    );

    await sendWhatsAppMessage(from, aiReply);
    res.sendStatus(200);
  } catch (err) {
    console.error("ERROR:", err);
    res.sendStatus(200);
  }
});

// ========== HEALTH ==========
app.get("/", (req, res) => {
  res.send("Webhook running");
});

// ========== START ==========
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
