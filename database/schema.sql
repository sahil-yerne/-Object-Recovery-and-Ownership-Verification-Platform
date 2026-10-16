-- ================= DATABASE SCHEMA =================
CREATE DATABASE IF NOT EXISTS lost_found_db;
USE lost_found_db;

SET FOREIGN_KEY_CHECKS = 0;

-- ================= USERS TABLE =================
DROP TABLE IF EXISTS users;
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    phone VARCHAR(20),
    password VARCHAR(255) NOT NULL,
    role ENUM('user', 'admin') DEFAULT 'user',
    trustScore INT DEFAULT 0,
    points INT DEFAULT 0,
    badge VARCHAR(50) DEFAULT 'Bronze Finder',
    isBanned BOOLEAN DEFAULT FALSE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ================= ITEMS TABLE =================
DROP TABLE IF EXISTS items;
CREATE TABLE items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT DEFAULT NULL,
    itemName VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    brand VARCHAR(100),
    color VARCHAR(100),
    date DATE NOT NULL,
    location VARCHAR(255) NOT NULL,
    latitude DECIMAL(10, 7) DEFAULT NULL,
    longitude DECIMAL(10, 7) DEFAULT NULL,
    description TEXT,
    contactName VARCHAR(150) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(150),
    status ENUM('registered', 'lost', 'found', 'matched', 'claimed', 'verification', 'verified', 'handover', 'recovered', 'returned', 'closed') NOT NULL DEFAULT 'lost',
    images JSON,
    storageDetails VARCHAR(255),
    itemCondition VARCHAR(50),
    secretQuestion VARCHAR(255) DEFAULT NULL,
    secretAnswer VARCHAR(255) DEFAULT NULL,
    embedding JSON,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
);

-- ================= OWNERSHIP VAULT TABLE (PROTECTED PRIVATE EVIDENCE) =================
DROP TABLE IF EXISTS ownership_vault;
CREATE TABLE ownership_vault (
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
);

-- ================= CLAIMS TABLE =================
DROP TABLE IF EXISTS claims;
CREATE TABLE claims (
    id INT AUTO_INCREMENT PRIMARY KEY,
    itemId INT NOT NULL,
    claimantId INT NOT NULL,
    proofDescription TEXT NOT NULL,
    evidenceImages JSON DEFAULT NULL,
    status ENUM('pending', 'approved', 'rejected', 'returned') DEFAULT 'pending',
    handoverOtp VARCHAR(10) DEFAULT NULL,
    otpExpiresAt DATETIME DEFAULT NULL,
    challengeQuestion VARCHAR(255) DEFAULT NULL,
    challengeAnswer VARCHAR(255) DEFAULT NULL,
    challengeVerified BOOLEAN DEFAULT FALSE,
    riskScore INT DEFAULT 0,
    riskState ENUM('NORMAL', 'REVIEW_REQUIRED', 'SUSPICIOUS') DEFAULT 'NORMAL',
    adminNotes TEXT DEFAULT NULL,
    reviewedBy INT DEFAULT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (itemId) REFERENCES items(id) ON DELETE CASCADE,
    FOREIGN KEY (claimantId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewedBy) REFERENCES users(id) ON DELETE SET NULL
);

-- ================= RECOVERY CASES TABLE =================
DROP TABLE IF EXISTS recovery_cases;
CREATE TABLE recovery_cases (
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
    otpExpiresAt DATETIME DEFAULT NULL,
    handoverSafeZone VARCHAR(255) DEFAULT NULL,
    closedAt TIMESTAMP NULL DEFAULT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (itemId) REFERENCES items(id) ON DELETE CASCADE,
    FOREIGN KEY (claimantId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (custodianId) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (claimId) REFERENCES claims(id) ON DELETE SET NULL
);

-- ================= FRAUD RISK LOGS TABLE =================
DROP TABLE IF EXISTS fraud_risk_logs;
CREATE TABLE fraud_risk_logs (
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
);

-- ================= AUDIT LOGS TABLE =================
DROP TABLE IF EXISTS audit_logs;
CREATE TABLE audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    actorId INT DEFAULT NULL,
    role VARCHAR(50) DEFAULT 'user',
    action VARCHAR(100) NOT NULL,
    targetType VARCHAR(50) NOT NULL,
    targetId VARCHAR(100) DEFAULT NULL,
    details JSON DEFAULT NULL,
    ipAddress VARCHAR(100) DEFAULT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ================= POINT TRANSACTIONS TABLE =================
DROP TABLE IF EXISTS point_transactions;
CREATE TABLE point_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL,
    points INT NOT NULL,
    reason VARCHAR(255) NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

-- ================= CONTACTS TABLE =================
DROP TABLE IF EXISTS contacts;
CREATE TABLE contacts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ================= INDEXES (FOR FAST SEARCH) =================
CREATE INDEX idx_itemName ON items(itemName);
CREATE INDEX idx_category ON items(category);
CREATE INDEX idx_location ON items(location);
CREATE INDEX idx_status ON items(status);
CREATE INDEX idx_brand ON items(brand);
CREATE INDEX idx_color ON items(color);
CREATE INDEX idx_caseNumber ON recovery_cases(caseNumber);

-- ================= CHATS TABLE =================
DROP TABLE IF EXISTS chats;
CREATE TABLE chats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    itemId INT NOT NULL,
    user1Id INT NOT NULL,
    user2Id INT NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ================= MESSAGES TABLE =================
DROP TABLE IF EXISTS messages;
CREATE TABLE messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    chatId INT NOT NULL,
    senderId INT NOT NULL,
    message TEXT NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ================= ALERTS TABLE =================
DROP TABLE IF EXISTS alerts;
CREATE TABLE alerts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT DEFAULT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    latitude DECIMAL(10, 7) DEFAULT NULL,
    longitude DECIMAL(10, 7) DEFAULT NULL,
    radius INT DEFAULT 5,
    isRead BOOLEAN DEFAULT FALSE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ================= ORGANIZATIONS TABLE (Multi-Institution Support) =================
DROP TABLE IF EXISTS organizations;
CREATE TABLE organizations (
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
);

-- ================= ORGANIZATION MEMBERS TABLE =================
DROP TABLE IF EXISTS organization_members;
CREATE TABLE organization_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    organizationId INT NOT NULL,
    userId INT NOT NULL,
    role ENUM('member', 'staff', 'institution_admin') DEFAULT 'member',
    isActive BOOLEAN DEFAULT TRUE,
    joinedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_org_user (organizationId, userId),
    FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

-- ================= NOTIFICATION PREFERENCES TABLE =================
DROP TABLE IF EXISTS notification_preferences;
CREATE TABLE notification_preferences (
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
);

-- ================= FINDER ACHIEVEMENTS TABLE =================
DROP TABLE IF EXISTS finder_achievements;
CREATE TABLE finder_achievements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL,
    achievementKey VARCHAR(100) NOT NULL,
    achievementName VARCHAR(255) NOT NULL,
    description TEXT,
    earnedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_achievement (userId, achievementKey),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

-- ================= MATCHING WEIGHTS CONFIG TABLE =================
DROP TABLE IF EXISTS matching_config;
CREATE TABLE matching_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    configKey VARCHAR(100) UNIQUE NOT NULL,
    configValue DECIMAL(5,2) NOT NULL,
    description VARCHAR(255),
    updatedBy INT DEFAULT NULL,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Seed default matching weights
INSERT IGNORE INTO matching_config (configKey, configValue, description) VALUES
    ('weight_visual', 0.30, 'Weight for visual similarity score'),
    ('weight_text', 0.20, 'Weight for semantic text similarity score'),
    ('weight_category', 0.20, 'Weight for category match score'),
    ('weight_attribute', 0.15, 'Weight for brand and color match score'),
    ('weight_location', 0.10, 'Weight for location proximity score'),
    ('weight_temporal', 0.05, 'Weight for temporal proximity score'),
    ('match_threshold', 25.00, 'Minimum score to show as a candidate match'),
    ('points_report_lost', 20.00, 'Points awarded for reporting a lost item'),
    ('points_report_found', 50.00, 'Points awarded for reporting a found item'),
    ('points_handover', 200.00, 'Points awarded for verified handover');

SET FOREIGN_KEY_CHECKS = 1;

-- ================= DONE =================
SELECT 'Database Setup Complete 🚀' AS message;