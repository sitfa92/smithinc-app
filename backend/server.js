require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json());

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;

if (!process.env.MONGO_URI) {
  console.warn("MONGO_URI is not set. Database connection will fail until configured.");
}
if (!JWT_SECRET) {
  console.warn("JWT_SECRET is not set. Auth routes will fail until configured.");
}

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err.message));

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["MJ", "CHIZZY"], required: true },
  },
  { timestamps: true }
);

const ModelSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    instagram: { type: String, default: "" },
    height: { type: String, default: "" },
    status: { type: String, default: "pending", enum: ["pending", "approved", "rejected"] },
  },
  { timestamps: true }
);

const ClientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: "" },
    stage: { type: String, default: "lead", enum: ["lead", "active", "won", "lost"] },
  },
  { timestamps: true }
);

const TaskSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["MJ", "CHIZZY"], required: true },
    task: { type: String, required: true },
    status: { type: String, default: "pending", enum: ["pending", "in_progress", "done"] },
  },
  { timestamps: true }
);

const User = mongoose.model("User", UserSchema);
const Model = mongoose.model("Model", ModelSchema);
const Client = mongoose.model("Client", ClientSchema);
const Task = mongoose.model("Task", TaskSchema);

const auth = (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : authHeader;

  if (!token) return res.status(401).json({ msg: "No token" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (_err) {
    res.status(401).json({ msg: "Invalid token" });
  }
};

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "backend", uptime: process.uptime() });
});

app.post("/auth/register", async (req, res) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password || !role) {
      return res.status(400).json({ msg: "email, password, and role are required" });
    }

    const exists = await User.findOne({ email: email.toLowerCase().trim() });
    if (exists) {
      return res.status(409).json({ msg: "User already exists" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ email, password: hashed, role });

    res.status(201).json({ id: user._id, email: user.email, role: user.role });
  } catch (err) {
    res.status(500).json({ msg: err.message || "Registration failed" });
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ msg: "email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(400).json({ msg: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: "Wrong password" });

    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });

    res.json({ token, role: user.role });
  } catch (err) {
    res.status(500).json({ msg: err.message || "Login failed" });
  }
});

app.post("/webhook/zapier", async (req, res) => {
  try {
    const { type, data } = req.body;

    switch (type) {
      case "model_signup":
        await Model.create(data);
        break;

      case "new_client":
        await Client.create(data);
        await Task.create({
          role: "MJ",
          task: `Onboard ${data.name}`,
        });
        break;

      case "booking":
        await Task.create({
          role: "MJ",
          task: `Prepare booking for ${data.client}`,
        });
        break;

      default:
        return res.status(400).json({ msg: `Unsupported webhook type: ${type}` });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ msg: err.message || "Webhook failed" });
  }
});

app.get("/models", auth, async (_req, res) => {
  try {
    const models = await Model.find().sort({ createdAt: -1 });
    res.json(models);
  } catch (err) {
    res.status(500).json({ msg: err.message || "Failed to fetch models" });
  }
});

app.post("/models/approve/:id", auth, async (req, res) => {
  try {
    if (req.user.role !== "CHIZZY") return res.status(403).json({ msg: "Forbidden" });

    const model = await Model.findByIdAndUpdate(
      req.params.id,
      { status: "approved" },
      { new: true }
    );

    if (!model) return res.status(404).json({ msg: "Model not found" });
    res.json(model);
  } catch (err) {
    res.status(500).json({ msg: err.message || "Failed to approve model" });
  }
});

app.get("/clients", auth, async (_req, res) => {
  try {
    const clients = await Client.find().sort({ createdAt: -1 });
    res.json(clients);
  } catch (err) {
    res.status(500).json({ msg: err.message || "Failed to fetch clients" });
  }
});

app.get("/tasks", auth, async (req, res) => {
  try {
    const tasks = await Task.find({ role: req.user.role }).sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ msg: err.message || "Failed to fetch tasks" });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
