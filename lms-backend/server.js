const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const mongoose = require("mongoose");
const cloudinary = require("cloudinary").v2;
require("dotenv").config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

//////////////////////////////
// 1. DATABASE & CLOUD CONFIG
//////////////////////////////

// Connect to MongoDB (Reuse your MONGO_URI from .env)
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("🍃 MongoDB Connected Successfully"))
    .catch(err => console.error("❌ MongoDB Connection Error:", err));

cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.API_KEY,
    api_secret: process.env.API_SECRET
});

//////////////////////////////
// 2. MULTER STORAGE SETUP
//////////////////////////////

if (!fs.existsSync("uploads")) {
    fs.mkdirSync("uploads");
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, "uploads/"),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});

const upload = multer({
    storage,
    limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /mp4|mpeg|quicktime|pdf|jpeg|jpg|png|gif/;
        const isAllowed = allowedTypes.test(file.mimetype) || allowedTypes.test(file.originalname);
        if (isAllowed) return cb(null, true);
        cb(new Error("Error: File type not supported!"));
    }
});

//////////////////////////////
// 3. CORE API: DYNAMIC UPLOAD
//////////////////////////////

app.post("/upload", upload.any(), async (req, res) => {
    try {
        const file = (req.files && req.files.length > 0) ? req.files[0] : null;

        if (!file) {
            return res.status(400).json({ error: "No file detected." });
        }

        // Logic: Decide folder based on 'module' field sent from frontend
        // If req.body.module is 'react', it goes to react_mastery folder
        const moduleType = req.body.module || "llm"; 
        const folderName = moduleType === "react" ? "react_mastery" : "llm_mastery";

        console.log(`🚀 Uploading to Cloudinary [Folder: ${folderName}]`);

        let resourceType = "auto";
        if (file.mimetype.startsWith("video/")) {
            resourceType = "video";
        } else if (file.mimetype === "application/pdf") {
            resourceType = "image"; // Cloudinary treats PDF as 'image' for better previews
        }

        const result = await cloudinary.uploader.upload(file.path, {
            resource_type: resourceType,
            folder: folderName,
            timeout: 120000
        });

        // Cleanup local temp storage
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);

        res.json({
            success: true,
            url: result.secure_url,
            publicId: result.public_id,
            module: moduleType
        });

    } catch (err) {
        console.error("❌ Server Error:", err);
        if (req.files?.[0] && fs.existsSync(req.files[0].path)) {
            fs.unlinkSync(req.files[0].path);
        }
        res.status(500).json({ error: "Upload failed", details: err.message });
    }
});

//////////////////////////////
// 4. CORE API: PROGRESS SYNC
//////////////////////////////

// Saves React student progress to MongoDB
app.post("/api/progress/sync", async (req, res) => {
    try {
        const { userId, level, completedSteps } = req.body;
        // Example: Update user progress collection
        // await UserProgress.updateOne({ userId }, { $set: { [level]: completedSteps } }, { upsert: true });
        res.json({ success: true, message: "Progress synced to DB" });
    } catch (err) {
        res.status(500).json({ error: "DB Sync failed" });
    }
});

//////////////////////////////
// 5. SERVER INITIALIZATION
//////////////////////////////

app.get("/health", (req, res) => {
    res.json({ status: "Online", db: mongoose.connection.readyState === 1 });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`✅ React Module Backend: http://localhost:${PORT}`);
});