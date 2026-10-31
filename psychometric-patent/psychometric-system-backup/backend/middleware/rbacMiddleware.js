/**
 * Role-Based Access Control (RBAC) Middleware
 */

const authorize = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required before checking permissions"
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Forbidden: role '${req.user.role}' is not authorized to access this resource`
            });
        }

        next();
    };
};

/**
 * Ensures a user can only access their own resources unless they have admin/evaluator privileges
 */
const checkOwnership = (resourceUserIdExtractor) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        // Admins and evaluators have global read permissions where permitted
        if (req.user.role === "admin" || req.user.role === "evaluator") {
            return next();
        }

        const resourceUserId = typeof resourceUserIdExtractor === "function" 
            ? resourceUserIdExtractor(req)
            : req.params[resourceUserIdExtractor || "userId"] || req.body[resourceUserIdExtractor || "userId"];

        if (resourceUserId && resourceUserId.toString() !== req.user.id.toString()) {
            return res.status(403).json({
                success: false,
                message: "Forbidden: You cannot access or modify another user's assessment or results"
            });
        }

        next();
    };
};

module.exports = {
    authorize,
    checkOwnership
};
