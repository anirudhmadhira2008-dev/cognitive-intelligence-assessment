const jwt = require("jsonwebtoken");
const User = require("../models/User");

const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization || (req.query && req.query.token ? `Bearer ${req.query.token}` : null);

        if (!authHeader) {
            return res.status(401).json({
                success: false,
                message: "Authentication token required"
            });
        }

        // Support both standard "Bearer <token>" and raw token format
        let token = authHeader;
        if (authHeader.startsWith("Bearer ")) {
            token = authHeader.slice(7).trim();
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Malformed authorization token"
            });
        }

        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (jwtErr) {
            if (jwtErr.name === "TokenExpiredError") {
                return res.status(401).json({
                    success: false,
                    message: "Authentication token has expired. Please log in again."
                });
            }
            return res.status(401).json({
                success: false,
                message: "Invalid authentication token"
            });
        }

        if (!process.env.JWT_SECRET) {
            return res.status(500).json({
                success: false,
                message: "Authentication is not configured"
            });
        }

        // Verify user against database if connection is active
        if (req.app.locals.dbConnected) {
            const user = await User.findById(decoded.id);

            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: "User associated with token no longer exists"
                });
            }

            if (!user.isActive || user.accountStatus === "suspended") {
                return res.status(403).json({
                    success: false,
                    message: "User account is inactive or suspended"
                });
            }

            req.user = {
                id: user._id.toString(),
                email: user.email,
                name: user.name,
                role: user.role,
                rollNumber: user.rollNumber,
                college: user.college,
                course: user.course,
                branch: user.branch,
                year: user.year
            };
        } else if (req.app.locals.allowSandbox) {
            req.user = {
                id: decoded.id,
                email: decoded.email || "demo@example.com",
                name: decoded.name || "Candidate",
                role: decoded.role || "student"
            };
        } else {
            return res.status(503).json({
                success: false,
                message: "Database unavailable. Authentication cannot be completed."
            });
        }

        next();
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Authentication verification error",
            error: process.env.NODE_ENV === "development" ? err.message : undefined
        });
    }
};

module.exports = authMiddleware;