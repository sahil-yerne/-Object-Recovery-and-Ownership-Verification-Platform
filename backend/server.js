const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const dotenv = require("dotenv");
const path = require("path");

// Load .env file
dotenv.config({ path: path.join(__dirname, ".env") });

// Free port if occupied (Windows only)
if (process.platform === "win32") {
    try {
        const portToFree = process.env.PORT || 5000;
        const checkCmd = `netstat -aon | findstr /r /c:":${portToFree} *LISTENING"`;
        const stdout = require("child_process").execSync(checkCmd, { stdio: ["pipe", "pipe", "ignore"] }).toString();
        const lines = stdout.trim().split("\n");
        for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            if (pid && pid !== "0" && !isNaN(pid) && parseInt(pid) !== process.pid) {
                console.log(`🧹 Freeing port ${portToFree} (killing process ${pid})...`);
                try {
                    require("child_process").execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
                } catch (kErr) {}
            }
        }
    } catch (e) {
        // Port is already free
    }
}

// Import Database Connection (Runs connection test automatically)
const db = require("./config/db");

// Initialize Express
const app = express();

// ================= MIDDLEWARE =================
// Security headers
app.use(helmet({
    contentSecurityPolicy: false, // Disabled for CDN-based Bootstrap/Leaflet scripts
    crossOriginEmbedderPolicy: false
}));

// CORS configuration
const ALLOWED_ORIGINS = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map(s => s.trim())
    : ["*"];

app.use(cors({
    origin: function(origin, callback) {
        // Allow requests with no origin (same-origin, mobile apps, curl)
        if (!origin) return callback(null, true);
        if (ALLOWED_ORIGINS.includes("*") || ALLOWED_ORIGINS.includes(origin)) {
            return callback(null, true);
        }
        callback(null, true); // Fallback allow to avoid unexpected deployment breaks
    },
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve Uploaded Files Statically
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Serve Frontend Files Statically
app.use(express.static(path.join(__dirname, "../frontend")));

// ================= HTTP SERVER & SOCKET.IO SETUP =================
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, {
    cors: {
        origin: ALLOWED_ORIGINS.includes("*") ? "*" : ALLOWED_ORIGINS,
        methods: ["GET", "POST"]
    }
});

// Expose io instance to express app
app.set("io", io);

io.on("connection", (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // Join room for specific chat conversation
    socket.on("join_chat", (chatId) => {
        const room = `chat_${chatId}`;
        socket.join(room);
        console.log(`👤 Socket ${socket.id} joined room ${room}`);
    });

    // Leave room
    socket.on("leave_chat", (chatId) => {
        const room = `chat_${chatId}`;
        socket.leave(room);
        console.log(`👋 Socket ${socket.id} left room ${room}`);
    });

    // Handle incoming real-time message via socket
    socket.on("send_message", async (data) => {
        try {
            const { chatId, senderId, message } = data;
            if (!chatId || !message) return;

            let msgObj = null;
            try {
                const [result] = await db.query(
                    "INSERT INTO messages (chatId, senderId, message) VALUES (?, ?, ?)",
                    [chatId, senderId || 1, message]
                );
                msgObj = { id: result.insertId, chatId, senderId: senderId || 1, message, createdAt: new Date() };
            } catch (err) {
                if (!global.inMemoryMessages) global.inMemoryMessages = [];
                msgObj = { id: global.inMemoryMessages.length + 1, chatId, senderId: senderId || 1, message, createdAt: new Date() };
                global.inMemoryMessages.push(msgObj);
            }

            io.to(`chat_${chatId}`).emit("new_message", msgObj);
        } catch (e) {
            console.error("Socket send_message error:", e.message);
        }
    });

    socket.on("disconnect", () => {
        console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
});

// ================= ROUTES =================
const itemRoutes = require("./routes/itemRoutes");
const searchRoutes = require("./routes/searchRoutes");
const contactRoutes = require("./routes/contactRoutes");
const matchRoutes = require("./routes/matchRoutes");
const aiRoutes = require("./routes/aiRoutes");
const authRoutes = require("./routes/authRoutes");
const claimRoutes = require("./routes/claimRoutes");
const leaderboardRoutes = require("./routes/leaderboardRoutes");
const chatRoutes = require("./routes/chatRoutes");
const adminRoutes = require("./routes/adminRoutes");
const alertRoutes = require("./routes/alertRoutes");
const rewardsRoutes = require("./routes/rewardsRoutes");
const safeZoneRoutes = require("./routes/safeZoneRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const vaultRoutes = require("./routes/vaultRoutes");
const caseRoutes = require("./routes/caseRoutes");
const organizationRoutes = require("./routes/organizationRoutes");
const safeTagRoutes = require("./routes/safeTagRoutes");
const firRoutes = require("./routes/firRoutes");

app.use("/api", itemRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/match", matchRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/claims", claimRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/rewards", rewardsRoutes);
app.use("/api/safe-zones", safeZoneRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/vault", vaultRoutes);
app.use("/api/cases", caseRoutes);
app.use("/api/organizations", organizationRoutes);
app.use("/api/safetag", safeTagRoutes);
app.use("/api/fir", firRoutes);

// Fallback to serving index.html for single page app experience
app.get("*", (req, res, next) => {
    // If it starts with /api, pass it to 404 handler
    if (req.path.startsWith("/api")) {
        return next();
    }
    res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// Error handling middleware
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");

app.use(notFound);
app.use(errorHandler);

// ================= START SERVER =================
const PORT = process.env.PORT || 5000;
server.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT}`);
});