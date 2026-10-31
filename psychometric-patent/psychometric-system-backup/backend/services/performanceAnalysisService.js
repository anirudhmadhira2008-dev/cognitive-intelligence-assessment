/**
 * Student Performance Analysis Service
 * 
 * Implements historical performance tracking across completed assessments:
 * 1. Historical Difficulty Analysis (Easy, Medium, Hard)
 *    Formula: Difficulty % = (earned points for difficulty / available points for difficulty) * 100
 *    Missing / unattempted difficulty levels are represented as NULL / unavailable, NEVER as 0%.
 * 2. Competency Analysis across 10 defined engineering domains.
 * 3. Evidence-based trend detection with strict minimum-evidence thresholds.
 * 4. Resilient supplementary AI feedback that fails gracefully without blocking dashboard.
 */

const AssessmentSession = require("../models/AssessmentSession");
const Result = require("../models/Result");
const Question = require("../models/Question");
const aiService = require("./aiService");
const adaptiveEngine = require("./adaptiveEngine");

// Standard 10 Engineering Competencies
const COMPETENCY_CATALOG = [
    "Critical thinking",
    "Problem-solving",
    "Situational judgment",
    "Communication",
    "Adaptability",
    "Technical judgment",
    "Ethical decision-making",
    "Prioritization",
    "Teamwork",
    "Root-cause analysis"
];

// In-memory fallback cache for development sandbox mode
const devSessionHistoryMemory = [];

/**
 * Extracts difficulty performance from an assessment session's responses
 */
function extractDifficultyPerformance(responses = [], questionsMap = new Map()) {
    const difficulties = {
        easy: { earned: 0, available: 0, percentage: null, count: 0 },
        medium: { earned: 0, available: 0, percentage: null, count: 0 },
        hard: { earned: 0, available: 0, percentage: null, count: 0 }
    };

    if (!Array.isArray(responses) || responses.length === 0) {
        return difficulties;
    }

    // De-duplicate responses by questionId to prevent duplicate counting in the same session
    const uniqueResponses = [];
    const seenQuestionIds = new Set();
    responses.forEach((resp) => {
        const qId = resp.questionId || resp.id;
        if (qId && seenQuestionIds.has(qId)) {
            return; // Ignore duplicate responses for the same question
        }
        if (qId) seenQuestionIds.add(qId);
        uniqueResponses.push(resp);
    });

    uniqueResponses.forEach((resp) => {
        // Authoritative difficulty resolution:
        // 1. From passed questionsMap
        // 2. From static QUESTION_BANK
        // 3. From resp.difficulty
        let diffLevel = null;
        if (resp.questionId && questionsMap instanceof Map && questionsMap.has(resp.questionId)) {
            diffLevel = Number(questionsMap.get(resp.questionId).difficulty);
        } else if (resp.questionId && Array.isArray(adaptiveEngine?.QUESTION_BANK)) {
            const staticQ = adaptiveEngine.QUESTION_BANK.find((q) => q.questionId === resp.questionId);
            if (staticQ) diffLevel = Number(staticQ.difficulty);
        }

        if (!diffLevel || isNaN(diffLevel)) {
            diffLevel = Number(resp.difficulty) || 1;
        }

        let key = "easy";
        if (diffLevel === 2) key = "medium";
        if (diffLevel >= 3) key = "hard";

        // Points weighting: Easy = 10, Medium = 20, Hard = 30
        const pointsPossible = diffLevel * 10;
        const isCorrect = resp.correct === true || resp.isCorrect === true || resp.correct === 1;
        const pointsEarned = isCorrect ? pointsPossible : 0;

        difficulties[key].available += pointsPossible;
        difficulties[key].earned += pointsEarned;
        difficulties[key].count += 1;
    });

    ["easy", "medium", "hard"].forEach((key) => {
        if (difficulties[key].available > 0) {
            const rawPercentage = (difficulties[key].earned / difficulties[key].available) * 100;
            // Mathematical bounds: percentage can never be NaN, negative, or exceed 100%
            difficulties[key].percentage = Math.min(100, Math.max(0, Math.round(rawPercentage)));
        } else {
            // Data was not tested in this session — DO NOT report as zero!
            difficulties[key].percentage = null;
        }
    });

    return difficulties;
}

/**
 * Maps responses to the 10 defined competencies
 */
function extractCompetencyPerformance(responses = [], questionsMap = new Map(), voice = {}) {
    const competencies = {};
    COMPETENCY_CATALOG.forEach((comp) => {
        competencies[comp] = {
            earned: 0,
            available: 0,
            percentage: null,
            questionsCount: 0
        };
    });

    responses.forEach((resp) => {
        let compName = resp.competency;
        if (!compName && resp.questionId && questionsMap.has(resp.questionId)) {
            compName = questionsMap.get(resp.questionId).competency;
        }

        // Match against catalog (case-insensitive)
        const matchedCatalog = COMPETENCY_CATALOG.find(
            (c) => c.toLowerCase() === (compName || "").toLowerCase()
        ) || "Problem-solving";

        const diffLevel = Number(resp.difficulty) || 1;
        const pointsPossible = diffLevel * 10;
        const pointsEarned = resp.correct ? pointsPossible : 0;

        competencies[matchedCatalog].available += pointsPossible;
        competencies[matchedCatalog].earned += pointsEarned;
        competencies[matchedCatalog].questionsCount += 1;
    });

    // Blend voice communication score into Communication competency if available
    if (voice && typeof voice.communication === "number" && voice.communication > 0) {
        if (competencies["Communication"].available === 0) {
            competencies["Communication"].available = 100;
            competencies["Communication"].earned = Math.round(voice.communication);
            competencies["Communication"].questionsCount = 1;
        } else {
            const currentP = competencies["Communication"].earned / competencies["Communication"].available;
            const blended = (currentP * 0.6) + ((voice.communication / 100) * 0.4);
            competencies["Communication"].earned = Math.round(blended * 100);
            competencies["Communication"].available = 100;
        }
    }

    // Compute percentages only when there is persisted evidence
    COMPETENCY_CATALOG.forEach((comp) => {
        if (competencies[comp].available > 0) {
            competencies[comp].percentage = Math.round(
                (competencies[comp].earned / competencies[comp].available) * 100
            );
        } else {
            competencies[comp].percentage = null; // insufficient evidence
        }
    });

    return competencies;
}

/**
 * Calculates historical trends with strict minimum-evidence thresholds
 */
function analyzeHistoricalTrends(chronologicalHistory = []) {
    const trends = {
        improvingAreas: [],
        decliningAreas: [],
        insufficientDataAreas: [],
        difficultyInsights: [],
        trajectoryDescription: "Insufficient completed assessments to determine longitudinal trajectory."
    };

    if (chronologicalHistory.length < 2) {
        trends.insufficientDataAreas.push("Overall Historical Trajectory (Minimum 2 completed assessments required)");
        return trends;
    }

    const first = chronologicalHistory[0];
    const latest = chronologicalHistory[chronologicalHistory.length - 1];

    // Difficulty Level Trends
    ["easy", "medium", "hard"].forEach((diff) => {
        const pInitial = first.difficulties[diff]?.percentage;
        const pLatest = latest.difficulties[diff]?.percentage;

        if (pInitial === null || pLatest === null) {
            trends.insufficientDataAreas.push(`${diff.charAt(0).toUpperCase() + diff.slice(1)} Questions`);
        } else {
            const delta = pLatest - pInitial;
            const diffName = `${diff.charAt(0).toUpperCase() + diff.slice(1)} Questions`;
            if (delta >= 5) {
                trends.improvingAreas.push(`${diffName} (+${delta}% improvement from ${pInitial}% to ${pLatest}%)`);
            } else if (delta <= -5) {
                trends.decliningAreas.push(`${diffName} (${delta}% change from ${pInitial}% to ${pLatest}%)`);
            }
        }
    });

    // Overall Score Trend
    const overallDelta = latest.overallScore - first.overallScore;
    if (overallDelta >= 5) {
        trends.trajectoryDescription = `Measured positive progression (+${overallDelta}% across ${chronologicalHistory.length} attempts).`;
    } else if (overallDelta <= -5) {
        trends.trajectoryDescription = `Performance variance observed (${overallDelta}% across ${chronologicalHistory.length} attempts). Review recommended.`;
    } else {
        trends.trajectoryDescription = `Consistent performance maintained across ${chronologicalHistory.length} assessment attempts.`;
    }

    // Difficulty Gap Analysis
    if (latest.difficulties.easy.percentage !== null && latest.difficulties.hard.percentage !== null) {
        const gap = latest.difficulties.easy.percentage - latest.difficulties.hard.percentage;
        if (gap >= 20) {
            trends.difficultyInsights.push(`Performance gap of ${gap}% between Easy and Hard difficulty tasks. Targeted advanced practice recommended.`);
        }
    }

    return trends;
}

/**
 * Generates comprehensive historical performance analysis for a student
 * 
 * @param {string} userId - Authenticated student ID
 * @param {boolean} dbConnected - MongoDB connection status
 * @returns {Promise<Object>} Performance analysis payload
 */
async function getStudentPerformanceAnalysis(userId, dbConnected = true) {
    let completedSessions = [];

    if (dbConnected) {
        completedSessions = await AssessmentSession.find({
            userId,
            status: { $in: ["COMPLETED", "completed", "SUBMITTED"] }
        })
            .sort({ createdAt: 1 }) // Chronological order
            .lean();
    } else {
        completedSessions = devSessionHistoryMemory
            .filter((s) => String(s.userId) === String(userId))
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    }

    if (!completedSessions || completedSessions.length === 0) {
        return {
            hasData: false,
            message: "No completed assessments found. Complete an assessment to generate performance analytics.",
            history: [],
            charts: {
                easy: [],
                medium: [],
                hard: []
            },
            competencies: {},
            trends: {
                improvingAreas: [],
                decliningAreas: [],
                insufficientDataAreas: ["No assessment attempts recorded."],
                difficultyInsights: [],
                trajectoryDescription: "No assessment data available."
            },
            aiFeedback: null
        };
    }

    // Pre-fetch questions map to resolve difficulties and competencies accurately
    const questionIds = new Set();
    completedSessions.forEach((s) => {
        (s.responses || []).forEach((r) => {
            if (r.questionId) questionIds.add(r.questionId);
        });
    });

    const questionsMap = new Map();
    if (dbConnected && questionIds.size > 0) {
        const qDocs = await Question.find({ questionId: { $in: Array.from(questionIds) } }).lean();
        qDocs.forEach((q) => questionsMap.set(q.questionId, q));
    }

    // Process chronological session data
    const chronologicalHistory = completedSessions.map((session, index) => {
        const diffPerf = extractDifficultyPerformance(session.responses || [], questionsMap);
        const compPerf = extractCompetencyPerformance(session.responses || [], questionsMap, session.voice || {});

        const dateStr = session.completedAt || session.createdAt || new Date();
        const formattedDate = new Date(dateStr).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
        });

        const overallScore = Number(session.report?.cognitive) || 
            Number(session.report?.knowledge) || 
            Math.round(
                ((session.responses || []).filter((r) => r.correct).length /
                    Math.max(1, (session.responses || []).length)) * 100
            );

        return {
            sessionId: session._id,
            attemptNumber: index + 1,
            label: `Attempt ${index + 1} (${formattedDate})`,
            date: dateStr,
            overallScore,
            difficulties: diffPerf,
            competencies: compPerf,
            difficultyReached: session.report?.difficultyReached || 1
        };
    });

    // 1. Exactly Three Historical Difficulty Bar Charts (Easy, Medium, Hard)
    const charts = {
        easy: chronologicalHistory.map((item) => ({
            label: item.label,
            date: item.date,
            attemptNumber: item.attemptNumber,
            earned: item.difficulties.easy.earned,
            available: item.difficulties.easy.available,
            percentage: item.difficulties.easy.percentage // null if unattempted
        })),
        medium: chronologicalHistory.map((item) => ({
            label: item.label,
            date: item.date,
            attemptNumber: item.attemptNumber,
            earned: item.difficulties.medium.earned,
            available: item.difficulties.medium.available,
            percentage: item.difficulties.medium.percentage // null if unattempted
        })),
        hard: chronologicalHistory.map((item) => ({
            label: item.label,
            date: item.date,
            attemptNumber: item.attemptNumber,
            earned: item.difficulties.hard.earned,
            available: item.difficulties.hard.available,
            percentage: item.difficulties.hard.percentage // null if unattempted
        }))
    };

    // 2. Aggregate Competencies across latest / all sessions
    const aggregatedCompetencies = {};
    COMPETENCY_CATALOG.forEach((comp) => {
        let totalEarned = 0;
        let totalAvailable = 0;
        let totalQuestions = 0;

        chronologicalHistory.forEach((h) => {
            const c = h.competencies[comp];
            if (c && c.available > 0) {
                totalEarned += c.earned;
                totalAvailable += c.available;
                totalQuestions += c.questionsCount;
            }
        });

        aggregatedCompetencies[comp] = {
            name: comp,
            earned: totalEarned,
            available: totalAvailable,
            questionsCount: totalQuestions,
            percentage: totalAvailable > 0 ? Math.round((totalEarned / totalAvailable) * 100) : null,
            hasEvidence: totalAvailable > 0
        };
    });

    // 3. Trends & Insights
    const trends = analyzeHistoricalTrends(chronologicalHistory);

    // 4. Resilient AI Supplementary Feedback (non-blocking fallback)
    let aiFeedback = null;
    try {
        const latestAttempt = chronologicalHistory[chronologicalHistory.length - 1];
        const promptSummary = {
            attemptsCount: chronologicalHistory.length,
            latestScore: latestAttempt.overallScore,
            easyPerformance: latestAttempt.difficulties.easy.percentage,
            mediumPerformance: latestAttempt.difficulties.medium.percentage,
            hardPerformance: latestAttempt.difficulties.hard.percentage,
            topCompetencies: Object.values(aggregatedCompetencies)
                .filter((c) => c.percentage !== null)
                .sort((a, b) => b.percentage - a.percentage)
                .slice(0, 3)
                .map((c) => `${c.name}: ${c.percentage}%`),
            focusAreas: Object.values(aggregatedCompetencies)
                .filter((c) => c.percentage !== null)
                .sort((a, b) => a.percentage - b.percentage)
                .slice(0, 2)
                .map((c) => `${c.name}: ${c.percentage}%`)
        };

        if (process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY) {
            aiFeedback = await aiService.generatePerformanceSummary(promptSummary).catch(() => null);
        }
    } catch (e) {
        aiFeedback = null; // Silently fallback to objective metrics
    }

    return {
        hasData: true,
        totalCompletedAssessments: chronologicalHistory.length,
        latestOverallScore: chronologicalHistory[chronologicalHistory.length - 1].overallScore,
        history: chronologicalHistory,
        charts,
        competencies: aggregatedCompetencies,
        trends,
        aiFeedback
    };
}

module.exports = {
    COMPETENCY_CATALOG,
    extractDifficultyPerformance,
    extractCompetencyPerformance,
    analyzeHistoricalTrends,
    getStudentPerformanceAnalysis,
    devSessionHistoryMemory
};
