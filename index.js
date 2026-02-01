app.post("/whatsapp", async (req, res) => {
  try {
    console.log("RAW:", JSON.stringify(req.body, null, 2));

    const payload = req.body?.data || req.body;

    const from = payload?.from;
    const body = payload?.body;
    const type = payload?.type;

    if (!from) {
      return res.sendStatus(200);
    }

    // صوت
    if (type === "audio" || type === "voice") {
      await sendWhatsAppMessage(
        from,
        "تم استلام رسالة صوتية. الرجاء إرسال رسالتك كتابة."
      );
      return res.sendStatus(200);
    }

    // غير نص
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

    // رد مباشر للاختبار
    await sendWhatsAppMessage(
      from,
      `تم استلام رسالتك: ${body}`
    );

    res.sendStatus(200);
  } catch (e) {
    console.error("ERR:", e);
    res.sendStatus(200);
  }
});
