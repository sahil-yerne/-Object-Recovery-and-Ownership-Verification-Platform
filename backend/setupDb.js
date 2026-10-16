const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config({ path: path.join(__dirname, ".env") });

async function setup() {
    console.log("⏳ Connecting to MySQL server to initialize database...");
    
    try {
        // Connect without database parameter first
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || "localhost",
            user: process.env.DB_USER || "root",
            password: process.env.DB_PASSWORD || "",
            multipleStatements: true // Allows running entire schema.sql at once
        });

        console.log("📖 Reading database/schema.sql...");
        const schemaPath = path.join(__dirname, "../database/schema.sql");
        const schemaSql = fs.readFileSync(schemaPath, "utf8");

        console.log("🚀 Executing schema.sql queries...");
        await connection.query(schemaSql);
        
        console.log("✅ MySQL Database Setup Completed Successfully! 🚀");
        await connection.end();
        process.exit(0);
    } catch (error) {
        console.error("❌ Database Setup Failed:", error.message);
        process.exit(1);
    }
}

setup();
