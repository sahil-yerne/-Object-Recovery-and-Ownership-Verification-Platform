const db = require("../config/db");

// ================= CREATE USER =================
exports.createUser = async (data) => {
    const sql = `
        INSERT INTO users (name, email, phone, password)
        VALUES (?, ?, ?, ?)
    `;
    const values = [data.name, data.email, data.phone || null, data.password];
    
    // Returns [result, fields] from mysql2/promise
    return await db.query(sql, values);
};

// ================= GET USER BY EMAIL =================
exports.getUserByEmail = async (email) => {
    const sql = `SELECT * FROM users WHERE email = ?`;
    const [rows] = await db.query(sql, [email]);
    return rows[0]; // Returns the user object or undefined
};

// ================= GET USER BY ID =================
exports.getUserById = async (id) => {
    const sql = `SELECT id, name, email, phone, role, trustScore, points, badge, createdAt FROM users WHERE id = ?`;
    const [rows] = await db.query(sql, [id]);
    return rows[0]; // Excludes password
};
