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

  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to, body }),
  });
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
      messages: [
        {
          role: "system",
          content: `
انت موظف دعم فني لشركة إنترنت.
تفهم كل ما يتعلق بالإنترنت: السرعات، البطء، الانقطاع، الراوتر، الواي فاي، الاشتراكات.
جاوب بلهجة لبنانية مهذبة وبطريقة بسيطة.
إذا السؤال مش واضح اطلب توضيح.
إذا السؤال خارج مجال الإنترنت اعتذر بلطف.
`
        },
        { role: "user", content: userText }
      ],
    }),
  });

  const data = await res.json();
  return (
    data?.choices?.[0]?.message?.content ||
    "ما فهمت عليك، فيك توضّح أكتر؟"
  );
}

// ================== Webhook ==================
app.post("/whatsapp", async (req, res) => {
  try {
    // UltraMsg يبعث payload بأشكال مختلفة
    const payload = req.body?.data || req.body;

    const from = payload?.from;

    // 🟢 الحل الأساسي: جلب النص من كل الاحتمالات
    let body = "";

for (const key in payload) {
  if (
    typeof payload[key] === "string" &&
    payload[key].trim().length > 0
  ) {
    body = payload[key];
    break;
  }
}


    const type = payload?.type;

    // منع loop (الرسائل الصادرة من عندنا)
    const fromMe =
      payload?.fromMe === true ||
      payload?.isSent === true ||
      payload?.ack === 1;

    if (fromMe) {
      return res.sendStatus(200);
    }

    if (!from) {
      return res.sendStatus(200);
    }

    console.log("RAW PAYLOAD:", JSON.stringify(payload, null, 2));
    console.log("USER TEXT:", body);

    // 🎤 رسالة صوتية
    if (type === "audio" || type === "voice") {
      await sendWhatsAppMessage(
        from,
        "وصلتني رسالة صوتية. فيك تبعتها كتابة لو سمحت؟"
      );
      return res.sendStatus(200);
    }

    // ❌ غير نص
    if (type && type !== "chat") {
      await sendWhatsAppMessage(
        from,
        "حاليًا بخدمك بالرسائل النصية فقط."
      );
      return res.sendStatus(200);
    }

    // ✍️ نص فاضي
    if (!body || !body.trim()) {
      await sendWhatsAppMessage(
        from,
        "فيك تكتب سؤالك شوي أوضح؟"
      );
      return res.sendStatus(200);
    }

    // 🤖 ذكاء اصطناعي (حر)
    const aiReply = await askOpenAI(body);
    await sendWhatsAppMessage(from, aiReply);

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
