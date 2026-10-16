const db = require("../config/db");

// ================= CONTACT FORM =================

exports.submitContact = async(req, res) => {
    try {

        const data = req.body;

        const sql = `
            INSERT INTO contacts (name, email, message)
            VALUES (?, ?, ?)
        `;

        const values = [
            data.name,
            data.email,
            data.message
        ];

        await db.query(sql, values);

        res.json({
            success: true,
            message: "Message sent successfully"
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};