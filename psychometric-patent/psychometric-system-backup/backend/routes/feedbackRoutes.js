const express = require("express");
const router = express.Router();
const Feedback = require("../models/Feedback");
const authMiddleware = require("../middleware/authMiddleware");

const demoFeedback = [];

router.post("/add", authMiddleware, async (req, res) => {
    try {
        const { rating, feedback, category } = req.body;

        if (!feedback || !feedback.trim()) {
            return res.status(400).json({
                success: false,
                message: "Feedback text cannot be empty"
            });
        }

        const payload = {
            userId: req.user ? req.user.id : null,
            name: req.user ? req.user.name : (req.body.name || "Candidate"),
            rating: Math.max(1, Math.min(5, Number(rating) || 5)),
            category: category || "assessment_experience",
            feedback: feedback.trim(),
            createdAt: new Date()
        };

        if (req.app.locals.dbConnected) {
            const doc = await Feedback.create(payload);
            return res.status(201).json({
                success: true,
                message: "Thank you for your feedback!",
                feedback: doc
            });
        }

        demoFeedback.unshift(payload);
        if (demoFeedback.length > 50) demoFeedback.pop();

        return res.status(201).json({
            success: true,
            message: "Feedback submitted (dev sandbox)",
            feedback: payload
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to submit feedback",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
});

router.get("/", authMiddleware, async (req, res) => {
    try {
        const isPrivileged = req.user.role === "admin" || req.user.role === "evaluator";

        if (req.app.locals.dbConnected) {
            const query = isPrivileged ? {} : { userId: req.user.id };
            const feedbacks = await Feedback.find(query).sort({ createdAt: -1 }).limit(50);
            return res.json({
                success: true,
                count: feedbacks.length,
                feedbacks
            });
        }

        const filtered = isPrivileged
            ? demoFeedback
            : demoFeedback.filter((f) => !f.userId || String(f.userId) === String(req.user.id));

        return res.json({
            success: true,
            count: filtered.length,
            feedbacks: filtered,
            isSandbox: true
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve feedback list",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
});

module.exports = router;

