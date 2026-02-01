import express from "express";

const app = express();
app.use(express.json());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ULTRAMSG_TOKEN = process.env.ULTRAMSG_TOKEN;
const ULTRAMSG_INSTANCE = process.env.ULTRAMSG_INSTANCE;

// استقبال رسالة واتساب
app.post("/whatsapp", async (req, res) => {
  try {
    const from = req.body?.data?.from;
    const message = req.body?.data?.body;

    if (!from || !message) {
      return res.json({ ok: true });
    }

    // طلب للذكاء الاصطناعي
    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "انت موظف دعم لمزود انترنت بلبنان. احكي دايمًا بلهجة لبنانية محترمة، مختصرة، وواضحة."
          },
          {
            role: "user",
            content: message
          }
        ]
      })
    });

    const aiData = await aiResponse.json();
    const reply = aiData.choices[0].message.content;

    // إرسال الرد عبر UltraMsg
    await fetch(
      `https://api.ultramsg.com/${ULTRAMSG_INSTANCE}/messages/chat`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          token: ULTRAMSG_TOKEN,
          to: from,
          body: reply
        })
      }
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.json({ error: true });
  }
});

// فحص السيرفر
app.get("/", (req, res) => {
  res.send("Webhook is running");
});

app.listen(process.env.PORT || 3000, () =>
  console.log("Server running")
);
