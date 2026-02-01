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
    console.log("=== WEBHOOK HIT ===");

    const data = req.body?.data;
    console.log("DATA:", JSON.stringify(data));

    if (!data || !data.messages || data.messages.length === 0) {
      console.log("NO MESSAGES");
      return res.sendStatus(200);
    }

    const message = data.messages[0];
    console.log("MESSAGE:", message);

    if (message.fromMe === true) {
      console.log("IGNORED: fromMe");
      return res.sendStatus(200);
    }

    console.log("TYPE:", message.type);

    if (message.type !== "chat") {
      console.log("IGNORED: not chat");
      await sendWhatsAppMessage(
        message.from,
        "حالياً بدعم الرسائل النصية فقط."
      );
      return res.sendStatus(200);
    }

    const text = (message.body || "").trim();
    console.log("TEXT:", text);

    if (!text) {
      console.log("EMPTY TEXT");
      return res.sendStatus(200);
    }

    console.log("SENDING TO OPENAI");

    const reply = await askOpenAI(text);

    console.log("AI REPLY:", reply);

    await sendWhatsAppMessage(message.from, reply);

    console.log("MESSAGE SENT");

    res.sendStatus(200);
  } catch (err) {
    console.error("ERROR:", err);
    res.sendStatus(500);
  }
});

