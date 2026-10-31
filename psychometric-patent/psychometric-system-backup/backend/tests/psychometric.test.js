const {
    clamp,
    calculateDeviceScore,
    processBaselineSamples,
    evaluateVoiceTranscript,
    generateFinalReport
} = require("../services/psychometricEngine");

const {
    calculateNextDifficulty,
    selectNextQuestion,
    verifyAnswer
} = require("../services/adaptiveEngine");

describe("Psychometric & Adaptive Engine Unit Tests", () => {
    describe("clamp utility", () => {
        it("clamps values correctly between 0 and 100", () => {
            expect(clamp(-10)).toBe(0);
            expect(clamp(150)).toBe(100);
            expect(clamp(75)).toBe(75);
        });
    });

    describe("Device Trust Calculation", () => {
        it("computes 100% when all hardware checks pass", () => {
            const checks = {
                camera: true,
                microphone: true,
                secureContext: true,
                storage: true,
                network: true,
                screen: true
            };
            expect(calculateDeviceScore(checks)).toBe(100);
        });

        it("computes 50% when half of checks pass", () => {
            const checks = {
                camera: true,
                microphone: true,
                secureContext: true,
                storage: false,
                network: false,
                screen: false
            };
            expect(calculateDeviceScore(checks)).toBe(50);
        });
    });

    describe("Voice Transcript Evaluation", () => {
        it("calculates communication and confidence based on keywords and words spoken", () => {
            const transcript = "In this project we solved the problem using binary search and an alternative approach";
            const keywords = ["problem", "binary search", "approach", "learned"];
            const evalResult = evaluateVoiceTranscript(transcript, keywords, 10);

            expect(evalResult.keywordCoverage).toBeGreaterThanOrEqual(50);
            expect(evalResult.communication).toBeGreaterThanOrEqual(40);
            expect(evalResult.confidence).toBeGreaterThanOrEqual(45);
        });
    });

    describe("Final Multimodal Cognitive Report", () => {
        it("generates correct aggregated scores and decision", () => {
            const report = generateFinalReport({
                mcq: { correct: 5, total: 6, partialReasoning: 80, improvement: 10 },
                voice: { communication: 80, confidence: 85 },
                monitoring: { riskScore: 10, attentionIndex: 90 },
                baseline: { baselineQuality: 85 },
                device: { score: 100 },
                difficultyReached: 3
            });

            expect(report.knowledge).toBe(83); // 5/6 * 100
            expect(report.integrity).toBe(90);  // 100 - 10
            expect(report.readiness).toBeGreaterThan(70);
            expect(report.roles.length).toBeGreaterThan(0);
            expect(report.roadmap.length).toBe(3);
            expect(report.disclaimer).toBeDefined();
        });
    });

    describe("Adaptive Engine", () => {
        it("increases difficulty when answer is correct and response is fast", () => {
            const next = calculateNextDifficulty(1, true, 12000, 70);
            expect(next).toBe(2);
        });

        it("decreases difficulty when answer is incorrect and response is slow", () => {
            const next = calculateNextDifficulty(3, false, 28000, 50);
            expect(next).toBe(2);
        });

        it("selects unattempted questions matching target difficulty", () => {
            const q = selectNextQuestion({ targetDifficulty: 2, attemptedQuestionIds: [] });
            expect(q).toBeDefined();
            expect(q.difficulty).toBe(2);
            expect(q.question).toBeDefined();
            expect(q.options.length).toBe(4);
            // Must NOT expose answer
            expect(q.answer).toBeUndefined();
        });

        it("verifies answers securely on the server", () => {
            const verification = verifyAnswer("ds-01", 1); // Stack is choice 1
            expect(verification.valid).toBe(true);
            expect(verification.isCorrect).toBe(true);
            expect(verification.explanation).toBeDefined();
        });
    });
});
