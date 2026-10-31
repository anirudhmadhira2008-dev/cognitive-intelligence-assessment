const {
    COMPETENCY_CATALOG,
    extractDifficultyPerformance,
    extractCompetencyPerformance,
    analyzeHistoricalTrends
} = require("../services/performanceAnalysisService");

describe("Feature 3: Student Performance & Longitudinal Analysis Tests", () => {
    test("1. Difficulty Percentage accurately calculates (earned / available) * 100", () => {
        const responses = [
            // Level 1: 10 pts available each
            { difficulty: 1, correct: true },  // 10 earned, 10 avail
            { difficulty: 1, correct: false }, // 0 earned, 10 avail
            // Level 2: 20 pts available each
            { difficulty: 2, correct: true },  // 20 earned, 20 avail
            { difficulty: 2, correct: true },  // 20 earned, 20 avail
            // Level 3: 30 pts available each
            { difficulty: 3, correct: true },  // 30 earned, 30 avail
            { difficulty: 3, correct: false }  // 0 earned, 30 avail
        ];

        const perf = extractDifficultyPerformance(responses);

        // Easy: 10 earned / 20 avail = 50%
        expect(perf.easy.earned).toBe(10);
        expect(perf.easy.available).toBe(20);
        expect(perf.easy.percentage).toBe(50);

        // Medium: 40 earned / 40 avail = 100%
        expect(perf.medium.earned).toBe(40);
        expect(perf.medium.available).toBe(40);
        expect(perf.medium.percentage).toBe(100);

        // Hard: 30 earned / 60 avail = 50%
        expect(perf.hard.earned).toBe(30);
        expect(perf.hard.available).toBe(60);
        expect(perf.hard.percentage).toBe(50);
    });

    test("2. Unattempted / Missing difficulty levels are represented as NULL (Unavailable), NEVER as 0%", () => {
        // Assessment only had Level 1 and Level 2 questions; Hard was never attempted
        const responses = [
            { difficulty: 1, correct: true },
            { difficulty: 2, correct: true }
        ];

        const perf = extractDifficultyPerformance(responses);

        expect(perf.easy.percentage).toBe(100);
        expect(perf.medium.percentage).toBe(100);
        expect(perf.hard.available).toBe(0);
        expect(perf.hard.percentage).toBeNull(); // Must be null, not 0!
    });

    test("3. Analyzes performance across all 10 defined Engineering Competencies", () => {
        expect(COMPETENCY_CATALOG).toHaveLength(10);
        expect(COMPETENCY_CATALOG).toContain("Critical thinking");
        expect(COMPETENCY_CATALOG).toContain("Problem-solving");
        expect(COMPETENCY_CATALOG).toContain("Situational judgment");
        expect(COMPETENCY_CATALOG).toContain("Communication");
        expect(COMPETENCY_CATALOG).toContain("Adaptability");
        expect(COMPETENCY_CATALOG).toContain("Technical judgment");
        expect(COMPETENCY_CATALOG).toContain("Ethical decision-making");
        expect(COMPETENCY_CATALOG).toContain("Prioritization");
        expect(COMPETENCY_CATALOG).toContain("Teamwork");
        expect(COMPETENCY_CATALOG).toContain("Root-cause analysis");

        const responses = [
            { competency: "Critical thinking", difficulty: 2, correct: true },
            { competency: "Problem-solving", difficulty: 3, correct: true },
            { competency: "Ethical decision-making", difficulty: 1, correct: false }
        ];

        const compScores = extractCompetencyPerformance(responses, new Map(), { communication: 85 });

        expect(compScores["Critical thinking"].percentage).toBe(100);
        expect(compScores["Problem-solving"].percentage).toBe(100);
        expect(compScores["Ethical decision-making"].percentage).toBe(0); // 0/10 pts
        expect(compScores["Adaptability"].percentage).toBeNull(); // Insufficient data -> null
        expect(compScores["Communication"].percentage).toBeGreaterThan(0); // Blended voice
    });

    test("4. Trend detection requires minimum 2 chronological attempts and enforces thresholds", () => {
        // Single attempt -> Insufficient historical data
        const singleAttempt = [
            {
                attemptNumber: 1,
                overallScore: 70,
                difficulties: {
                    easy: { percentage: 80 },
                    medium: { percentage: 70 },
                    hard: { percentage: null }
                }
            }
        ];
        const trendSingle = analyzeHistoricalTrends(singleAttempt);
        expect(trendSingle.insufficientDataAreas.length).toBeGreaterThan(0);
        expect(trendSingle.trajectoryDescription).toContain("Insufficient completed assessments");

        // Two attempts -> Measures delta >= 5%
        const twoAttempts = [
            singleAttempt[0],
            {
                attemptNumber: 2,
                overallScore: 82, // +12%
                difficulties: {
                    easy: { percentage: 95 }, // +15% (improving)
                    medium: { percentage: 60 }, // -10% (declining)
                    hard: { percentage: 70 }
                }
            }
        ];
        const trendDouble = analyzeHistoricalTrends(twoAttempts);

        expect(trendDouble.improvingAreas.some((a) => a.includes("Easy Questions"))).toBe(true);
        expect(trendDouble.decliningAreas.some((a) => a.includes("Medium Questions"))).toBe(true);
        expect(trendDouble.trajectoryDescription).toContain("+12%");
    });

    test("5. Regression Test: Prevents 133% or out-of-bounds difficulty percentage from duplicate or mismatched responses", () => {
        // Scenario that previously could cause >100% (e.g. 133%):
        // 1. Duplicate responses for the same question where client repeats question with correct: true
        // 2. Client passes difficulty: 1 for a Medium question (10 avail instead of 20) while question is 20 pts
        const malformedResponses = [
            { questionId: "ds-02", difficulty: 1, correct: true }, // ds-02 is actually diff 2 (20 pts)
            { questionId: "ds-02", difficulty: 2, correct: true }, // duplicate response for ds-02
            { questionId: "algo-02", difficulty: 2, correct: true } // algo-02 is diff 2 (20 pts)
        ];

        const perf = extractDifficultyPerformance(malformedResponses);

        // Deduplication ensures ds-02 is counted once.
        // Authoritative difficulty resolves ds-02 to diff 2 (20 pts) and algo-02 to diff 2 (20 pts).
        // Available = 40 pts, Earned = 40 pts -> exactly 100%, NEVER 133%!
        expect(perf.medium.percentage).toBeLessThanOrEqual(100);
        expect(perf.medium.percentage).toBeGreaterThanOrEqual(0);
        expect(perf.medium.earned).toBeLessThanOrEqual(perf.medium.available);
        expect(perf.medium.percentage).toBe(100);
        expect(perf.medium.count).toBe(2);
    });

    test("6. Authoritative difficulty resolution prevents client spoofing", () => {
        // Client claims an easy question (ds-01) is hard (diff 3) to inflate score
        const spoofedResponses = [
            { questionId: "ds-01", difficulty: 3, correct: true } // ds-01 is actually difficulty 1
        ];

        const perf = extractDifficultyPerformance(spoofedResponses);

        // Must be placed in Easy bucket (not Hard) because QUESTION_BANK defines ds-01 as difficulty 1
        expect(perf.easy.available).toBe(10);
        expect(perf.easy.earned).toBe(10);
        expect(perf.easy.percentage).toBe(100);
        expect(perf.hard.available).toBe(0);
        expect(perf.hard.percentage).toBeNull();
    });
});
