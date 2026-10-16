// ================= IMPORT MYSQL =================

const mysql = require("mysql2");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "../.env") });
dotenv.config();

// ================= CREATE POOL CONNECTION =================
// Pool is better than single connection for real apps

const dbUri = process.env.DATABASE_URL || process.env.MYSQL_URL;

const poolConfig = dbUri
    ? dbUri
    : {
        host: process.env.DB_HOST || process.env.MYSQLHOST || "127.0.0.1",
        user: process.env.DB_USER || process.env.MYSQLUSER || "root",
        password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : (process.env.MYSQLPASSWORD || process.env.MYSQL_ROOT_PASSWORD || ""),
        database: process.env.DB_NAME || process.env.MYSQLDATABASE || "lost_found_db",
        port: parseInt(process.env.DB_PORT || process.env.MYSQLPORT || 3306, 10),
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        multipleStatements: false
    };

const pool = mysql.createPool(poolConfig);

async function getMigrationConnection() {
    if (dbUri) {
        try {
            const urlObj = new URL(dbUri);
            urlObj.searchParams.set("multipleStatements", "true");
            return await mysql.createConnection(urlObj.toString()).promise();
        } catch (e) {
            return await mysql.createConnection(dbUri).promise();
        }
    }
    return await mysql.createConnection({
        host: process.env.DB_HOST || process.env.MYSQLHOST || "127.0.0.1",
        user: process.env.DB_USER || process.env.MYSQLUSER || "root",
        password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : (process.env.MYSQLPASSWORD || process.env.MYSQL_ROOT_PASSWORD || ""),
        database: process.env.DB_NAME || process.env.MYSQLDATABASE || "lost_found_db",
        port: parseInt(process.env.DB_PORT || process.env.MYSQLPORT || 3306, 10),
        multipleStatements: true
    }).promise();
}


// ================= PROMISE BASED POOL =================

const db = pool.promise();

// ================= TEST CONNECTION & AUTO-SYNC SCHEMA =================

let connectionCheckInProgress = false;

async function testDatabaseConnection() {
    if (connectionCheckInProgress) {
        return;
    }

    connectionCheckInProgress = true;

    try {
        const connection = await db.getConnection();
        console.log("✅ MySQL Database Connected Successfully");

        try {
            const [cols] = await connection.query("DESCRIBE items");
            const hasItemName = cols.some(c => c.Field === "itemName");
            const hasUserId = cols.some(c => c.Field === "userId");

            if (!hasItemName) {
                console.log("🔄 Updating database schema to match application structure...");
                const sqlPath = path.join(__dirname, "../../database/schema.sql");
                if (fs.existsSync(sqlPath)) {
                    // Use a temporary connection with multipleStatements for schema execution
                    const migrationConn = await getMigrationConnection();
                    const sql = fs.readFileSync(sqlPath, "utf8");
                    await migrationConn.query(sql);
                    await migrationConn.end();
                    console.log("✅ Database schema synchronized successfully!");
                }
            } else if (!hasUserId) {
                console.log("🔄 Migrating items table: adding userId column...");
                await connection.query("ALTER TABLE items ADD COLUMN userId INT DEFAULT NULL AFTER id");
                console.log("✅ Added userId column to items table.");
            }

            // Check users table columns
            try {
                const [userCols] = await connection.query("DESCRIBE users");
                const hasBanned = userCols.some(c => c.Field === "isBanned");
                if (!hasBanned) {
                    console.log("🔄 Migrating users table: adding isBanned column...");
                    await connection.query("ALTER TABLE users ADD COLUMN isBanned BOOLEAN DEFAULT FALSE AFTER badge");
                    console.log("✅ Added isBanned column to users table.");
                }
            } catch (userErr) {
                // users table error handling
            }

            // Check claims table columns for challenge & risk
            try {
                const [claimCols] = await connection.query("DESCRIBE claims");
                const colNames = claimCols.map(c => c.Field);
                if (!colNames.includes("evidenceImages")) {
                    await connection.query("ALTER TABLE claims ADD COLUMN evidenceImages JSON DEFAULT NULL AFTER proofDescription");
                }
                if (!colNames.includes("adminNotes")) {
                    await connection.query("ALTER TABLE claims ADD COLUMN adminNotes TEXT DEFAULT NULL AFTER handoverOtp");
                }
                if (!colNames.includes("reviewedBy")) {
                    await connection.query("ALTER TABLE claims ADD COLUMN reviewedBy INT DEFAULT NULL AFTER adminNotes");
                }
                if (!colNames.includes("challengeQuestion")) {
                    await connection.query("ALTER TABLE claims ADD COLUMN challengeQuestion VARCHAR(255) DEFAULT NULL AFTER handoverOtp");
                }
                if (!colNames.includes("challengeAnswer")) {
                    await connection.query("ALTER TABLE claims ADD COLUMN challengeAnswer VARCHAR(255) DEFAULT NULL AFTER challengeQuestion");
                }
                if (!colNames.includes("challengeVerified")) {
                    await connection.query("ALTER TABLE claims ADD COLUMN challengeVerified BOOLEAN DEFAULT FALSE AFTER challengeAnswer");
                }
                if (!colNames.includes("riskScore")) {
                    await connection.query("ALTER TABLE claims ADD COLUMN riskScore INT DEFAULT 0 AFTER challengeVerified");
                }
                if (!colNames.includes("riskState")) {
                    await connection.query("ALTER TABLE claims ADD COLUMN riskState ENUM('NORMAL', 'REVIEW_REQUIRED', 'SUSPICIOUS') DEFAULT 'NORMAL' AFTER riskScore");
                }
            } catch (claimErr) {
                // claims table will be created if not exists
            }

            // Ensure otpExpiresAt columns exist on claims and recovery_cases
            try {
                const [claimCols2] = await connection.query("DESCRIBE claims");
                if (!claimCols2.some(c => c.Field === "otpExpiresAt")) {
                    await connection.query("ALTER TABLE claims ADD COLUMN otpExpiresAt DATETIME DEFAULT NULL AFTER handoverOtp");
                    console.log("✅ Added otpExpiresAt to claims table.");
                }
            } catch (e) {}

            try {
                const [rcCols] = await connection.query("DESCRIBE recovery_cases");
                if (!rcCols.some(c => c.Field === "otpExpiresAt")) {
                    await connection.query("ALTER TABLE recovery_cases ADD COLUMN otpExpiresAt DATETIME DEFAULT NULL AFTER handoverOtp");
                    console.log("✅ Added otpExpiresAt to recovery_cases table.");
                }
            } catch (e) {}

            // Check ownership_vault table
            try {
                await connection.query("DESCRIBE ownership_vault");
            } catch (vErr) {
                console.log("🔄 Creating ownership_vault table...");
                await connection.query(`
                    CREATE TABLE IF NOT EXISTS ownership_vault (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        itemId INT NOT NULL,
                        ownerId INT NOT NULL,
                        serialNumber VARCHAR(255) DEFAULT NULL,
                        invoiceNumber VARCHAR(255) DEFAULT NULL,
                        receiptImages JSON DEFAULT NULL,
                        hiddenMarks TEXT DEFAULT NULL,
                        privateNotes TEXT DEFAULT NULL,
                        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        FOREIGN KEY (itemId) REFERENCES items(id) ON DELETE CASCADE,
                        FOREIGN KEY (ownerId) REFERENCES users(id) ON DELETE CASCADE
                    )
                `);
                console.log("✅ Ownership Vault table ready.");
            }

            // Check recovery_cases table
            try {
                await connection.query("DESCRIBE recovery_cases");
            } catch (rcErr) {
                console.log("🔄 Creating recovery_cases table...");
                await connection.query(`
                    CREATE TABLE IF NOT EXISTS recovery_cases (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        caseNumber VARCHAR(50) UNIQUE NOT NULL,
                        itemId INT NOT NULL,
                        claimantId INT NOT NULL,
                        custodianId INT DEFAULT NULL,
                        claimId INT DEFAULT NULL,
                        status ENUM('INITIATED', 'VERIFYING', 'CHALLENGE_ISSUED', 'VERIFIED', 'HANDOVER_PENDING', 'RECOVERED', 'CLOSED', 'DISPUTED') DEFAULT 'INITIATED',
                        matchConfidence VARCHAR(50) DEFAULT 'MEDIUM',
                        matchScore DECIMAL(5, 2) DEFAULT 0.00,
                        riskLevel ENUM('NORMAL', 'REVIEW_REQUIRED', 'SUSPICIOUS') DEFAULT 'NORMAL',
                        handoverOtp VARCHAR(10) DEFAULT NULL,
                        handoverSafeZone VARCHAR(255) DEFAULT NULL,
                        closedAt TIMESTAMP NULL DEFAULT NULL,
                        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        FOREIGN KEY (itemId) REFERENCES items(id) ON DELETE CASCADE,
                        FOREIGN KEY (claimantId) REFERENCES users(id) ON DELETE CASCADE
                    )
                `);
                console.log("✅ Recovery Cases table ready.");
            }

            // Check fraud_risk_logs table
            try {
                await connection.query("DESCRIBE fraud_risk_logs");
            } catch (frErr) {
                console.log("🔄 Creating fraud_risk_logs table...");
                await connection.query(`
                    CREATE TABLE IF NOT EXISTS fraud_risk_logs (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        caseId INT DEFAULT NULL,
                        itemId INT NOT NULL,
                        userId INT NOT NULL,
                        riskLevel ENUM('NORMAL', 'REVIEW_REQUIRED', 'SUSPICIOUS') NOT NULL DEFAULT 'NORMAL',
                        flags JSON DEFAULT NULL,
                        score INT DEFAULT 0,
                        details TEXT,
                        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (itemId) REFERENCES items(id) ON DELETE CASCADE,
                        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
                    )
                `);
                console.log("✅ Fraud Risk Logs table ready.");
            }

            // Check audit_logs table
            try {
                const [auditCols] = await connection.query("DESCRIBE audit_logs");
                const auditColNames = auditCols.map(c => c.Field);
                if (!auditColNames.includes("actorId")) {
                    await connection.query("ALTER TABLE audit_logs ADD COLUMN actorId INT DEFAULT NULL");
                }
                if (!auditColNames.includes("role")) {
                    await connection.query("ALTER TABLE audit_logs ADD COLUMN role VARCHAR(50) DEFAULT 'user'");
                }
                if (!auditColNames.includes("targetType")) {
                    await connection.query("ALTER TABLE audit_logs ADD COLUMN targetType VARCHAR(50) DEFAULT 'ITEM'");
                }
                if (!auditColNames.includes("targetId")) {
                    await connection.query("ALTER TABLE audit_logs ADD COLUMN targetId VARCHAR(100) DEFAULT NULL");
                }
                if (!auditColNames.includes("details")) {
                    await connection.query("ALTER TABLE audit_logs ADD COLUMN details JSON DEFAULT NULL");
                }
                if (!auditColNames.includes("ipAddress")) {
                    await connection.query("ALTER TABLE audit_logs ADD COLUMN ipAddress VARCHAR(100) DEFAULT NULL");
                }
                if (!auditColNames.includes("createdAt")) {
                    await connection.query("ALTER TABLE audit_logs ADD COLUMN createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
                }
            } catch (alErr) {
                console.log("🔄 Creating audit_logs table...");
                await connection.query(`
                    CREATE TABLE IF NOT EXISTS audit_logs (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        actorId INT DEFAULT NULL,
                        role VARCHAR(50) DEFAULT 'user',
                        action VARCHAR(100) NOT NULL,
                        targetType VARCHAR(50) NOT NULL,
                        targetId VARCHAR(100) DEFAULT NULL,
                        details JSON DEFAULT NULL,
                        ipAddress VARCHAR(100) DEFAULT NULL,
                        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);
                console.log("✅ Audit Logs table ready.");
            }

            // Check alerts table
            try {
                await connection.query("DESCRIBE alerts");
            } catch (alertErr) {
                console.log("🔄 Creating alerts table...");
                await connection.query(`
                    CREATE TABLE IF NOT EXISTS alerts (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        userId INT DEFAULT NULL,
                        title VARCHAR(255) NOT NULL,
                        message TEXT NOT NULL,
                        latitude DECIMAL(10, 7) DEFAULT NULL,
                        longitude DECIMAL(10, 7) DEFAULT NULL,
                        radius INT DEFAULT 5,
                        isRead BOOLEAN DEFAULT FALSE,
                        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);
                console.log("✅ Alerts table ready.");
            }

            // Check safe_zones table
            try {
                await connection.query("DESCRIBE safe_zones");
            } catch (szErr) {
                console.log("🔄 Creating safe_zones table...");
                await connection.query(`
                    CREATE TABLE IF NOT EXISTS safe_zones (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        name VARCHAR(255) NOT NULL,
                        address TEXT NOT NULL,
                        city VARCHAR(100) DEFAULT 'Chandigarh',
                        latitude DECIMAL(10, 7) NOT NULL,
                        longitude DECIMAL(10, 7) NOT NULL,
                        operatingHours VARCHAR(100) DEFAULT '24/7',
                        contactPhone VARCHAR(50) DEFAULT '+91 98765 43210',
                        isVerified BOOLEAN DEFAULT TRUE,
                        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);
                // Seed initial safe zones
                const [szRows] = await connection.query("SELECT COUNT(*) as count FROM safe_zones");
                if (szRows[0].count === 0) {
                    await connection.query(`
                        INSERT INTO safe_zones (name, address, city, latitude, longitude, operatingHours, contactPhone) VALUES
                        ('Campus Main Security Hub', 'Sector 14 University Main Gate, Chandigarh', 'Chandigarh', 30.7600, 76.7640, '24/7', '+91 98765 00001'),
                        ('Central Library Helpdesk', 'Ground Floor, A.C. Joshi Library', 'Chandigarh', 30.7620, 76.7680, '08:00 AM - 10:00 PM', '+91 98765 00002'),
                        ('Sector 17 Police Lost & Found Cell', 'Police Station Sector 17, Chandigarh', 'Chandigarh', 30.7410, 76.7845, '24/7', '+91 98765 00003'),
                        ('City Bus & Metro Transit Terminal', 'ISBT Sector 43 Customer Service', 'Chandigarh', 30.7250, 76.7450, '06:00 AM - 11:00 PM', '+91 98765 00004')
                    `);
                    console.log("✅ Seeded verified safe drop-off zones.");
                }
            }

            // Check push_subscriptions table
            try {
                await connection.query("DESCRIBE push_subscriptions");
            } catch (pushErr) {
                console.log("🔄 Creating push_subscriptions table...");
                await connection.query(`
                    CREATE TABLE IF NOT EXISTS push_subscriptions (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        userId INT DEFAULT NULL,
                        endpoint TEXT NOT NULL,
                        p256dh TEXT DEFAULT NULL,
                        auth TEXT DEFAULT NULL,
                        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);
                console.log("✅ Push subscriptions table ready.");
            }

            // Check organizations table
            try {
                await connection.query("DESCRIBE organizations");
            } catch (orgErr) {
                console.log("🔄 Creating organizations table...");
                await connection.query(`
                    CREATE TABLE IF NOT EXISTS organizations (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        name VARCHAR(255) NOT NULL,
                        slug VARCHAR(100) UNIQUE NOT NULL,
                        type ENUM('university', 'library', 'office', 'public_facility', 'transport', 'event_venue', 'other') DEFAULT 'other',
                        address TEXT,
                        city VARCHAR(100),
                        state VARCHAR(100),
                        contactEmail VARCHAR(150),
                        contactPhone VARCHAR(20),
                        logoUrl VARCHAR(500),
                        isActive BOOLEAN DEFAULT TRUE,
                        sharingPolicy ENUM('private', 'network', 'public') DEFAULT 'network',
                        retentionDays INT DEFAULT 90,
                        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                    )
                `);
                console.log("✅ Organizations table ready.");
            }

            // Seed sample organizations if empty
            try {
                const [orgRows] = await connection.query("SELECT COUNT(*) as cnt FROM organizations");
                if (orgRows[0].cnt === 0) {
                    await connection.query(`
                        INSERT INTO organizations (name, slug, type, address, city, state, contactEmail, contactPhone, sharingPolicy) VALUES
                        ('Panjab University Campus', 'pu-chandigarh', 'university', 'Sector 14, Chandigarh', 'Chandigarh', 'Chandigarh', 'lostandfound@pu.ac.in', '+91 172 2534818', 'network'),
                        ('Chandigarh International Airport (IXC)', 'ixc-airport', 'transport', 'New Civil Air Terminal, Mohali', 'Mohali', 'Punjab', 'lostproperty@ixc-airport.in', '+91 172 2242004', 'public'),
                        ('Infosys IT Park Mohali', 'infosys-mohali', 'office', 'Plot No. 1, Rajiv Gandhi Chandigarh Technology Park', 'Chandigarh', 'Chandigarh', 'security@infosys-chd.com', '+91 172 5041000', 'private')
                    `);
                    console.log("✅ Seeded verified organizations.");
                }
            } catch (seedOrgErr) {}

            // Ensure items table has organizationId column
            try {
                const [itemCols] = await connection.query("DESCRIBE items");
                if (!itemCols.some(c => c.Field === "organizationId")) {
                    await connection.query("ALTER TABLE items ADD COLUMN organizationId INT DEFAULT NULL AFTER userId");
                    console.log("✅ Added organizationId column to items table.");
                }
            } catch (itemOrgErr) {}

            // Check organization_members table
            try {
                await connection.query("DESCRIBE organization_members");
            } catch (omErr) {
                console.log("🔄 Creating organization_members table...");
                await connection.query(`
                    CREATE TABLE IF NOT EXISTS organization_members (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        organizationId INT NOT NULL,
                        userId INT NOT NULL,
                        role ENUM('member', 'staff', 'institution_admin') DEFAULT 'member',
                        isActive BOOLEAN DEFAULT TRUE,
                        joinedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE KEY unique_org_user (organizationId, userId),
                        FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE,
                        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
                    )
                `);
                console.log("✅ Organization members table ready.");
            }

            // Check notification_preferences table
            try {
                await connection.query("DESCRIBE notification_preferences");
            } catch (npErr) {
                console.log("🔄 Creating notification_preferences table...");
                await connection.query(`
                    CREATE TABLE IF NOT EXISTS notification_preferences (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        userId INT NOT NULL UNIQUE,
                        emailNotifications BOOLEAN DEFAULT TRUE,
                        pushNotifications BOOLEAN DEFAULT TRUE,
                        matchAlerts BOOLEAN DEFAULT TRUE,
                        claimUpdates BOOLEAN DEFAULT TRUE,
                        rewardAlerts BOOLEAN DEFAULT TRUE,
                        systemAnnouncements BOOLEAN DEFAULT TRUE,
                        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
                    )
                `);
                console.log("✅ Notification preferences table ready.");
            }

            // Check finder_achievements table
            try {
                await connection.query("DESCRIBE finder_achievements");
            } catch (faErr) {
                console.log("🔄 Creating finder_achievements table...");
                await connection.query(`
                    CREATE TABLE IF NOT EXISTS finder_achievements (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        userId INT NOT NULL,
                        achievementKey VARCHAR(100) NOT NULL,
                        achievementName VARCHAR(255) NOT NULL,
                        description TEXT,
                        earnedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE KEY unique_user_achievement (userId, achievementKey),
                        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
                    )
                `);
                console.log("✅ Finder achievements table ready.");
            }

            // Check matching_config table
            try {
                await connection.query("DESCRIBE matching_config");
            } catch (mcErr) {
                console.log("🔄 Creating matching_config table...");
                await connection.query(`
                    CREATE TABLE IF NOT EXISTS matching_config (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        configKey VARCHAR(100) UNIQUE NOT NULL,
                        configValue DECIMAL(5,2) NOT NULL,
                        description VARCHAR(255),
                        updatedBy INT DEFAULT NULL,
                        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                    )
                `);
                // Seed default matching weights
                const defaults = [
                    ['weight_visual', 0.30, 'Weight for visual similarity score'],
                    ['weight_text', 0.20, 'Weight for semantic text similarity score'],
                    ['weight_category', 0.20, 'Weight for category match score'],
                    ['weight_attribute', 0.15, 'Weight for brand and color match score'],
                    ['weight_location', 0.10, 'Weight for location proximity score'],
                    ['weight_temporal', 0.05, 'Weight for temporal proximity score'],
                    ['match_threshold', 25.00, 'Minimum score to show as a candidate match'],
                    ['points_report_lost', 20.00, 'Points awarded for reporting a lost item'],
                    ['points_report_found', 50.00, 'Points awarded for reporting a found item'],
                    ['points_handover', 200.00, 'Points awarded for verified handover']
                ];
                for (const [key, val, desc] of defaults) {
                    await connection.query(
                        "INSERT IGNORE INTO matching_config (configKey, configValue, description) VALUES (?, ?, ?)",
                        [key, val, desc]
                    );
                }
                console.log("✅ Matching config table ready with default weights.");
            }

            // Check asset_safetags table (Preventative QR Tag Passport)
            try {
                await connection.query("DESCRIBE asset_safetags");
            } catch (stErr) {
                console.log("🔄 Creating asset_safetags table...");
                await connection.query(`
                    CREATE TABLE IF NOT EXISTS asset_safetags (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        tagCode VARCHAR(64) UNIQUE NOT NULL,
                        userId INT NOT NULL,
                        assetName VARCHAR(150) NOT NULL,
                        category VARCHAR(100) NOT NULL,
                        brand VARCHAR(100) DEFAULT NULL,
                        color VARCHAR(100) DEFAULT NULL,
                        rewardAmount DECIMAL(10,2) DEFAULT 0.00,
                        emergencyNote TEXT DEFAULT NULL,
                        isLost BOOLEAN DEFAULT FALSE,
                        scanCount INT DEFAULT 0,
                        lastScannedAt DATETIME DEFAULT NULL,
                        lastScanLat DECIMAL(10, 7) DEFAULT NULL,
                        lastScanLng DECIMAL(10, 7) DEFAULT NULL,
                        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
                    )
                `);
                console.log("✅ Asset SafeTags table ready.");
            }

            // Check fir_declarations table (Official Police / Security FIR Export)
            try {
                await connection.query("DESCRIBE fir_declarations");
            } catch (firErr) {
                console.log("🔄 Creating fir_declarations table...");
                await connection.query(`
                    CREATE TABLE IF NOT EXISTS fir_declarations (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        firNumber VARCHAR(64) UNIQUE NOT NULL,
                        itemId INT NOT NULL,
                        declarantId INT NOT NULL,
                        authorityType ENUM('POLICE_DEPARTMENT', 'CAMPUS_SECURITY', 'AIRPORT_AUTHORITY', 'MUNICIPAL_TRANSIT') DEFAULT 'POLICE_DEPARTMENT',
                        incidentDescription TEXT NOT NULL,
                        verificationHash VARCHAR(64) NOT NULL,
                        pdfGeneratedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        status ENUM('FILED', 'VERIFIED_BY_STATION', 'RESOLVED') DEFAULT 'FILED',
                        FOREIGN KEY (itemId) REFERENCES items(id) ON DELETE CASCADE,
                        FOREIGN KEY (declarantId) REFERENCES users(id) ON DELETE CASCADE
                    )
                `);
                console.log("✅ FIR Declarations table ready.");
            }

            // Ensure master admin exists
            try {
                const bcrypt = require("bcryptjs");
                const [adminUsers] = await connection.query("SELECT id FROM users WHERE email = 'lostfound@admin.com'");
                if (adminUsers.length === 0) {
                    const salt = await bcrypt.genSalt(10);
                    const hash = await bcrypt.hash("lostfound@123456", salt);
                    await connection.query(
                        "INSERT INTO users (name, email, phone, password, role, points, trustScore, badge) VALUES (?, ?, ?, ?, 'admin', 9999, 100, 'Diamond Legend')",
                        ["Master Admin", "lostfound@admin.com", "+91 9999999999", hash]
                    );
                    console.log("✅ Master Admin account auto-seeded.");
                }
            } catch (adminErr) {
                // Ignore if users table being initialized
            }

            // Auto-purge any legacy dummy sample items from database
            try {
                await connection.query("DELETE FROM items WHERE itemName IN ('Black Wallet', 'Red Mobile Phone', 'Blue Backpack', 'Silver HP Laptop', 'Gold Wrist Watch')");
            } catch (cleanupErr) {}

        } catch (tableErr) {
                const sqlPath = path.join(__dirname, "../../database/schema.sql");
            if (fs.existsSync(sqlPath)) {
                console.log("🔄 Initializing database tables from schema.sql...");
                // Use a temporary connection with multipleStatements for schema execution
                const migrationConn = await getMigrationConnection();
                let sql = fs.readFileSync(sqlPath, "utf8");
                // Remove CREATE DATABASE and USE statements to support Railway/Render dynamic databases
                sql = sql.replace(/CREATE DATABASE[^;]+;/gi, "").replace(/USE [^;]+;/gi, "");
                await migrationConn.query(sql);
                await migrationConn.end();
                console.log("✅ Database tables initialized successfully!");

                // Seed master admin
                try {
                    const bcrypt = require("bcryptjs");
                    const salt = await bcrypt.genSalt(10);
                    const hash = await bcrypt.hash("lostfound@123456", salt);
                    await connection.query(
                        "INSERT INTO users (name, email, phone, password, role, points, trustScore, badge) VALUES (?, ?, ?, ?, 'admin', 9999, 100, 'Diamond Legend')",
                        ["Master Admin", "lostfound@admin.com", "+91 9999999999", hash]
                    );
                } catch (e) {}
            }
        }

        connection.release();
    } catch (err) {
        console.warn("⚠️ Database Connection Failed:", err.message);
        console.warn("Please ensure MySQL is running and backend/.env contains the correct DB credentials.");
        setTimeout(() => {
            connectionCheckInProgress = false;
            testDatabaseConnection();
        }, 5000);
    }
}

testDatabaseConnection();

// ================= EXPORT =================

module.exports = db;
module.exports.testDatabaseConnection = testDatabaseConnection;