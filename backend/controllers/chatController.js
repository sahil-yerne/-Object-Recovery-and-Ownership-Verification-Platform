const db = require("../config/db");

// In-memory chat fallback if MySQL is offline
if (!global.inMemoryChats) global.inMemoryChats = [];
if (!global.inMemoryMessages) global.inMemoryMessages = [];

exports.getOrCreateChat = async (req, res) => {
    try {
        const { itemId, user1Id, user2Id } = req.body;
        const u1 = user1Id || 1;
        const u2 = user2Id || 2;

        let chatId = null;
        try {
            const [existing] = await db.query(
                "SELECT * FROM chats WHERE itemId = ? AND ((user1Id = ? AND user2Id = ?) OR (user1Id = ? AND user2Id = ?))",
                [itemId, u1, u2, u2, u1]
            );
            if (existing.length > 0) {
                chatId = existing[0].id;
            } else {
                const [result] = await db.query(
                    "INSERT INTO chats (itemId, user1Id, user2Id) VALUES (?, ?, ?)",
                    [itemId, u1, u2]
                );
                chatId = result.insertId;
            }
        } catch (err) {
            // Fallback in-memory chat
            let found = global.inMemoryChats.find(c => c.itemId == itemId && ((c.user1Id == u1 && c.user2Id == u2) || (c.user1Id == u2 && c.user2Id == u1)));
            if (found) {
                chatId = found.id;
            } else {
                chatId = global.inMemoryChats.length + 1;
                global.inMemoryChats.push({ id: chatId, itemId, user1Id: u1, user2Id: u2, createdAt: new Date() });
            }
        }

        res.json({ success: true, chatId });
    } catch (error) {
        console.error("Chat Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getMessages = async (req, res) => {
    try {
        const { chatId } = req.params;
        let messages = [];

        try {
            const [rows] = await db.query("SELECT * FROM messages WHERE chatId = ? ORDER BY id ASC", [chatId]);
            messages = rows;
        } catch (err) {
            messages = global.inMemoryMessages.filter(m => m.chatId == chatId);
        }

        res.json({ success: true, messages });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.sendMessage = async (req, res) => {
    try {
        const { chatId, senderId, message } = req.body;
        if (!chatId || !message) {
            return res.status(400).json({ success: false, message: "Chat ID and message required" });
        }

        const sId = senderId || 1;
        let msgObj = null;

        try {
            const [result] = await db.query(
                "INSERT INTO messages (chatId, senderId, message) VALUES (?, ?, ?)",
                [chatId, sId, message]
            );
            msgObj = { id: result.insertId, chatId, senderId: sId, message, createdAt: new Date() };
        } catch (err) {
            msgObj = { id: global.inMemoryMessages.length + 1, chatId, senderId: sId, message, createdAt: new Date() };
            global.inMemoryMessages.push(msgObj);
        }

        // Emit via Socket.IO if io instance attached to app
        const io = req.app.get("io");
        if (io) {
            io.to(`chat_${chatId}`).emit("new_message", msgObj);
        }

        res.json({ success: true, message: msgObj });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
