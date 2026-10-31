/**
 * Centralized Error Handling Middleware
 */

const notFoundHandler = (req, res, next) => {
    res.status(404).json({
        success: false,
        message: `Resource not found: ${req.method} ${req.originalUrl}`
    });
};

const globalErrorHandler = (err, req, res, next) => {
    const statusCode = err.status || err.statusCode || 500;
    const isDev = process.env.NODE_ENV === "development";

    // Standardized log output
    console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, err.message || err);

    res.status(statusCode).json({
        success: false,
        message: err.message || "Internal server error occurred",
        errorCode: err.code || "INTERNAL_ERROR",
        stack: isDev ? err.stack : undefined
    });
};

module.exports = {
    notFoundHandler,
    globalErrorHandler
};
