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
const newsConnection = mongoose.createConnection(process.env.MONGO_NEWS_URI, {
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

// Add a news item
app.post("/api/news", async (req, res) => {
    try {
        const { text, url } = req.body;
        if (!text || !url) {
            return res.status(400).json({ message: "Text and URL are required." });
        }

        const newNews = new News({ text, url });
        await newNews.save();
        res.status(201).json({ message: "News item added", news: newNews });
    } catch (error) {
        res.status(500).json({ message: "Error adding news", error });
    }
});

// Update a news item
app.patch("/api/news/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { text, url } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid news ID" });
        }

        const updatedNews = await News.findByIdAndUpdate(
            id,
            { text, url },
            { new: true }
        );

        if (!updatedNews) {
            return res.status(404).json({ message: "News item not found" });
        }

        res.json({ message: "News updated", news: updatedNews });
    } catch (error) {
        res.status(500).json({ message: "Error updating news", error });
    }
});

// Delete a news item
app.delete("/api/news/:id", async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid news ID" });
        }

        const deletedNews = await News.findByIdAndDelete(id);

        if (!deletedNews) {
            return res.status(404).json({ message: "News item not found" });
        }

        res.json({ message: "News item deleted" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting news", error });
    }
});

// -------------------- Start Server --------------------
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
