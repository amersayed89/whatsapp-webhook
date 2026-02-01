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
async function askOpenAI(text) {
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
تفهم مشاكل الانترنت، السرعات، البطء، الانقطاع، الراوتر والواي فاي.
جاوب بلهجة لبنانية مهذبة وبطريقة بسيطة.
إذا السؤال غير واضح اطلب توضيح.
إذا خارج مجال الانترنت اعتذر بلطف.
`,
        },
        { role: "user", content: text },
      ],
    }),
  });

  const data = await res.json();
  return (
    data?.choices?.[0]?.message?.content ||
    "ما فهمت عليك، فيك توضّح أكتر؟"
  );
}

// ================== UTIL: extract text anywhere ==================
function extractTextDeep(obj) {
  if (!obj) return "";
  // لو string مباشرة
  if (typeof obj === "string" && obj.trim()) return obj;

  // لو Array
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = extractTextDeep(item);
      if (found) return found;
    }
  }

  // لو Object
  if (typeof obj === "object") {
    // أسماء شائعة للنص
    const keysPriority = ["body", "text", "message", "caption"];
    for (const k of keysPriority) {
      if (typeof obj[k] === "string" && obj[k].trim()) return obj[k];
    }
    // فتّش بكل القيم
    for (const k of Object.keys(obj)) {
      const found = extractTextDeep(obj[k]);
      if (found) return found;
    }
  }
  return "";
}

// ================== Webhook ==================
app.post("/whatsapp", async (req, res) => {
  try {
    // بعض الحسابات تبعث data/messages، وبعضها مباشرة
    const root = req.body?.data ?? req.body;

    // منع loop (رسائل صادرة)
    const fromMe =
      root?.fromMe === true ||
      root?.isSent === true ||
      root?.ack === 1;

    if (fromMe) return res.sendStatus(200);

    // رقم المرسل
    const from =
      root?.from ||
      root?.sender ||
      root?.chatId ||
      root?.data?.from;

    if (!from) return res.sendStatus(200);

    // نوع الرسالة (إن وُجد)
    const type =
      root?.type ||
      root?.data?.type ||
      root?.messages?.[0]?.type;

    // استخراج النص من أي مكان
    const text = extractTextDeep(root);

    console.log("RAW:", JSON.stringify(req.body, null, 2));
    console.log("EXTRACTED TEXT:", text);

    // صوت
    if (type === "audio" || type === "voice") {
      await sendWhatsAppMessage(
        from,
        "وصلتني رسالة صوتية. فيك تبعتها كتابة لو سمحت؟"
      );
      return res.sendStatus(200);
    }

    // غير نص (صورة/ملف)
    if (type && type !== "chat" && !text) {
      await sendWhatsAppMessage(
        from,
        "حاليًا بخدمك بالرسائل النصية فقط."
      );
      return res.sendStatus(200);
    }

    // نص فاضي
    if (!text || !text.trim()) {
      await sendWhatsAppMessage(
        from,
        "فيك تكتب سؤالك شوي أوضح؟"
      );
      return res.sendStatus(200);
    }

    // 🤖 ذكاء اصطناعي
    const aiReply = await askOpenAI(text);
    await sendWhatsAppMessage(from, aiReply);

    res.sendStatus(200);
  } catch (e) {
    console.error("ERR:", e);
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
