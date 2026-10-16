const logger = require('../logger');

const errorHandler = (err, req, res, next) => {
    // Log error details with stack trace
    logger.error('❌ %s', err.stack || err.message);

    // Do not leak internal errors in production
    const status = err.status || 500;
    const message = err.message || 'Internal Server Error';
    res.status(status).json({
        success: false,
        message,
    });
};

module.exports = errorHandler;