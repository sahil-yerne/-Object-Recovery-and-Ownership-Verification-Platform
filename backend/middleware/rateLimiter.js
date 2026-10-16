// ================= RATE LIMITER MIDDLEWARE =================

const memoryStore = new Map();

// Helper to clean expired entries every 10 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, record] of memoryStore.entries()) {
        if (now > record.resetTime) {
            memoryStore.delete(key);
        }
    }
}, 10 * 60 * 1000);

/**
 * Creates a rate limiter middleware
 * @param {Object} options
 * @param {number} options.windowMs Time window in milliseconds
 * @param {number} options.max Maximum requests per window
 * @param {string} options.message Error message
 * @param {Function} [options.keyGenerator] Custom key generator function
 */
function createLimiter(options) {
    const windowMs = options.windowMs || 15 * 60 * 1000;
    const max = options.max || 10;
    const message = options.message || "Too many requests. Please try again later.";
    const keyGenerator = options.keyGenerator || (req => req.ip || req.connection.remoteAddress || "global");

    return (req, res, next) => {
        const key = keyGenerator(req);
        const now = Date.now();
        const record = memoryStore.get(key);

        if (!record || now > record.resetTime) {
            memoryStore.set(key, {
                count: 1,
                resetTime: now + windowMs
            });
            return next();
        }

        if (record.count >= max) {
            const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000);
            res.setHeader("Retry-After", retryAfterSeconds);
            return res.status(429).json({
                success: false,
                isLocked: true,
                message: `${message} Retry after ${Math.ceil(retryAfterSeconds / 60)} minute(s).`,
                retryAfter: retryAfterSeconds
            });
        }

        record.count++;
        next();
    };
}

// 1. Auth Rate Limiter (Max 100 per 15 minutes)
const authLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: "Too many login/registration attempts from this IP."
});

// 2. Report Submission Limiter (Max 60 reports per 10 minutes, user or IP keyed)
const reportLimiter = createLimiter({
    windowMs: 10 * 60 * 1000,
    max: 60,
    keyGenerator: (req) => {
        if (req.user && req.user.id) return `user_${req.user.id}`;
        return req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress || "global";
    },
    message: "Report submission rate limit reached. Please wait before posting another item."
});

// 3. Quiz Verification Attempt Tracker (Max 3 failed attempts per item per IP)
const quizAttemptsStore = new Map();

function trackQuizAttempt(ip, itemId, isSuccess) {
    const key = `quiz_${ip}_${itemId}`;
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 mins lockout

    if (isSuccess) {
        quizAttemptsStore.delete(key);
        return { isLocked: false, remainingAttempts: 3 };
    }

    let record = quizAttemptsStore.get(key);
    if (!record || now > record.resetTime) {
        record = { count: 1, resetTime: now + windowMs };
    } else {
        record.count++;
    }

    quizAttemptsStore.set(key, record);

    if (record.count >= 3) {
        const retryAfter = Math.ceil((record.resetTime - now) / 1000);
        return { isLocked: true, retryAfter, remainingAttempts: 0 };
    }

    return { isLocked: false, remainingAttempts: 3 - record.count };
}

function checkQuizLock(ip, itemId) {
    const key = `quiz_${ip}_${itemId}`;
    const record = quizAttemptsStore.get(key);
    const now = Date.now();

    if (record && record.count >= 3) {
        if (now <= record.resetTime) {
            const retryAfter = Math.ceil((record.resetTime - now) / 1000);
            return { isLocked: true, retryAfter };
        }
        // Expired
        quizAttemptsStore.delete(key);
    }

    return { isLocked: false, remainingAttempts: record ? Math.max(0, 3 - record.count) : 3 };
}

module.exports = {
    authLimiter,
    reportLimiter,
    trackQuizAttempt,
    checkQuizLock
};
