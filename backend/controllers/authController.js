const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const userModel = require("../models/userModel");

// Note: In production, store this in .env
const JWT_SECRET = process.env.JWT_SECRET || "your_super_secret_jwt_key_12345"; 

// ================= REGISTER USER =================
exports.register = async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;

        // 1. Validate input
        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: "Name, email, and password are required." });
        }

        // 2. Check if user already exists
        const existingUser = await userModel.getUserByEmail(email);
        if (existingUser) {
            return res.status(400).json({ success: false, message: "User with this email already exists." });
        }

        // 3. Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 4. Save to database
        const userData = { name, email, phone, password: hashedPassword };
        const [result] = await userModel.createUser(userData);

        res.status(201).json({ 
            success: true, 
            message: "User registered successfully!",
            userId: result.insertId
        });

    } catch (error) {
        console.error("Register Error:", error);
        res.status(500).json({ success: false, message: "Server error during registration." });
    }
};

// ================= LOGIN USER =================
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. Validate input
        if (!email || !password) {
            return res.status(400).json({ success: false, message: "Email and password are required." });
        }

        // 2. Find user
        const user = await userModel.getUserByEmail(email);
        if (!user) {
            return res.status(401).json({ success: false, message: "Invalid email or password." });
        }

        // 3. Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: "Invalid email or password." });
        }

        // 4. Generate JWT
        const payload = {
            id: user.id,
            name: user.name,
            role: user.role
        };

        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" }); // Token valid for 7 days

        // 5. Send response (excluding password)
        res.json({
            success: true,
            message: "Login successful!",
            token: token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                trustScore: user.trustScore,
                points: user.points || 0,
                badge: user.badge || "Bronze Finder"
            }
        });

    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ success: false, message: "Server error during login." });
    }
};

// ================= GET CURRENT USER PROFILE =================
exports.getMe = async (req, res) => {
    try {
        // req.user is set by the authMiddleware
        const user = await userModel.getUserById(req.user.id);
        
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        res.json({ success: true, user });
    } catch (error) {
        console.error("Get Profile Error:", error);
        res.status(500).json({ success: false, message: "Server error getting profile." });
    }
};
