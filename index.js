import express from "express";

const app = express();
app.use(express.json());

// ================== ENV ==================
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ULTRAMSG_TOKEN = process.env.ULTRAMSG_TOKEN;
const ULTRAMSG_INSTANCE = process.env.ULTRAMSG_INSTANCE;

const ULTRAMSG_BASE = `https://api.ultramsg.com/${ULTRAMSG_INSTANCE}`;

// ================== Send WhatsE
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
            "انت مساعد واتساب لبناني. ردودك قصيرة، واضحة، وبلهجة لبنانية مهذبة.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "يرجى اعادة صياغة السؤال.";
}

// ================== Subscriber (Placeholder) ==================
async function getSubscriberByPhone(phone) {
  // اربطها لاحقا بقاعدة بياناتك
  return null;
}

// ================== Webhook ==================
app.post("/", async (req, res) => {
  try {
    const data = req.body?.data;

    if (!data || !data.messages || data.messages.length === 0) {
      return res.sendStatus(200);
    }

    const message = data.messages[0];
    const from = message.from;

    console.log("Incoming message:", JSON.stringify(message));

    // Voice / Audio
    if (message.type === "voice" || message.type === "audio") {
      await sendWhatsAppMessage(
        from,
        "تم استلام رسالة صوتية. يرجى ارسال رسالتك كتابة."
      );
      return res.sendStatus(200);
    }

    // Any non-text message
    if (message.type !== "chat") {
      await sendWhatsAppMessage(
        from,
        "تم استلام رسالتك. حاليا يتم دعم الرسائل النصية فقط."
      );
      return res.sendStatus(200);
    }

    const text = (message.body || "").trim();

    if (!text) {
      await sendWhatsAppMessage(
        from,
        "يرجى كتابة رسالة واضحة حتى نتمكن من المساعدة."
      );
      return res.sendStatus(200);
    }

    console.log("Text message:", text);

    const subscriber = await getSubscriberByPhone(from);

    if (!subscriber) {
      const reply = await askOpenAI(text);
      await sendWhatsAppMessage(from, reply);
      return res.sendStatus(200);
    }

    if (subscriber.status === "due") {
      await sendWhatsAppMessage(
        from,
        `لديك اشتراك متأخر بقيمة ${subscriber.due_amount}. يرجى التسديد لاعادة تفعيل الخدمة.`
      );
      return res.sendStatus(200);
    }

    if (subscriber.status === "expired") {
      await sendWhatsAppMessage(
        from,
        `اشتراكك منتهي بتاريخ ${subscriber.expiry_date}. يرجى التواصل للتجديد.`
      );
      return res.sendStatus(200);
    }

    const aiReply = await askOpenAI(
      `المشترك اشتراكه فعال. السؤال: ${text}`
    );
    await sendWhatsAppMessage(from, aiReply);

    res.sendStatus(200);
  } catch (err) {
    console.error("Webhook error:", err);
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
