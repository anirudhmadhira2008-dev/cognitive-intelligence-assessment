const Result = require("../models/Result");

const devResultsMemory = [];

// ==========================================
// GET MY RESULTS
// ==========================================
const getMyResults = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }

        if (req.app.locals.dbConnected) {
            const results = await Result.find({ userId: req.user.id }).sort({ createdAt: -1 });
            return res.json({
                success: true,
                count: results.length,
                results
            });
        }

        const filtered = devResultsMemory.filter((r) => !r.userId || r.userId === req.user.id);
        return res.json({
            success: true,
            count: filtered.length,
            results: filtered,
            isSandbox: true
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve results",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

// ==========================================
// GET SINGLE RESULT BY ID
// ==========================================
const getResultById = async (req, res) => {
    try {
        const { id } = req.params;

        if (req.app.locals.dbConnected) {
            const result = await Result.findById(id);
            if (!result) {
                return res.status(404).json({ success: false, message: "Result not found" });
            }

            if (req.user.role !== "admin" && req.user.role !== "evaluator") {
                if (result.userId.toString() !== req.user.id.toString()) {
                    return res.status(403).json({
                        success: false,
                        message: "Forbidden: You are not authorized to view this result"
                    });
                }
            }

            return res.json({ success: true, result });
        }

        const devMatch = devResultsMemory.find((r) => r._id === id);
        if (devMatch) return res.json({ success: true, result: devMatch, isSandbox: true });

        return res.status(404).json({ success: false, message: "Result not found in sandbox" });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch result",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

// ==========================================
// ADD RESULT (ADMIN / INTERNAL COMPATIBILITY)
// ==========================================
const addResult = async (req, res) => {
    try {
        if (!req.user || (req.user.role !== "admin" && req.user.role !== "evaluator")) {
            return res.status(403).json({
                success: false,
                message: "Direct result creation is restricted. Results are calculated server-side upon assessment submission."
            });
        }

        const userId = req.body.userId || (req.user ? req.user.id : null);
        const payload = {
            userId,
            name: req.body.name || req.user?.name || "Candidate",
            score: Number(req.body.score || 0),
            total: Number(req.body.total || 0),
            cheatScore: Number(req.body.cheatScore || 0),
            voiceScore: Number(req.body.voiceScore || 0),
            knowledgeScore: Math.round(((req.body.score || 0) / Math.max(1, req.body.total || 1)) * 100),
            integrityScore: Math.max(0, 100 - Number(req.body.cheatScore || 0)),
            communicationScore: Number(req.body.voiceScore || 0),
            createdAt: new Date()
        };

        if (req.app.locals.dbConnected && userId) {
            const result = await Result.create(payload);
            return res.status(201).json({ success: true, result });
        }

        const devResult = { ...payload, _id: `dev-res-${Date.now()}` };
        devResultsMemory.unshift(devResult);
        if (devResultsMemory.length > 50) devResultsMemory.pop();

        return res.status(201).json({ success: true, result: devResult, isSandbox: true });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to save result",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};


// ==========================================
// GET ALL RESULTS (ADMIN / EVALUATOR ONLY)
// ==========================================
const getAllResults = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const skip = (page - 1) * limit;

        if (req.app.locals.dbConnected) {
            const [results, total] = await Promise.all([
                Result.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
                Result.countDocuments()
            ]);

            return res.json({
                success: true,
                count: results.length,
                total,
                page,
                totalPages: Math.ceil(total / limit),
                results
            });
        }

        return res.json({
            success: true,
            count: devResultsMemory.length,
            total: devResultsMemory.length,
            page: 1,
            totalPages: 1,
            results: devResultsMemory,
            isSandbox: true
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve results list",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

module.exports = {
    getMyResults,
    getResultById,
    addResult,
    getAllResults
};
