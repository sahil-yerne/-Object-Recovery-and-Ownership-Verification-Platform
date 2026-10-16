const multer = require("multer");
const path = require("path");
const fs = require("fs");

// ================= STORAGE CONFIG =================

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let folder = path.join(__dirname, "../uploads");

        if (req.originalUrl.includes("lost")) {
            folder = path.join(folder, "lost");
        } else if (req.originalUrl.includes("found")) {
            folder = path.join(folder, "found");
        } else if (req.originalUrl.includes("claim")) {
            folder = path.join(folder, "claims");
        } else {
            folder = path.join(folder, "misc");
        }

        // Create folders dynamically if they don't exist
        if (!fs.existsSync(folder)) {
            fs.mkdirSync(folder, { recursive: true });
        }

        cb(null, folder);
    },

    filename: (req, file, cb) => {
        const uniqueName =
            Date.now() + "-" + Math.round(Math.random() * 1e9) +
            path.extname(file.originalname);

        cb(null, uniqueName);
    }
});

// ================= FILE FILTER =================

const fileFilter = (req, file, cb) => {

    const allowedTypes = /jpeg|jpg|png|webp/;

    const ext = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype;

    if (allowedTypes.test(ext) && allowedTypes.test(mime)) {
        cb(null, true);
    } else {
        cb(new Error("Only image files are allowed!"));
    }
};

// ================= UPLOAD INSTANCE =================

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    }
});

module.exports = upload;