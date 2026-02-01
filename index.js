import express from "express";

const app = express();
app.use(express.json());

app.post("/whatsapp", (req, res) => {
  console.log("Incoming:", req.body);
  res.json({ ok: true });
});

app.get("/", (req, res) => {
  res.send("Webhook is running");
});

app.listen(process.env.PORT || 3000, () =>
  console.log("Server running")
);
