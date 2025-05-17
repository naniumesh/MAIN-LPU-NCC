require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// -------------------- Middleware --------------------
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

// -------------------- MongoDB Connections --------------------
// Registration DB
const registrationConnection = mongoose.createConnection(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

// News DB
const newsConnection = mongoose.createConnection('mongodb+srv://NEWS:2121@newsdata.jqekrq2.mongodb.net/?retryWrites=true&w=majority&appName=NEWSDATA', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

// -------------------- Registration Models --------------------
const RegistrationSchema = new mongoose.Schema({
    firstName: String,
    middleName: String,
    lastName: String,
    gender: String,
    regNumber: String,
    mobile: String,
    email: String
});
const Registration = registrationConnection.model("Registration", RegistrationSchema);

const EnrollmentSchema = new mongoose.Schema({
    enabled: Boolean
});
const Enrollment = registrationConnection.model("Enrollment", EnrollmentSchema);

// -------------------- News Model --------------------
const NewsSchema = new mongoose.Schema({
    text: String,
    url: String,
    date: { type: Date, default: Date.now }
});
const News = newsConnection.model("News", NewsSchema);

// -------------------- Routes: Registration --------------------
// Get enrollment status
app.get("/api/enrollment", async (req, res) => {
    try {
        let enrollment = await Enrollment.findOne();
        if (!enrollment) {
            enrollment = new Enrollment({ enabled: true });
            await enrollment.save();
        }
        res.json({ enabled: enrollment.enabled });
    } catch (error) {
        console.error("Error fetching enrollment status:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

// Toggle enrollment status
app.post("/api/enrollment", async (req, res) => {
    try {
        let enrollment = await Enrollment.findOne();
        if (!enrollment) {
            enrollment = new Enrollment({ enabled: req.body.enabled });
        } else {
            enrollment.enabled = req.body.enabled;
        }
        await enrollment.save();
        res.json({ message: "Enrollment status updated", enabled: enrollment.enabled });
    } catch (error) {
        console.error("Error updating enrollment status:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

// Get all registrations
app.get("/api/registrations", async (req, res) => {
    try {
        const registrations = await Registration.find();
        res.json(registrations);
    } catch (error) {
        console.error("Error fetching registrations:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

// Add a new registration
app.post("/api/register", async (req, res) => {
    try {
        const enrollment = await Enrollment.findOne();
        if (!enrollment || !enrollment.enabled) {
            return res.status(403).json({ message: "Enrollment is currently closed." });
        }

        const newRegistration = new Registration(req.body);
        await newRegistration.save();
        res.json({ message: "Registration successful" });
    } catch (error) {
        console.error("Error saving registration:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

// Delete a registration
app.delete("/api/registrations/:id", async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid registration ID" });
        }

        const deletedRegistration = await Registration.findByIdAndDelete(id);
        if (!deletedRegistration) {
            return res.status(404).json({ message: "Registration not found" });
        }

        res.json({ message: "Registration deleted successfully" });
    } catch (error) {
        console.error("Error deleting registration:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

// -------------------- Routes: News --------------------
// Get all news
app.get("/api/news", async (req, res) => {
    try {
        const newsItems = await News.find().sort({ date: -1 });
        res.json(newsItems);
    } catch (error) {
        res.status(500).json({ message: "Error fetching news", error });
    }
});

// Add news
app.post("/api/news", async (req, res) => {
    const { text, url } = req.body;
    try {
        const newNews = new News({ text, url });
        await newNews.save();
        res.status(201).json(newNews);
    } catch (error) {
        res.status(500).json({ message: "Error adding news", error });
    }
});

// Full update
app.put("/api/news/:id", async (req, res) => {
    const { text, url } = req.body;
    try {
        const updatedNews = await News.findByIdAndUpdate(
            req.params.id,
            { text, url },
            { new: true }
        );
        res.json(updatedNews);
    } catch (error) {
        res.status(500).json({ message: "Error updating news", error });
    }
});

// Partial update
app.patch("/api/news/:id", async (req, res) => {
    const updates = req.body;
    try {
        const updatedNews = await News.findByIdAndUpdate(
            req.params.id,
            updates,
            { new: true }
        );
        res.json(updatedNews);
    } catch (error) {
        res.status(500).json({ message: "Error patching news", error });
    }
});

// Delete news
app.delete("/api/news/:id", async (req, res) => {
    try {
        const deletedNews = await News.findByIdAndDelete(req.params.id);
        res.json({ message: "News deleted", deletedNews });
    } catch (error) {
        res.status(500).json({ message: "Error deleting news", error });
    }
});

// -------------------- Start Server --------------------
app.listen(PORT, () => {
    console.log(`✅ Unified Server running on port ${PORT}`);
});
