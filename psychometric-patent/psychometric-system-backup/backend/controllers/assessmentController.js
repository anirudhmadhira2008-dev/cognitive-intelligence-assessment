const AssessmentSession = require("../models/AssessmentSession");
const Result = require("../models/Result");
const TestDefinition = require("../models/TestDefinition");
const { generateFinalReport } = require("../services/psychometricEngine");
const { evaluateIntegrityStream } = require("../services/proctoringService");
const adaptiveEngine = require("../services/adaptiveEngine");
const assessmentLifecycle = require("../services/assessmentLifecycle");

// ==========================================
// START ASSESSMENT SESSION (DUAL-TEST & COHORT READY)
// ==========================================
const startSession = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }

        const enrollmentId = req.body.enrollmentId || req.body.setup?.enrollmentId;
        const verificationToken = req.body.verificationToken || req.body.setup?.verificationToken;
        const assessmentId = req.body.assessmentId || req.body.setup?.assessmentId;
        const testId = req.body.testId || req.body.setup?.testId || "TEST_1";
        const cohortId = req.body.cohortId || req.body.setup?.cohortId || "DEFAULT";

        const result = await assessmentLifecycle.startSession({
            user: req.user,
            enrollmentId,
            verificationToken,
            assessmentId,
            testId,
            cohortId,
            isSynthetic: Boolean(req.body.isSynthetic || req.body.setup?.isSynthetic),
            setup: req.body.setup || {},
            dbConnected: req.app.locals.dbConnected
        });

        if (!result.success) {
            return res.status(result.status || 400).json({
                success: false,
                code: result.code,
                message: result.message
            });
        }

        return res.status(200).json({
            success: true,
            resumed: result.resumed,
            session: result.session,
            sessionId: result.session._id,
            isSandbox: result.isSandbox
        });
    } catch (error) {
        console.error("Start session error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to start assessment session",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

// ==========================================
// RECORD ANSWER (SERVER AUTHORITATIVE)
// ==========================================
const recordAnswer = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }

        const { sessionId, questionId, choiceIndex, responseMs, confidence } = req.body;

        if (!questionId || typeof questionId !== "string" || !questionId.trim()) {
            return res.status(400).json({ success: false, message: "Valid questionId string is required" });
        }

        if (choiceIndex !== undefined && choiceIndex !== null && (isNaN(Number(choiceIndex)) || Number(choiceIndex) < 0 || Number(choiceIndex) > 5)) {
            return res.status(400).json({ success: false, message: "Invalid choiceIndex. Expected integer index (0-3)." });
        }

        let session = null;
        if (sessionId) {
            session = await assessmentLifecycle.loadSession(sessionId, req.app.locals.dbConnected);
            if (session) {
                const ownerCheck = assessmentLifecycle.assertSessionOwner(session, req.user);
                if (!ownerCheck.ok) {
                    return res.status(ownerCheck.status).json({ success: false, message: ownerCheck.message });
                }
            }
        }

        if (!session) {
            // Fallback: start session if none supplied
            const startRes = await assessmentLifecycle.startSession({
                user: req.user,
                setup: {},
                dbConnected: req.app.locals.dbConnected
            });
            if (!startRes.success || !startRes.session) {
                return res.status(startRes.status || 403).json({
                    success: false,
                    code: startRes.code || "ASSESSMENT_LOCKED",
                    message: startRes.message || "Cannot record answer: assessment is locked or unverified."
                });
            }
            session = startRes.session;
        }

        const answerResult = await assessmentLifecycle.recordAnswer({
            session,
            questionId,
            choiceIndex,
            responseMs,
            confidence,
            allowUpdate: req.body.allowUpdate,
            dbConnected: req.app.locals.dbConnected
        });

        if (answerResult.error) {
            return res.status(answerResult.error.status).json({
                success: false,
                message: answerResult.error.message
            });
        }

        return res.json({
            success: true,
            sessionId: session._id,
            duplicate: answerResult.duplicate,
            isCorrect: answerResult.isCorrect,
            nextDifficulty: answerResult.nextDifficulty,
            completedMcq: answerResult.completedMcq
        });
    } catch (error) {
        console.error("Record answer error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to record answer",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

// ==========================================
// RECORD PROGRESS / AUTOSAVE
// ==========================================
const recordProgress = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }

        const { sessionId, events, status } = req.body;
        const session = await assessmentLifecycle.loadSession(sessionId, req.app.locals.dbConnected);

        if (!session) {
            return res.status(404).json({ success: false, message: "Session not found" });
        }

        const ownerCheck = assessmentLifecycle.assertSessionOwner(session, req.user);
        if (!ownerCheck.ok) {
            return res.status(ownerCheck.status).json({ success: false, message: ownerCheck.message });
        }

        const progressResult = await assessmentLifecycle.recordProgress({
            session,
            events,
            status,
            dbConnected: req.app.locals.dbConnected
        });

        if (progressResult.error) {
            return res.status(progressResult.error.status).json({
                success: false,
                message: progressResult.error.message
            });
        }

        return res.json({
            success: true,
            sessionId: session._id,
            status: session.status,
            monitoring: session.monitoring
        });
    } catch (error) {
        console.error("Record progress error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to save assessment progress",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

// ==========================================
// SUBMIT COMPLETED ASSESSMENT SESSION
// ==========================================
const submitSession = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }

        const sessionId = req.body.sessionId || req.body._id;
        let session = await assessmentLifecycle.loadSession(sessionId, req.app.locals.dbConnected);

        if (session) {
            const ownerCheck = assessmentLifecycle.assertSessionOwner(session, req.user);
            if (!ownerCheck.ok) {
                return res.status(ownerCheck.status).json({ success: false, message: ownerCheck.message });
            }
        }

        const finalized = await assessmentLifecycle.finalizeSession({
            session,
            user: req.user,
            body: req.body,
            dbConnected: req.app.locals.dbConnected
        });

        return res.status(201).json({
            success: true,
            message: "Assessment session successfully evaluated and saved",
            sessionId: finalized.session._id,
            resultId: finalized.resultId,
            signedReportId: finalized.signedReportId,
            session: finalized.session,
            report: finalized.report,
            isSandbox: finalized.isSandbox
        });
    } catch (error) {
        console.error("Submit session error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to submit assessment session",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

// ==========================================
// GET MY SESSIONS (SUPPORTS TEST_1 / TEST_2 FILTER)
// ==========================================
const getMySessions = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }

        const query = { userId: req.user.id };
        if (req.query.testId) {
            query.testId = req.query.testId.trim();
        }
        if (req.query.cohortId) {
            query.cohortId = req.query.cohortId.trim();
        }

        if (req.app.locals.dbConnected) {
            const sessions = await AssessmentSession.find(query)
                .sort({ createdAt: -1 })
                .limit(50)
                .select("-responses");

            return res.json({
                success: true,
                count: sessions.length,
                sessions
            });
        }

        let filtered = assessmentLifecycle.memorySessions.filter((s) => !s.userId || String(s.userId) === String(req.user.id));
        if (req.query.testId) {
            filtered = filtered.filter((s) => (s.testId || "TEST_1") === req.query.testId.trim());
        }
        return res.json({
            success: true,
            count: filtered.length,
            sessions: filtered,
            isSandbox: true
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve sessions",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

// ==========================================
// GET SINGLE SESSION BY ID
// ==========================================
const getSessionById = async (req, res) => {
    try {
        const { id } = req.params;

        if (req.app.locals.dbConnected) {
            const session = await AssessmentSession.findById(id);

            if (!session) {
                return res.status(404).json({ success: false, message: "Assessment session not found" });
            }

            // Resource ownership check
            if (req.user.role !== "admin" && req.user.role !== "evaluator") {
                if (session.userId && session.userId.toString() !== req.user.id.toString()) {
                    return res.status(403).json({
                        success: false,
                        message: "Forbidden: You are not authorized to view this assessment session"
                    });
                }
            }

            return res.json({ success: true, session });
        }

        const devMatch = assessmentLifecycle.memorySessions.find((s) => String(s._id) === String(id));
        if (devMatch) {
            return res.json({ success: true, session: devMatch, isSandbox: true });
        }

        return res.status(404).json({ success: false, message: "Session not found in sandbox" });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch session",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

// ==========================================
// DYNAMIC NEXT QUESTION SELECTION
// ==========================================
const getNextQuestion = async (req, res) => {
    try {
        const targetDifficulty = Number(req.query.targetDifficulty) || 2;
        const attemptedIdsParam = req.query.attemptedIds || "";
        const attemptedIds = attemptedIdsParam ? attemptedIdsParam.split(",").map((s) => s.trim()) : [];
        const preferredDomain = req.query.domain || null;
        const sessionId = req.query.sessionId;

        let sessionAttempted = attemptedIds;
        let sessionDifficulty = targetDifficulty;

        if (sessionId) {
            const session = await assessmentLifecycle.loadSession(sessionId, req.app.locals.dbConnected);
            if (session) {
                if (session.adaptiveState?.attemptedQuestionIds?.length) {
                    sessionAttempted = session.adaptiveState.attemptedQuestionIds;
                } else if (session.responses?.length) {
                    sessionAttempted = session.responses.map((r) => r.questionId);
                }
                if (session.adaptiveState?.currentDifficulty) {
                    sessionDifficulty = session.adaptiveState.currentDifficulty;
                }
            }
        }

        const nextQ = adaptiveEngine.selectNextQuestion({
            targetDifficulty: sessionDifficulty,
            attemptedQuestionIds: sessionAttempted,
            preferredDomain
        });

        if (!nextQ) {
            return res.json({
                success: true,
                completed: true,
                message: "No additional questions available for this assessment session"
            });
        }

        return res.json({
            success: true,
            completed: false,
            question: nextQ
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error selecting adaptive question",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

// ==========================================
// SECURE SERVER-SIDE MCQ ANSWER VERIFICATION
// ==========================================
const verifyAnswer = async (req, res) => {
    try {
        const {
            questionId,
            choiceIndex,
            responseMs = 0,
            currentDifficulty = 2,
            confidence = 65,
            sessionId
        } = req.body;

        if (!questionId || choiceIndex === undefined) {
            return res.status(400).json({
                success: false,
                message: "questionId and choiceIndex are required"
            });
        }

        if (sessionId) {
            const session = await assessmentLifecycle.loadSession(sessionId, req.app.locals.dbConnected);
            if (session) {
                const ownerCheck = assessmentLifecycle.assertSessionOwner(session, req.user);
                if (!ownerCheck.ok) {
                    return res.status(ownerCheck.status).json({ success: false, message: ownerCheck.message });
                }
                const recordRes = await assessmentLifecycle.recordAnswer({
                    session,
                    questionId,
                    choiceIndex,
                    responseMs,
                    confidence,
                    dbConnected: req.app.locals.dbConnected
                });
                if (recordRes.error) {
                    return res.status(recordRes.error.status).json({ success: false, message: recordRes.error.message });
                }
                return res.json({
                    success: true,
                    isCorrect: recordRes.isCorrect,
                    nextDifficulty: recordRes.nextDifficulty,
                    duplicate: recordRes.duplicate,
                    completedMcq: recordRes.completedMcq
                });
            }
        }

        const result = adaptiveEngine.verifyAnswer(questionId, choiceIndex);

        if (!result.valid) {
            return res.status(404).json({ success: false, message: result.error });
        }

        const nextDifficulty = adaptiveEngine.calculateNextDifficulty(
            currentDifficulty,
            result.isCorrect,
            Number(responseMs) || 0,
            Number(confidence) || 65
        );

        return res.json({
            success: true,
            isCorrect: result.isCorrect,
            nextDifficulty,
            concepts: result.concepts,
            difficulty: result.difficulty,
            competency: result.competency
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error verifying answer",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

// ==========================================
// GET VOICE INTERVIEW PROMPTS
// ==========================================
const getVoicePrompts = (_req, res) => {
    const prompts = adaptiveEngine.getVoiceQuestions();
    return res.json({
        success: true,
        count: prompts.length,
        questions: prompts
    });
};

// ==========================================
// TEST DEFINITION & AGGREGATE ANALYTICS
// ==========================================
const getTestDefinitions = async (req, res) => {
    try {
        if (req.app.locals.dbConnected) {
            let tests = await TestDefinition.find({ isActive: true }).sort({ testId: 1 });
            if (tests.length === 0) {
                // Default Seed: TEST_1 (Pre-Assessment) and TEST_2 (Post-Assessment)
                tests = await TestDefinition.create([
                    {
                        testId: "TEST_1",
                        version: "1.0.0",
                        title: "Multimodal Psychometric Engineering Assessment — Round 1 (Pre-Assessment)",
                        description: "Evaluates baseline knowledge, analytical problem solving, and verbal articulation."
                    },
                    {
                        testId: "TEST_2",
                        version: "1.0.0",
                        title: "Multimodal Psychometric Engineering Assessment — Round 2 (Post-Assessment)",
                        description: "Measures adaptive progression, interview confidence, and cognitive development."
                    }
                ]);
            }
            return res.json({ success: true, count: tests.length, tests });
        }

        return res.json({
            success: true,
            count: 2,
            tests: [
                { testId: "TEST_1", version: "1.0.0", title: "Assessment Round 1 (Pre-Assessment)" },
                { testId: "TEST_2", version: "1.0.0", title: "Assessment Round 2 (Post-Assessment)" }
            ],
            isSandbox: true
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to fetch test definitions" });
    }
};

const getTestDefinitionById = async (req, res) => {
    try {
        const { testId } = req.params;
        if (req.app.locals.dbConnected) {
            const test = await TestDefinition.findOne({ testId });
            if (!test) return res.status(404).json({ success: false, message: `Test '${testId}' not found` });
            return res.json({ success: true, test });
        }
        return res.json({ success: true, test: { testId, version: "1.0.0", title: `Assessment ${testId}` }, isSandbox: true });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Error loading test definition" });
    }
};

const createOrUpdateTestDefinition = async (req, res) => {
    try {
        if (!req.user || req.user.role !== "admin") {
            return res.status(403).json({ success: false, message: "Forbidden: Administrator role required" });
        }

        const { testId, title, version, description, cohortId, blueprint, timeLimitMinutes, targetQuestionCount, isActive } = req.body;
        if (!testId || !title) {
            return res.status(400).json({ success: false, message: "testId and title are required" });
        }

        if (req.app.locals.dbConnected) {
            const updated = await TestDefinition.findOneAndUpdate(
                { testId },
                {
                    $set: {
                        title,
                        version: version || "1.0.0",
                        description: description || "",
                        cohortId: cohortId || "DEFAULT",
                        blueprint: blueprint || {},
                        timeLimitMinutes: Number(timeLimitMinutes) || 45,
                        targetQuestionCount: Number(targetQuestionCount) || 6,
                        isActive: isActive !== undefined ? Boolean(isActive) : true
                    }
                },
                { upsert: true, new: true }
            );
            return res.status(200).json({ success: true, test: updated });
        }

        return res.json({ success: true, test: { testId, title, version }, isSandbox: true });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to save test definition" });
    }
};

const getTestAggregateResults = async (req, res) => {
    try {
        if (!req.user || (req.user.role !== "admin" && req.user.role !== "evaluator")) {
            return res.status(403).json({ success: false, message: "Forbidden: Examiner access required" });
        }

        const { testId } = req.params;
        const cohortId = req.query.cohortId;

        if (req.app.locals.dbConnected) {
            const matchStage = { testId: testId || "TEST_1", isSynthetic: false };
            if (cohortId) matchStage.cohortId = cohortId;

            const aggregates = await Result.aggregate([
                { $match: matchStage },
                {
                    $group: {
                        _id: "$testId",
                        totalAttempts: { $sum: 1 },
                        uniqueParticipants: { $addToSet: "$userId" },
                        avgReadiness: { $avg: "$professionalReadiness" },
                        avgKnowledge: { $avg: "$knowledgeScore" },
                        avgReasoning: { $avg: "$reasoningScore" },
                        avgCommunication: { $avg: "$communicationScore" },
                        avgIntegrity: { $avg: "$integrityScore" }
                    }
                },
                {
                    $project: {
                        testId: "$_id",
                        totalAttempts: 1,
                        participantCount: { $size: "$uniqueParticipants" },
                        avgReadiness: { $round: ["$avgReadiness", 1] },
                        avgKnowledge: { $round: ["$avgKnowledge", 1] },
                        avgReasoning: { $round: ["$avgReasoning", 1] },
                        avgCommunication: { $round: ["$avgCommunication", 1] },
                        avgIntegrity: { $round: ["$avgIntegrity", 1] }
                    }
                }
            ]);

            const summary = aggregates[0] || {
                testId,
                totalAttempts: 0,
                participantCount: 0,
                avgReadiness: 0,
                avgKnowledge: 0,
                avgReasoning: 0,
                avgCommunication: 0,
                avgIntegrity: 100
            };

            return res.json({ success: true, summary });
        }

        return res.json({
            success: true,
            summary: {
                testId,
                totalAttempts: 10,
                participantCount: 10,
                avgReadiness: 78.4,
                avgKnowledge: 82.1,
                avgReasoning: 75.6,
                avgCommunication: 77.0,
                avgIntegrity: 94.2
            },
            isSandbox: true
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to compute test aggregates" });
    }
};

module.exports = {
    startSession,
    recordAnswer,
    recordProgress,
    submitSession,
    getMySessions,
    getSessionById,
    getNextQuestion,
    verifyAnswer,
    getVoicePrompts,
    getTestDefinitions,
    getTestDefinitionById,
    createOrUpdateTestDefinition,
    getTestAggregateResults
};

