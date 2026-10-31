const User = require("../models/User");
const AssessmentSession = require("../models/AssessmentSession");
const Result = require("../models/Result");
const Question = require("../models/Question");
const { QUESTION_BANK } = require("../services/adaptiveEngine");

// ==========================================
// ADMIN DASHBOARD OVERVIEW METRICS
// ==========================================
const getOverview = async (req, res) => {
    try {
        if (!req.app.locals.dbConnected) {
            return res.json({
                success: true,
                isSandbox: true,
                metrics: {
                    totalCandidates: 12,
                    totalAssessments: 8,
                    completedAssessments: 7,
                    averageReadiness: 76,
                    averageIntegrity: 88,
                    flaggedIncidents: 3
                },
                recentActivity: []
            });
        }

        const [
            totalCandidates,
            totalAssessments,
            completedAssessments,
            allResults,
            recentSessions
        ] = await Promise.all([
            User.countDocuments({ role: "student" }),
            AssessmentSession.countDocuments(),
            AssessmentSession.countDocuments({ status: "completed" }),
            Result.find().select("professionalReadiness integrityScore knowledgeScore decision"),
            AssessmentSession.find().sort({ createdAt: -1 }).limit(5).select("candidate report status createdAt")
        ]);

        // Calculate averages
        let avgReadiness = 0;
        let avgIntegrity = 100;
        let flaggedCount = 0;

        if (allResults.length > 0) {
            const sumReadiness = allResults.reduce((acc, r) => acc + (r.professionalReadiness || 0), 0);
            const sumIntegrity = allResults.reduce((acc, r) => acc + (r.integrityScore || 0), 0);
            avgReadiness = Math.round(sumReadiness / allResults.length);
            avgIntegrity = Math.round(sumIntegrity / allResults.length);
            flaggedCount = allResults.filter((r) => r.decision === "Review Required" || r.integrityScore < 60).length;
        }

        return res.json({
            success: true,
            metrics: {
                totalCandidates,
                totalAssessments,
                completedAssessments,
                averageReadiness: avgReadiness,
                averageIntegrity: avgIntegrity,
                flaggedIncidents: flaggedCount
            },
            recentActivity: recentSessions
        });
    } catch (error) {
        console.error("Admin overview error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to load admin overview",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

// ==========================================
// LIST CANDIDATES (STRICT PRIVACY: NAME & ROLL NUMBER ONLY)
// ==========================================
const getCandidates = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const search = (req.query.search || "").trim();
        const skip = (page - 1) * limit;

        const query = { role: "student" };
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: "i" } },
                { rollNumber: { $regex: search, $options: "i" } }
            ];
        }

        if (req.app.locals.dbConnected) {
            // Strict Privacy Projection: Administrator may see participant name and roll number only for identification.
            // Prohibited: email, phone, address, date of birth, password, tokens, photos, biometrics.
            const [candidates, total] = await Promise.all([
                User.find(query)
                    .select("name rollNumber accountStatus isActive createdAt")
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                User.countDocuments(query)
            ]);

            // Ensure no extra personal data is ever emitted
            const sanitizedCandidates = candidates.map((c) => ({
                _id: c._id,
                name: c.name,
                rollNumber: c.rollNumber || "—",
                accountStatus: c.accountStatus || (c.isActive ? "active" : "suspended"),
                joinedAt: c.createdAt
            }));

            return res.json({
                success: true,
                count: sanitizedCandidates.length,
                total,
                page,
                totalPages: Math.ceil(total / limit),
                candidates: sanitizedCandidates
            });
        }

        return res.json({
            success: true,
            count: 1,
            total: 1,
            page: 1,
            totalPages: 1,
            candidates: [
                {
                    _id: "demo-cand-1",
                    name: "Candidate",
                    rollNumber: "ENG-2026-001",
                    accountStatus: "active"
                }
            ],
            isSandbox: true
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to list candidates",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

// ==========================================
// LIST SESSIONS FOR ADMIN AUDIT (ANONYMIZED)
// ==========================================
const getSessions = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const skip = (page - 1) * limit;
        const decisionFilter = req.query.decision;

        const query = {};
        if (decisionFilter) {
            query["report.decision"] = decisionFilter;
        }

        if (req.app.locals.dbConnected) {
            // Strict Privacy Projection: Anonymized response sessions
            // Does not project candidate name or email linked to individual responses
            const [sessions, total] = await Promise.all([
                AssessmentSession.find(query)
                    .select("status setup.role report.readiness report.integrity report.decision completedAt createdAt")
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                AssessmentSession.countDocuments(query)
            ]);

            const anonymizedSessions = sessions.map((s, idx) => ({
                _id: s._id,
                anonymousId: `RESP-${String(s._id).slice(-6).toUpperCase()}`,
                targetRole: s.setup?.role || "Software Developer",
                readiness: s.report?.readiness || 0,
                integrity: s.report?.integrity || 100,
                decision: s.report?.decision || "Recommended",
                completedAt: s.completedAt || s.createdAt,
                status: s.status
            }));

            return res.json({
                success: true,
                count: anonymizedSessions.length,
                total,
                page,
                totalPages: Math.ceil(total / limit),
                sessions: anonymizedSessions
            });
        }

        return res.json({
            success: true,
            count: 0,
            total: 0,
            page: 1,
            totalPages: 1,
            sessions: [],
            isSandbox: true
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch session audit list",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

// ==========================================
// SESSION DRILL-DOWN INSPECTION (ANONYMIZED)
// ==========================================
const getSessionDetail = async (req, res) => {
    try {
        const { id } = req.params;

        if (req.app.locals.dbConnected) {
            // Sanitize session to strip candidate PII (name, email, phone, photos)
            const session = await AssessmentSession.findById(id)
                .select("-candidate.email -candidate.name -candidate.rollNumber -candidate.college -candidate.branch -identity.referenceImage -userId")
                .lean();

            if (!session) {
                return res.status(404).json({ success: false, message: "Assessment session not found" });
            }

            session.anonymousId = `RESP-${String(session._id).slice(-6).toUpperCase()}`;
            return res.json({ success: true, session });
        }

        return res.status(404).json({ success: false, message: "Session not found" });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to load session details",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

// ==========================================
// UPDATE CANDIDATE ACCOUNT STATUS
// ==========================================
const updateCandidateStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { accountStatus, isActive } = req.body;

        if (req.app.locals.dbConnected) {
            const user = await User.findById(id);
            if (!user) {
                return res.status(404).json({ success: false, message: "Candidate not found" });
            }

            if (accountStatus) user.accountStatus = accountStatus;
            if (isActive !== undefined) user.isActive = Boolean(isActive);

            await user.save();

            return res.json({
                success: true,
                message: "Candidate account status updated",
                user: { id: user._id, name: user.name, accountStatus: user.accountStatus, isActive: user.isActive }
            });
        }

        return res.json({ success: true, message: "Status updated (dev sandbox)" });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to update candidate status",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

// ==========================================
// SEED QUESTION REPOSITORY
// ==========================================
const seedQuestions = async (req, res) => {
    try {
        if (!req.app.locals.dbConnected) {
            return res.json({
                success: true,
                message: "Questions available in memory in sandbox mode",
                count: QUESTION_BANK.length
            });
        }

        let insertedCount = 0;
        for (const q of QUESTION_BANK) {
            const exists = await Question.findOne({ questionId: q.questionId });
            if (!exists) {
                await Question.create(q);
                insertedCount++;
            }
        }

        return res.json({
            success: true,
            message: `Question repository verified. ${insertedCount} new questions seeded.`,
            totalInBank: QUESTION_BANK.length
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to seed questions",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

// ==========================================
// QUESTION MANAGEMENT (ADMIN CRUD)
// ==========================================
const listQuestions = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const domain = (req.query.domain || "").trim();
        const difficulty = req.query.difficulty ? Number(req.query.difficulty) : null;
        const search = (req.query.search || "").trim();
        const skip = (page - 1) * limit;

        if (req.app.locals.dbConnected) {
            const query = {};
            if (domain) query.domain = domain;
            if (difficulty) query.difficulty = difficulty;
            if (search) {
                query.$or = [
                    { question: { $regex: search, $options: "i" } },
                    { questionId: { $regex: search, $options: "i" } }
                ];
            }

            const [questions, total] = await Promise.all([
                Question.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
                Question.countDocuments(query)
            ]);

            return res.json({
                success: true,
                count: questions.length,
                total,
                page,
                totalPages: Math.ceil(total / limit),
                questions
            });
        }

        let filtered = QUESTION_BANK;
        if (domain) filtered = filtered.filter((q) => q.domain === domain);
        if (difficulty) filtered = filtered.filter((q) => q.difficulty === difficulty);
        if (search) filtered = filtered.filter((q) => q.question.toLowerCase().includes(search.toLowerCase()));

        return res.json({
            success: true,
            count: filtered.length,
            total: filtered.length,
            page: 1,
            totalPages: 1,
            questions: filtered,
            isSandbox: true
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to list questions",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

const createQuestion = async (req, res) => {
    try {
        const { questionId, domain, difficulty, type, bloom, competency, question, options, answer, concepts, explanation } = req.body;

        if (!questionId || !question || !options || answer === undefined) {
            return res.status(400).json({
                success: false,
                message: "questionId, question, options, and answer index are required"
            });
        }

        const payload = {
            questionId,
            domain: domain || "General",
            difficulty: Number(difficulty) || 2,
            type: type || "mcq",
            bloom: bloom || "Apply",
            competency: competency || "Knowledge",
            question: question.trim(),
            options: Array.isArray(options) ? options : [],
            answer: Number(answer),
            concepts: Array.isArray(concepts) ? concepts : [],
            explanation: explanation || "",
            createdBy: req.user ? req.user.id : null
        };

        if (req.app.locals.dbConnected) {
            const created = await Question.create(payload);
            return res.status(201).json({ success: true, message: "Question created successfully", question: created });
        }

        return res.status(201).json({ success: true, message: "Question created (sandbox)", question: payload, isSandbox: true });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to create question",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

const getAuditLogs = async (req, res) => {
    try {
        const AuditLog = require("../models/AuditLog");
        const { getMemoryAuditLogs } = require("../services/auditLogger");
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const skip = (page - 1) * limit;

        if (req.app.locals.dbConnected) {
            const [logs, total] = await Promise.all([
                AuditLog.find().sort({ timestamp: -1 }).skip(skip).limit(limit),
                AuditLog.countDocuments()
            ]);
            return res.json({ success: true, count: logs.length, total, page, totalPages: Math.ceil(total / limit), logs });
        }

        const logs = getMemoryAuditLogs();
        return res.json({ success: true, count: logs.length, total: logs.length, page: 1, totalPages: 1, logs, isSandbox: true });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to fetch audit logs" });
    }
};

// ==========================================
// PHASE 6: RESEARCH COHORT & TEST 1 VS TEST 2 ANALYTICS
// ==========================================
function calculateStats(scores) {
    if (!scores || scores.length === 0) {
        return { n: 0, mean: 0, stdDev: 0, min: 0, max: 0, q1: 0, median: 0, q3: 0 };
    }
    const n = scores.length;
    const sorted = [...scores].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const mean = Math.round((sum / n) * 10) / 10;
    const variance = sorted.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (n > 1 ? n - 1 : 1);
    const stdDev = Math.round(Math.sqrt(variance) * 10) / 10;

    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const median = sorted[Math.floor(n / 2)];
    const q1 = sorted[Math.floor(n * 0.25)];
    const q3 = sorted[Math.floor(n * 0.75)];

    return { n, mean, stdDev, min, max, q1, median, q3 };
}

const getCohortAnalytics = async (req, res) => {
    try {
        if (!req.app.locals.dbConnected) {
            return res.json({
                success: true,
                isSandbox: true,
                totalCandidates: 25,
                totalAttempts: 32,
                completedAttempts: 28,
                completionRate: 87.5,
                test1Stats: { n: 16, mean: 74.2, stdDev: 8.5, min: 58, max: 92, q1: 68, median: 74, q3: 80 },
                test2Stats: { n: 12, mean: 79.8, stdDev: 7.2, min: 65, max: 94, q1: 75, median: 80, q3: 85 },
                pairedCohortShift: { n: 10, meanDelta: 5.6, positiveCount: 8, negativeCount: 2 },
                cognitiveDimensions: {
                    knowledge: 76,
                    reasoning: 74,
                    communication: 72,
                    adaptability: 68,
                    integrity: 94,
                    practicality: 70
                },
                competencyInsights: {
                    strongest: "Knowledge Retrieval & Integrity",
                    gaps: "Architectural Adaptability"
                }
            });
        }

        const [totalCandidates, totalAttempts, completedSessions] = await Promise.all([
            User.countDocuments({ role: "student" }),
            AssessmentSession.countDocuments(),
            AssessmentSession.find({ status: { $in: ["completed", "SUBMITTED", "COMPLETED"] } })
                .select("userId testId attemptNumber report createdAt")
                .lean()
        ]);

        const completedCount = completedSessions.length;
        const completionRate = totalAttempts > 0 ? Math.round((completedCount / totalAttempts) * 1000) / 10 : 0;

        // Segregate by Test 1 vs Test 2
        const test1Scores = [];
        const test2Scores = [];
        const userTest1Map = new Map();
        const userTest2Map = new Map();

        // Dimensions
        let totalKnowledge = 0;
        let totalReasoning = 0;
        let totalCommunication = 0;
        let totalAdaptability = 0;
        let totalIntegrity = 0;

        for (const s of completedSessions) {
            const score = s.report?.readiness || 0;
            const tId = (s.testId || "TEST-1").toUpperCase();

            if (tId === "TEST-1") {
                test1Scores.push(score);
                if (s.userId) userTest1Map.set(String(s.userId), score);
            } else if (tId === "TEST-2") {
                test2Scores.push(score);
                if (s.userId) userTest2Map.set(String(s.userId), score);
            }

            totalKnowledge += s.report?.knowledge || 0;
            totalReasoning += s.report?.reasoning || 0;
            totalCommunication += s.report?.communication || 0;
            totalAdaptability += s.report?.adaptability || 0;
            totalIntegrity += s.report?.integrity !== undefined ? s.report.integrity : 100;
        }

        const test1Stats = calculateStats(test1Scores);
        const test2Stats = calculateStats(test2Scores);

        // Calculate Paired Delta for users taking both Test 1 & Test 2
        const pairedDeltas = [];
        let positiveCount = 0;
        let negativeCount = 0;

        userTest1Map.forEach((t1Score, uId) => {
            if (userTest2Map.has(uId)) {
                const t2Score = userTest2Map.get(uId);
                const delta = t2Score - t1Score;
                pairedDeltas.push(delta);
                if (delta > 0) positiveCount++;
                else if (delta < 0) negativeCount++;
            }
        });

        const pairedStats = calculateStats(pairedDeltas);

        const divisor = completedCount || 1;
        const cognitiveDimensions = {
            knowledge: Math.round(totalKnowledge / divisor),
            reasoning: Math.round(totalReasoning / divisor),
            communication: Math.round(totalCommunication / divisor),
            adaptability: Math.round(totalAdaptability / divisor),
            integrity: Math.round(totalIntegrity / divisor)
        };

        const sortedDimensions = Object.entries(cognitiveDimensions).sort((a, b) => a[1] - b[1]);
        const competencyInsights = {
            strongest: sortedDimensions[sortedDimensions.length - 1][0].toUpperCase(),
            gaps: sortedDimensions[0][0].toUpperCase()
        };

        return res.json({
            success: true,
            totalCandidates,
            totalAttempts,
            completedAttempts: completedCount,
            completionRate,
            test1Stats,
            test2Stats,
            pairedCohortShift: {
                n: pairedStats.n,
                meanDelta: pairedStats.mean,
                positiveCount,
                negativeCount
            },
            cognitiveDimensions,
            competencyInsights
        });
    } catch (error) {
        console.error("Cohort analytics calculation error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to generate research cohort analytics",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

// ==========================================
// PHASE 6: PROCTORING & ANOMALY ANALYTICS
// ==========================================
const getProctoringAnalytics = async (req, res) => {
    try {
        if (!req.app.locals.dbConnected) {
            return res.json({
                success: true,
                isSandbox: true,
                distribution: { excellent: 18, good: 6, moderate: 3, highRisk: 1 },
                incidents: { tabSwitches: 14, multipleFaces: 2, faceAbsence: 5, speechAnomalies: 3 },
                flaggedCount: 4
            });
        }

        const sessions = await AssessmentSession.find()
            .select("report.integrity monitoring.events proctoring.events telemetryEvents status")
            .lean();

        const distribution = {
            excellent: 0, // 90 - 100
            good: 0,      // 75 - 89
            moderate: 0,  // 50 - 74
            highRisk: 0   // < 50
        };

        const incidents = {
            tabSwitches: 0,
            multipleFaces: 0,
            faceAbsence: 0,
            speechAnomalies: 0
        };

        let flaggedCount = 0;

        for (const s of sessions) {
            const integrity = s.report?.integrity !== undefined ? s.report.integrity : 100;
            if (integrity >= 90) distribution.excellent++;
            else if (integrity >= 75) distribution.good++;
            else if (integrity >= 50) distribution.moderate++;
            else distribution.highRisk++;

            if (integrity < 60) flaggedCount++;

            const events = s.monitoring?.events || s.proctoring?.events || s.telemetryEvents || [];
            for (const ev of events) {
                const type = (ev.type || "").toLowerCase();
                if (type.includes("tab") || type.includes("blur") || type.includes("visibility")) incidents.tabSwitches++;
                else if (type.includes("multiple")) incidents.multipleFaces++;
                else if (type.includes("absent") || type.includes("no_face")) incidents.faceAbsence++;
                else if (type.includes("speech") || type.includes("noise") || type.includes("audio")) incidents.speechAnomalies++;
            }
        }

        return res.json({
            success: true,
            totalMonitored: sessions.length,
            distribution,
            incidents,
            flaggedCount
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to calculate proctoring analytics"
        });
    }
};

// ==========================================
// PHASE 6: RESEARCH DATA EXPORT (STRICT PRIVACY ENFORCED)
// NEVER exports candidate personal email, phone, or raw personal answers.
// ==========================================
const exportResearchData = async (req, res) => {
    try {
        const { format = "json", testId, cohortId } = req.query;

        const query = {};
        if (testId) query.testId = testId;
        if (cohortId) query.cohortId = cohortId;

        let sessions = [];
        if (req.app.locals.dbConnected) {
            sessions = await AssessmentSession.find(query)
                .select("testId testVersion cohortId attemptNumber status report createdAt completedAt")
                .sort({ createdAt: -1 })
                .lean();
        }

        // Map strictly to anonymized research records
        const sanitizedData = sessions.map((s, idx) => ({
            anonymousParticipantId: `PARTICIPANT-${String(idx + 1).padStart(3, "0")}`,
            anonymousResponseId: `RESP-${String(s._id).slice(-6).toUpperCase()}`,
            testId: s.testId || "TEST-1",
            testVersion: s.testVersion || "1.0.0",
            cohortId: s.cohortId || "PILOT-A",
            attemptNumber: s.attemptNumber || 1,
            status: s.status,
            knowledgeScore: s.report?.knowledge || 0,
            reasoningScore: s.report?.reasoning || 0,
            communicationScore: s.report?.communication || 0,
            adaptabilityScore: s.report?.adaptability || 0,
            integrityScore: s.report?.integrity !== undefined ? s.report.integrity : 100,
            overallReadiness: s.report?.readiness || 0,
            decision: s.report?.decision || "Under Review",
            createdAt: s.createdAt ? new Date(s.createdAt).toISOString() : "",
            completedAt: s.completedAt ? new Date(s.completedAt).toISOString() : ""
        }));

        if (format.toLowerCase() === "csv") {
            const headers = [
                "anonymousParticipantId",
                "anonymousResponseId",
                "testId",
                "testVersion",
                "cohortId",
                "attemptNumber",
                "status",
                "knowledgeScore",
                "reasoningScore",
                "communicationScore",
                "adaptabilityScore",
                "integrityScore",
                "overallReadiness",
                "decision",
                "createdAt",
                "completedAt"
            ];

            const rows = sanitizedData.map((d) =>
                headers.map((h) => `"${String(d[h] ?? "").replace(/"/g, '""')}"`).join(",")
            );

            const csvContent = [headers.join(","), ...rows].join("\r\n");

            res.setHeader("Content-Type", "text/csv; charset=utf-8");
            res.setHeader("Content-Disposition", 'attachment; filename="psychometric_research_export.csv"');
            return res.send(csvContent);
        }

        return res.json({
            success: true,
            count: sanitizedData.length,
            privacyGuaranteed: "Candidate PII (email, phone, personal identity) strictly excluded",
            data: sanitizedData
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to export research records"
        });
    }
};

// ==========================================
// PHASE 6: EXAMINER ATTEMPT REVIEW WORKFLOW
// ==========================================
const getExaminerAttempts = async (req, res) => {
    try {
        const { testId, cohortId, status, flagged, page = 1, limit = 20 } = req.query;
        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
        const skip = (pageNum - 1) * limitNum;

        const query = {};
        if (testId) query.testId = testId;
        if (cohortId) query.cohortId = cohortId;
        if (status) query.status = status;
        if (flagged === "true") {
            query.$or = [{ "report.integrity": { $lt: 60 } }, { "report.decision": "Review Required" }];
        }

        if (!req.app.locals.dbConnected) {
            return res.json({
                success: true,
                total: 0,
                page: pageNum,
                limit: limitNum,
                attempts: []
            });
        }

        const [attempts, total] = await Promise.all([
            AssessmentSession.find(query)
                .select("testId testVersion cohortId attemptNumber status report telemetryEvents examinerReview createdAt")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .lean(),
            AssessmentSession.countDocuments(query)
        ]);

        const anonymizedAttempts = attempts.map((a) => ({
            _id: a._id,
            anonymousId: `RESP-${String(a._id).slice(-6).toUpperCase()}`,
            testId: a.testId || "TEST-1",
            testVersion: a.testVersion || "1.0.0",
            cohortId: a.cohortId || "PILOT-A",
            attemptNumber: a.attemptNumber || 1,
            status: a.status,
            report: a.report || {},
            proctoringEventCount: (a.monitoring?.events || a.proctoring?.events || a.telemetryEvents || []).length,
            examinerReview: a.examinerReview || { status: "Pending" },
            createdAt: a.createdAt
        }));

        return res.json({
            success: true,
            total,
            page: pageNum,
            totalPages: Math.ceil(total / limitNum) || 1,
            attempts: anonymizedAttempts
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve examiner attempts"
        });
    }
};

const reviewExaminerAttempt = async (req, res) => {
    try {
        const { id } = req.params;
        const { decision, notes } = req.body;

        const allowedDecisions = ["Approved", "Rejected", "Manual Review Required"];
        if (!decision || !allowedDecisions.includes(decision)) {
            return res.status(400).json({
                success: false,
                message: `Invalid decision. Expected one of: ${allowedDecisions.join(", ")}`
            });
        }

        if (req.app.locals.dbConnected) {
            const session = await AssessmentSession.findById(id);
            if (!session) {
                return res.status(404).json({ success: false, message: "Attempt session not found" });
            }

            session.examinerReview = {
                status: decision,
                notes: notes || "",
                reviewedBy: req.user ? req.user.id : null,
                reviewedAt: new Date()
            };

            await session.save();

            return res.json({
                success: true,
                message: `Attempt ${decision.toLowerCase()} by examiner.`,
                examinerReview: session.examinerReview
            });
        }

        return res.json({ success: true, message: `Attempt review updated (sandbox)` });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to review examiner attempt"
        });
    }
};

module.exports = {
    getOverview,
    getCandidates,
    getSessions,
    getSessionDetail,
    updateCandidateStatus,
    seedQuestions,
    listQuestions,
    createQuestion,
    getAuditLogs,
    getCohortAnalytics,
    getProctoringAnalytics,
    exportResearchData,
    getExaminerAttempts,
    reviewExaminerAttempt
};



