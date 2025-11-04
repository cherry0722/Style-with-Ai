const router = require("express").Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const users = new Map();

router.post("/signup", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password)
      return res.status(400).json({ message: "Email and password required" });
    if (users.has(email))
      return res.status(409).json({ message: "User already exists" });
    const hash = await bcrypt.hash(password, 10);
    users.set(email, { email, passwordHash: hash });
    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: "7d" });
    res.status(201).json({ token, user: { email } });
  } catch (e) {
    console.error("signup", e);
    res.status(500).json({ message: "Signup error" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password)
      return res.status(400).json({ message: "Email and password required" });
    const u = users.get(email);
    if (!u) return res.status(401).json({ message: "Invalid credentials" });
    const ok = await bcrypt.compare(password, u.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });
    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: { email } });
  } catch (e) {
    console.error("login", e);
    res.status(500).json({ message: "Login error" });
  }
});

module.exports = router;