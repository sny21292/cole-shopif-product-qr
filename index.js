const express = require("express");
const path = require("path");

const PORT = process.env.PORT || 3003;
const app = express();

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
  console.log(`qr-integration listening on http://localhost:${PORT}`);
});
