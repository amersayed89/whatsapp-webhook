import express from "express";

const app = express();
app.use(express.json());

// ================== ENV ==================
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ULTRAMSG_TOKEN = process.env.ULTRAMSG_TOKEN;
const ULTRAMSG_INSTANCE = process.env.ULTRAMSG_INSTANCE;

const ULTRAMSG_BASE = `https://api.ultramsg.com/${ULTRAMSG_INSTANCE}`;

// ================== Send WhatsApp ==================
async function sendWhatsAppMessage(to, body) {
  const url = `${ULTRAMSG_BASE}/messages/chat?token=${ULTRAMSG_TOKEN}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to, body }),
  });

  return res.json();
}

// ================== Webhook ==================
app.post("/whatsapp", async (req, res) => {
  try {
    console.log("RAW BODY:", JSON.stringify(req.body, null, 2));

    const payload = req.body?.data || req.body;

    const from = payload?.from;
    const body = payload?.body;
    const type = payload?.type;

    if (!from) {
      return res.sendStatus(200);
    }

    if (type === "audio" || type === "voice") {
      await sendWhatsAppMessage(
        from,
        "تم استلام رسالة صوتية. الرجاء إرسال رسالتك كتابة."
      );
      return res.sendStatus(200);
    }

    if (type !== "chat") {
      await sendWhatsAppMessage(
        from,
        "حالياً يتم دعم الرسائل النصية فقط."
      );
      return res.sendStatus(200);
    }

    if (!body || !body.trim()) {
      await sendWhatsAppMessage(
        from,
        "يرجى كتابة رسالة واضحة."
      );
      return res.sendStatus(200);
    }

    // رد اختبار مباشر
    await sendWhatsAppMessage(
      from,
      `تم استلام رسالتك: ${body}`
    );

    res.sendStatus(200);
  } catch (err) {
    console.error("Webhook error:", err);
    res.sendStatus(200);
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
