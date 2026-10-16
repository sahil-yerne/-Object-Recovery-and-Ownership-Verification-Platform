// ================= ADMIN ROLE AUTHORIZATION MIDDLEWARE =================
// Must be used AFTER authMiddleware — verifies that the authenticated user has admin role

const requireAdmin = (req, res, next) => {
    // req.user is set by authMiddleware
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: "Authentication required. Please login first."
        });
    }

    if (req.user.role !== "admin") {
        return res.status(403).json({
            success: false,
            message: "Access Denied: Administrator privileges are required for this action."
        });
    }

    next();
};

module.exports = requireAdmin;
