const bcrypt = require("bcryptjs");
const db = require("./db");

async function seedAdmin() {
    try {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash("lostfound@123456", salt);
        const adminEmail = "lostfound@admin.com";

        const [existing] = await db.query("SELECT * FROM users WHERE email = ?", [adminEmail]);
        if (existing.length > 0) {
            await db.query(
                "UPDATE users SET password = ?, role = 'admin', name = 'Master Admin', points = 9999, trustScore = 100, badge = 'Diamond Legend' WHERE email = ?",
                [hash, adminEmail]
            );
            console.log("✅ Admin account updated successfully: lostfound@admin.com");
        } else {
            await db.query(
                "INSERT INTO users (name, email, phone, password, role, points, trustScore, badge) VALUES (?, ?, ?, ?, 'admin', 9999, 100, 'Diamond Legend')",
                ["Master Admin", adminEmail, "+91 9999999999", hash]
            );
            console.log("✅ Admin account created successfully: lostfound@admin.com");
        }
        process.exit(0);
    } catch (err) {
        console.error("❌ Seed Admin Error:", err.message);
        process.exit(1);
    }
}

seedAdmin();
