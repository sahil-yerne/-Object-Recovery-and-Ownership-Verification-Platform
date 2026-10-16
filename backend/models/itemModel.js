const db = require("../config/db");

// ================= CREATE ITEM =================

exports.createItem = async(data, status) => {

    const sql = `
        INSERT INTO items
        (itemName, category, brand, color, date, location, description, contactName, phone, email, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
        data.itemName,
        data.category,
        data.brand,
        data.color,
        data.date,
        data.location,
        data.description,
        data.contactName,
        data.phone,
        data.email,
        status
    ];

    return await db.query(sql, values);
};

// ================= GET ALL ITEMS =================

exports.getAllItems = async() => {
    return await db.query(
        "SELECT * FROM items ORDER BY id DESC"
    );
};

// ================= GET ITEM BY ID =================

exports.getItemById = async(id) => {
    return await db.query(
        "SELECT * FROM items WHERE id = ?", [id]
    );
};

// ================= SEARCH ITEMS =================

exports.searchItems = async(filters) => {

    let sql = "SELECT * FROM items WHERE 1=1";
    let values = [];

    if (filters.q) {
        sql += " AND itemName LIKE ?";
        values.push(`%${filters.q}%`);
    }

    if (filters.category) {
        sql += " AND category = ?";
        values.push(filters.category);
    }

    if (filters.location) {
        sql += " AND location LIKE ?";
        values.push(`%${filters.location}%`);
    }

    if (filters.date) {
        sql += " AND DATE(date) = ?";
        values.push(filters.date);
    }

    sql += " ORDER BY id DESC";

    return await db.query(sql, values);
};