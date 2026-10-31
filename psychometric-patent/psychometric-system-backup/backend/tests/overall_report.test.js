const request = require("supertest");
const overallReportService = require("../services/overallReportService");
const digitalSignatureService = require("../services/digitalSignatureService");

describe("Feature 4: Overall Assessment Report & Signing Lifecycle Tests", () => {
    const mockUser = {
        id: "user-test-uuid-999",
        name: "Test Student Engineer",
        role: "student",
        studentId: "STU-5544"
    };

    test("1. Generates and digitally signs a finalized overall report", async () => {
        const testSessionId = `test-sess-${Date.now()}`;
        const result = await overallReportService.generateAndSignReport({
            sessionId: testSessionId,
            user: mockUser,
            dbConnected: false // Sandbox mode
        });

        expect(result.report).toBeDefined();
        expect(result.report.reportId).toMatch(/^REP-2026-/);
        expect(result.report.status).toBe("signed");
        expect(result.report.algorithm).toBe("RSA-PSS-SHA256");
        expect(result.report.signature).toBeDefined();
        expect(result.report.canonicalHash).toHaveLength(64);

        // Verify cryptographic signature directly
        const verifyRes = digitalSignatureService.verifyReportPayload(
            result.report.signedPayload,
            result.report.signature,
            result.report.keyId
        );
        expect(verifyRes.valid).toBe(true);
        expect(verifyRes.status).toBe("VALID");
    });

    test("2. Idempotent report generation prevents duplicate records or double-counting", async () => {
        const testSessionId = `test-sess-idempotent-${Date.now()}`;

        // First generation
        const first = await overallReportService.generateAndSignReport({
            sessionId: testSessionId,
            user: mockUser,
            dbConnected: false
        });

        expect(first.alreadySigned).toBe(false);

        // Second generation with same sessionId
        const second = await overallReportService.generateAndSignReport({
            sessionId: testSessionId,
            user: mockUser,
            dbConnected: false
        });

        expect(second.alreadySigned).toBe(true);
        expect(second.report.reportId).toBe(first.report.reportId);
        expect(second.report.signature).toBe(first.report.signature);
    });

    test("3. Finalized signed report payload is immutable and detects modifications", async () => {
        const testSessionId = `test-sess-immutability-${Date.now()}`;
        const { report } = await overallReportService.generateAndSignReport({
            sessionId: testSessionId,
            user: mockUser,
            dbConnected: false
        });

        // Modify a copy of the signed payload (e.g., attempt to alter scoreBreakdown)
        const forgedPayload = JSON.parse(JSON.stringify(report.signedPayload));
        forgedPayload.overallScore = 100;
        forgedPayload.scoreBreakdown.knowledgeScore = 100;

        const verifyForged = digitalSignatureService.verifyReportPayload(
            forgedPayload,
            report.signature,
            report.keyId
        );

        expect(verifyForged.valid).toBe(false);
        expect(verifyForged.status).toBe("TAMPERED_CONTENT");
    });
});
