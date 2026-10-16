const db = require("../config/db");
const jwt = require("jsonwebtoken");
const { generateEmbedding, calculateBadge, findContinuousMatches, checkAndAwardAchievements } = require("../services/aiService");
const { trackQuizAttempt, checkQuizLock } = require("../middleware/rateLimiter");
const validateLostItem = require("../validators/lostValidator");
const validateFoundItem = require("../validators/foundValidator");
const notificationService = require("../services/notificationService");

const JWT_SECRET = process.env.JWT_SECRET || "your_super_secret_jwt_key_12345";

// Helper to award points and log transactions
async function awardPoints(userId, pointsToAdd, trustToAdd, reason) {
    if (!userId) return;
    try {
        await db.query("INSERT INTO point_transactions (userId, points, reason) VALUES (?, ?, ?)", [userId, pointsToAdd, reason]);
        const [users] = await db.query("SELECT points, trustScore FROM users WHERE id = ?", [userId]);
        if (users.length > 0) {
            const newPoints = (users[0].points || 0) + pointsToAdd;
            const newTrust = (users[0].trustScore || 0) + trustToAdd;
            const newBadge = calculateBadge(newPoints);
            await db.query("UPDATE users SET points = ?, trustScore = ?, badge = ? WHERE id = ?", [newPoints, newTrust, newBadge, userId]);
        }
        await notificationService.createAlert({
            userId,
            title: `🎉 +${pointsToAdd} Karma Points Earned!`,
            message: `You earned ${pointsToAdd} points & +${trustToAdd} Trust Score for: ${reason}.`
        });
    } catch (e) {
        console.warn("Points awarding error:", e.message);
    }
}

// Helper to extract optional user from token in headers
function getOptionalUserId(req) {
    if (req.user && req.user.id) return req.user.id;
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (authHeader && typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            return decoded.id || null;
        } catch (e) {
            // Token invalid or expired — treat as unauthenticated
            return null;
        }
    }
    return null;
}

// ================= PRIVACY MASKING HELPERS =================

function maskPhone(phone) {
    if (!phone || typeof phone !== "string") return "";
    const clean = phone.trim();
    if (clean.length <= 4) return "****";
    return clean.slice(0, 3) + "*".repeat(Math.max(1, clean.length - 6)) + clean.slice(-3);
}

function maskEmail(email) {
    if (!email || typeof email !== "string" || !email.includes("@")) return "";
    const [user, domain] = email.split("@");
    if (user.length <= 2) return `${user[0]}***@${domain}`;
    return `${user.slice(0, 2)}***${user.slice(-1)}@${domain}`;
}

function sanitizeItem(item, isVerified = false) {
    if (!item) return null;
    const sanitized = { ...item };
    delete sanitized.secretAnswer; // NEVER expose secret answer to client

    if (!isVerified) {
        sanitized.phone = maskPhone(item.phone);
        sanitized.email = maskEmail(item.email);
        sanitized.isContactLocked = true;
    } else {
        sanitized.isContactLocked = false;
    }

    return sanitized;
}

// ================= CREATE LOST ITEM =================

exports.createLostItem = async(req, res) => {
    try {
        const data = req.body;
        const validationErrors = validateLostItem(data);
        if (validationErrors.length > 0) {
            return res.status(400).json({ success: false, message: validationErrors.join(", ") });
        }

        const userId = getOptionalUserId(req);

        let images = [];
        if (req.files && req.files.length > 0) {
            images = req.files.map(file => `/uploads/lost/${file.filename}`);
        }

        let embedding = null;
        if (req.files && req.files.length > 0) {
            embedding = await generateEmbedding(req.files[0].path);
        }

        const sql = `
            INSERT INTO items 
            (userId, itemName, category, brand, color, date, location, latitude, longitude, description, contactName, phone, email, status, images, secretQuestion, secretAnswer, embedding)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'lost', ?, ?, ?, ?)
        `;

        const values = [
            userId,
            data.itemName,
            data.category,
            data.brand || null,
            data.color || null,
            data.lostDate || data.date,
            data.location,
            data.latitude ? parseFloat(data.latitude) : null,
            data.longitude ? parseFloat(data.longitude) : null,
            data.description || null,
            data.contactName,
            data.phone,
            data.email || null,
            JSON.stringify(images),
            data.secretQuestion || null,
            data.secretAnswer || null,
            embedding
        ];

        const [result] = await db.query(sql, values);

        // Award karma points to reporter
        let pointsEarned = 0;
        if (userId) {
            pointsEarned = 20;
            await awardPoints(userId, 20, 5, `Reported Lost Item: ${data.itemName}`);
            checkAndAwardAchievements(db, userId).catch(e => console.warn("Achievement check error:", e.message));
        }

        // Trigger continuous matching engine asynchronously
        findContinuousMatches(db, result.insertId, notificationService).catch(err => {
            console.error("Continuous matching background error:", err.message);
        });

        res.json({
            success: true,
            message: "Lost item created successfully",
            pointsAwarded: pointsEarned,
            data: { id: result.insertId }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ================= CREATE FOUND ITEM =================

exports.createFoundItem = async(req, res) => {
    try {
        const data = req.body;
        const validationErrors = validateFoundItem(data);
        if (validationErrors.length > 0) {
            return res.status(400).json({ success: false, message: validationErrors.join(", ") });
        }

        const userId = getOptionalUserId(req);

        let images = [];
        if (req.files && req.files.length > 0) {
            images = req.files.map(file => `/uploads/found/${file.filename}`);
        }
        
        let embedding = null;
        if (req.files && req.files.length > 0) {
            embedding = await generateEmbedding(req.files[0].path);
        }

        const sql = `
            INSERT INTO items 
            (userId, itemName, category, brand, color, date, location, latitude, longitude, description, contactName, phone, email, status, images, storageDetails, itemCondition, secretQuestion, secretAnswer, embedding)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'found', ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            userId,
            data.itemName,
            data.category,
            data.brand || null,
            data.color || null,
            data.foundDate || data.date,
            data.location,
            data.latitude ? parseFloat(data.latitude) : null,
            data.longitude ? parseFloat(data.longitude) : null,
            data.description || null,
            data.finderName || data.contactName,
            data.phone,
            data.email || null,
            JSON.stringify(images),
            data.storageDetails || null,
            data.itemCondition || null,
            data.secretQuestion || null,
            data.secretAnswer || null,
            embedding
        ];

        const [result] = await db.query(sql, values);

        // Award karma points to good samaritan finder
        let pointsEarned = 0;
        if (userId) {
            pointsEarned = 50;
            await awardPoints(userId, 50, 10, `Reported Found Item: ${data.itemName}`);
            checkAndAwardAchievements(db, userId).catch(e => console.warn("Achievement check error:", e.message));
        }

        // Trigger continuous matching engine asynchronously
        findContinuousMatches(db, result.insertId, notificationService).catch(err => {
            console.error("Continuous matching background error:", err.message);
        });

        res.json({
            success: true,
            message: "Found item created successfully",
            pointsAwarded: pointsEarned,
            data: { id: result.insertId }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ================= GET ALL ITEMS =================

exports.getAllItems = async(req, res) => {
    try {

        const [rows] = await db.query(
            "SELECT * FROM items ORDER BY id DESC"
        );

        const sanitized = rows.map(r => sanitizeItem(r, false));

        res.json({
            success: true,
            data: sanitized
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ================= GET ITEM BY ID =================

exports.getItemById = async(req, res) => {
    try {

        const { id } = req.params;

        const [rows] = await db.query(
            "SELECT * FROM items WHERE id = ?", [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Item not found"
            });
        }

        const item = rows[0];
        const sanitized = sanitizeItem(item, false);

        res.json({
            success: true,
            data: sanitized
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ================= VERIFY OWNERSHIP QUIZ =================

exports.verifyOwnershipQuiz = async(req, res) => {
    try {
        const { id } = req.params;
        const { answer } = req.body;
        const ip = req.ip || req.connection.remoteAddress || "global";

        // Check if user is locked out
        const lockStatus = checkQuizLock(ip, id);
        if (lockStatus.isLocked) {
            return res.status(429).json({
                success: false,
                isLocked: true,
                message: `Too many incorrect attempts. Please wait ${Math.ceil(lockStatus.retryAfter / 60)} minute(s) before trying again.`,
                retryAfter: lockStatus.retryAfter
            });
        }

        const [rows] = await db.query(
            "SELECT id, itemName, contactName, phone, email, secretQuestion, secretAnswer FROM items WHERE id = ?",
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Item not found"
            });
        }

        const item = rows[0];

        // If no secret answer was set on report, grant direct unlock
        if (!item.secretAnswer || item.secretAnswer.trim() === "") {
            trackQuizAttempt(ip, id, true);
            return res.json({
                success: true,
                message: "Verification successful! Contact details unlocked.",
                data: {
                    contactName: item.contactName,
                    phone: item.phone,
                    email: item.email
                }
            });
        }

        if (!answer || typeof answer !== "string" || answer.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "Please provide an answer to the verification question."
            });
        }

        const isMatch = answer.trim().toLowerCase() === item.secretAnswer.trim().toLowerCase();

        if (isMatch) {
            trackQuizAttempt(ip, id, true);
            return res.json({
                success: true,
                message: "🎉 Ownership verified successfully! Contact details unlocked.",
                data: {
                    contactName: item.contactName,
                    phone: item.phone,
                    email: item.email
                }
            });
        } else {
            const attemptResult = trackQuizAttempt(ip, id, false);
            if (attemptResult.isLocked) {
                return res.status(429).json({
                    success: false,
                    isLocked: true,
                    message: `❌ Incorrect answer. Maximum attempts exceeded. Locked for 15 minutes.`,
                    retryAfter: attemptResult.retryAfter
                });
            } else {
                return res.status(400).json({
                    success: false,
                    isLocked: false,
                    message: `❌ Incorrect answer. ${attemptResult.remainingAttempts} attempt(s) remaining.`,
                    remainingAttempts: attemptResult.remainingAttempts
                });
            }
        }

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ================= SEARCH ITEMS =================

exports.searchItems = async(req, res) => {
    try {

        const { q, category, location } = req.query;

        let sql = "SELECT * FROM items WHERE 1=1";
        let values = [];

        if (q) {
            sql += " AND itemName LIKE ?";
            values.push(`%${q}%`);
        }

        if (category) {
            sql += " AND category = ?";
            values.push(category);
        }

        if (location) {
            sql += " AND location LIKE ?";
            values.push(`%${location}%`);
        }

        sql += " ORDER BY id DESC";

        const [rows] = await db.query(sql, values);
        const sanitized = rows.map(r => sanitizeItem(r, false));

        res.json({
            success: true,
            data: sanitized
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ================= DELETE ITEM BY ID =================

exports.deleteItem = async(req, res) => {
    try {
        const { id } = req.params;
        const currentUser = req.user;

        if (!currentUser) {
            return res.status(401).json({
                success: false,
                message: "Authentication required to delete an item."
            });
        }

        const [rows] = await db.query(
            "SELECT * FROM items WHERE id = ?", [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Item not found"
            });
        }

        const item = rows[0];

        // Strict authorization: Only the creator of the report or an admin can delete it
        if (item.userId && item.userId !== currentUser.id && currentUser.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Access Denied: You are not authorized to delete this item report."
            });
        }

        await db.query("DELETE FROM items WHERE id = ?", [id]);

        res.json({
            success: true,
            message: "Item deleted successfully"
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};