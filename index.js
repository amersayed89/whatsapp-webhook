import express from "express";

const app = express();
app.use(express.json());

// ================== ENV ==================
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ULTRAMSG_TOKEN = process.env.ULTRAMSG_TOKEN;
const ULTRAMSG_INSTANCE = process.env.ULTRAMSG_INSTANCE;

if (!OPENAI_API_KEY || !ULTRAMSG_TOKEN || !ULTRAMSG_INSTANCE) {
  console.error("Missing environment variables");
}

const ULTRAMSG_BASE = `https://api.ultramsg.com/${ULTRAMSG_INSTANCE}`;

// ================== WhatsApp Send ==================
async function sendWhatsAppMessage(to, body) {
  const url = `${ULTRAMSG_BASE}/messages/chat?token=${ULTRAMSG_TOKEN}`;

  console.log("SENDING WHATSAPP MESSAGE");
  console.log("TO:", to);
  console.log("BODY:", body);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to, body }),
  });

  const data = await res.json();
  console.log("ULTRAMSG RESPONSE:", data);

  return data;
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
            "انت مساعد واتساب لبناني مختص بالانترنت. ردودك واضحة، قصيرة، وبلهجة لبنانية محترمة.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  const data = await res.json();
  const reply = data?.choices?.[0]?.message?.content;

  return reply || "ما فهمت عليك، فيك توضّح أكتر؟";
}

// ================== Webhook ==================
app.post("/whatsapp", async (req, res) => {
  try {
    console.log("=== WEBHOOK HIT ===");
    console.log("RAW BODY:", JSON.stringify(req.body));

    const message = req.body?.data;

    if (!message) {
      console.log("NO MESSAGE OBJECT");
      return res.sendStatus(200);
    }

    if (message.fromMe === true) {
      console.log("IGNORED: fromMe");
      return res.sendStatus(200);
    }

    const from = message.from;
    const type = message.type;
    const text = (message.body || "").trim();

    console.log("FROM:", from);
    console.log("TYPE:", type);
    console.log("TEXT:", text);

    if (type === "voice" || type === "audio") {
      await sendWhatsAppMessage(
        from,
        "وصلتني رسالة صوتية. فيك تبعتلي رسالتك كتابة؟"
      );
      return res.sendStatus(200);
    }

    if (type !== "chat") {
      await sendWhatsAppMessage(
        from,
        "حالياً بدعم الرسائل النصية فقط."
      );
      return res.sendStatus(200);
    }

    if (!text) {
      return res.sendStatus(200);
    }

    console.log("SENDING TO OPENAI");
    const reply = await askOpenAI(text);
    console.log("AI REPLY:", reply);

    await sendWhatsAppMessage(from, reply);
    console.log("MESSAGE SENT");

    res.sendStatus(200);
  } catch (err) {
    console.error("WEBHOOK ERROR:", err);
    res.sendStatus(500);
  }
});
