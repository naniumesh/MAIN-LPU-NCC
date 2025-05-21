// Load environment variables from .env file
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const bcrypt = require("bcrypt");

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.static(path.join(__dirname, "public"))); // Serve frontend

// Connect to Registration DB
const regDb = mongoose.createConnection(process.env.MONGO_REG_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
regDb.on("connected", () => console.log("✅ Registration DB connected"));
regDb.on("error", err => console.error("❌ Registration DB error:", err));

// Connect to Login DB
const loginDb = mongoose.createConnection(process.env.MONGO_LOGIN_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
loginDb.on("connected", () => console.log("✅ Login DB connected"));
loginDb.on("error", err => console.error("❌ Login DB error:", err));

// Models for Registration System
const Registration = regDb.model("Registration", new mongoose.Schema({
  rank: String,
  fullname: String,
  year: String,
  enroll: String,
  regnum: String,
  battalion: String,
  camp: String,
  sd: String,
  image: String,
}));

const Setting = regDb.model("Setting", new mongoose.Schema({
  registrationEnabled: Boolean,
}));

const CampData = regDb.model("CampData", new mongoose.Schema({
  battalion: String,
  camp: String,
}));

// Model for Login System
const LoginUser = loginDb.model("LoginUser", new mongoose.Schema({
  username: String,
  password: String, // hashed
}));

// Default route to load registration page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "register.html"));
});

// ------------------- LOGIN SYSTEM -------------------

// Login
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await LoginUser.findOne({ username });

  if (!user) return res.status(401).json({ success: false, message: "User not found." });

  const match = await bcrypt.compare(password, user.password);
  if (match) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, message: "Invalid password." });
  }
});

// Add User
app.post("/api/add-user", async (req, res) => {
  const { username, password } = req.body;

  const exists = await LoginUser.findOne({ username });
  if (exists) return res.status(409).json({ message: "User already exists" });

  const hashedPassword = await bcrypt.hash(password, 10);
  await LoginUser.create({ username, password: hashedPassword });

  res.json({ success: true });
});

// Get All Users
app.get("/api/users", async (req, res) => {
  const users = await LoginUser.find({}, { password: 0 });
  res.json(users);
});

// Remove User
app.delete("/api/users/:username", async (req, res) => {
  const result = await LoginUser.deleteOne({ username: req.params.username });
  if (result.deletedCount > 0) {
    res.json({ success: true });
  } else {
    res.status(404).json({ message: "User not found" });
  }
});

// ------------------- REGISTRATION SYSTEM -------------------

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads"),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

// Registration Settings
app.get("/api/settings", async (req, res) => {
  let setting = await Setting.findOne();
  if (!setting) {
    setting = new Setting({ registrationEnabled: true });
    await setting.save();
  }
  res.json(setting);
});

app.post("/api/settings", async (req, res) => {
  let setting = await Setting.findOne();
  if (!setting) {
    setting = new Setting(req.body);
  } else {
    setting.registrationEnabled = req.body.registrationEnabled;
  }
  await setting.save();
  res.sendStatus(200);
});

// Camps
app.get("/api/camps", async (req, res) => {
  const camps = await CampData.find();
  const grouped = {};
  camps.forEach(({ battalion, camp }) => {
    if (!grouped[battalion]) grouped[battalion] = [];
    grouped[battalion].push(camp);
  });
  res.json(grouped);
});

app.post("/api/camps", async (req, res) => {
  const { battalion, camp } = req.body;
  const exists = await CampData.findOne({ battalion, camp });
  if (!exists) {
    await CampData.create({ battalion, camp });
    res.json({ success: true });
  } else {
    res.status(409).json({ message: "Camp already exists." });
  }
});

app.delete("/api/camps", async (req, res) => {
  const { battalion, camp } = req.body;
  const result = await CampData.deleteOne({ battalion, camp });
  if (result.deletedCount > 0) {
    res.json({ success: true });
  } else {
    res.status(404).json({ message: "Camp not found." });
  }
});

// Registrations
app.post("/api/register", upload.single("image"), async (req, res) => {
  try {
    const {
      rank, fullname, year, enroll,
      regnum, battalion, camp, sd
    } = req.body;

    const newReg = new Registration({
      rank, fullname, year, enroll,
      regnum, battalion, camp, sd,
      image: req.file ? req.file.path : "",
    });

    const saved = await newReg.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/registrations", async (req, res) => {
  const data = await Registration.find();
  res.json(data);
});

app.delete("/api/registrations/:id", async (req, res) => {
  await Registration.findByIdAndDelete(req.params.id);
  res.sendStatus(200);
});

// ------------------- START SERVER -------------------

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
