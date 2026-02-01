import express from "express";

const app = express();
app.use(express.json());

// ================== ENV ==================
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ULTRAMSG_TOKEN = process.env.ULTRAMSG_TOKEN;
const ULTRAMSG_INSTANCE = process.env.ULTRAMSG_INSTANCE;

const ULTRAMSG_BASE = `https://api.ultramsg.com/${ULTRAMSG_INSTANCE}`;

if (!OPENAI_API_KEY || !ULTRAMSG_TOKEN || !ULTRAMSG_INSTANCE) {
  console.error("Missing ENV variables");
}

// ================== Send WhatsApp ==================
async function sendWhatsAppMessage(to, body) {
  const url = `${ULTRAMSG_BASE}/messages/chat?token=${ULTRAMSG_TOKEN}`;

  console.log("SENDING MESSAGE TO:", to);
  console.log("BODY:", body);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to,
      body
    })
  });

  const data = await res.json();
  console.log("ULTRAMSG RESPONSE:", data);
  return data;
}

// ================== OpenAI ==================
async function askOpenAI(text) {
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
          content:
            "انت مساعد واتساب لبناني مختص بكل شي له علاقة بالانترنت، الشبكات، البطء، الاشتراكات. ردودك قصيرة وواضحة."
        },
        { role: "user", content: text }
      ]
    })
  });

  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "ما فهمت عليك، فيك توضّح أكتر؟";
}

// ================== Webhook ==================
app.post("/whatsapp", async (req, res) => {
  try {
    console.log("=== WEBHOOK HIT ===");
    console.log("RAW BODY:", JSON.stringify(req.body));

    // UltraMsg message structure
    const message = req.body?.data;

    if (!message) {
      console.log("NO MESSAGE");
      return res.sendStatus(200);
    }

    // منع loop
    if (message.fromMe === true) {
      console.log("IGNORED fromMe");
      return res.sendStatus(200);
    }

    const from = message.from;
    const type = message.type;
    const text = (message.body || "").trim();

    console.log("FROM:", from);
    console.log("TYPE:", type);
    console.log("TEXT:", text);

    // صوت
    if (type === "voice" || type === "audio") {
      await sendWhatsAppMessage(
        from,
        "وصلتني رسالة صوتية، فيك تبعتلي رسالتك كتابة؟"
      );
      return res.sendStatus(200);
    }

    // غير نص
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
    console.error("ERROR:", err);
    res.sendStatus(500);
  }
});

// ================== Health ==================
app.get("/", (req, res) => {
  res.send("Webhook is running");
});

// ================== Start ==================
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
