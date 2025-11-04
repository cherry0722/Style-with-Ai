const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const app = express();

try {
  require("./db");
  console.log("ℹ️ DB module loaded");
} catch (e) {
  console.warn("⚠️ DB load skipped:", e.message);
}

app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(morgan("dev"));

app.get("/api/health", (req, res) =>
  res.status(200).json({ ok: true, ts: Date.now() })
);

const authRoutes = require("./routes/auth");
app.use("/api", authRoutes);

// 404 handler - must be last
app.use((req, res) => {
  res.status(404).json({ message: "Not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("💥 Unhandled error:", err);
  res.status(500).json({ message: "Server error" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`✅ API listening on http://0.0.0.0:${PORT}`)
);