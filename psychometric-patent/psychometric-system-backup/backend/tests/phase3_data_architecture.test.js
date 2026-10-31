const request = require("supertest");
const app = require("../server");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");
const AssessmentSession = require("../models/AssessmentSession");
const Enrollment = require("../models/Enrollment");
const TestDefinition = require("../models/TestDefinition");

jest.setTimeout(25000);

describe("Phase 3: Assessment Data Architecture (Test 1 / Test 2 & Attempts)", () => {
    let studentToken, studentId;
    let adminToken, adminId;
    let enrollmentId, verificationToken;

    beforeAll(async () => {
        studentId = new mongoose.Types.ObjectId().toString();
        adminId = new mongoose.Types.ObjectId().toString();

        try {
            await User.create([
                { _id: studentId, name: "David Miller", email: `david_${Date.now()}@univ.edu`, password: "HashedPassword123!", role: "student", rollNumber: "ENG-DM-01" },
                { _id: adminId, name: "Research Director", email: `director_${Date.now()}@univ.edu`, password: "HashedPassword123!", role: "admin" }
            ]);
        } catch (_) {}

        studentToken = jwt.sign(
            { id: studentId, email: `david_${Date.now()}@univ.edu`, role: "student", name: "David Miller" },
            process.env.JWT_SECRET || "default_development_secret_key_32chars_min",
            { expiresIn: "1h" }
        );

        adminToken = jwt.sign(
            { id: adminId, email: `director_${Date.now()}@univ.edu`, role: "admin", name: "Research Director" },
            process.env.JWT_SECRET || "default_development_secret_key_32chars_min",
            { expiresIn: "1h" }
        );

        // Enroll Student
        const dummyBuffer = Buffer.concat([Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBD"), Buffer.alloc(2000, "b")]);
        const dummyPhoto = "data:image/jpeg;base64," + dummyBuffer.toString("base64");
        const enrollRes = await request(app)
            .post("/api/enrollment/create")
            .set("Authorization", `Bearer ${studentToken}`)
            .send({
                candidateId: studentId,
                title: "Dual Test Evaluation",
                referenceImage: dummyPhoto,
                consent: true
            });

        enrollmentId = enrollRes.body.enrollment?._id;

        // Perform Verification to obtain token
        const verifyRes = await request(app)
            .post(`/api/enrollment/${enrollmentId}/verify-identity`)
            .set("Authorization", `Bearer ${studentToken}`)
            .send({
                liveImage: dummyPhoto,
                faceCount: 1,
                consentGiven: true
            });

        verificationToken = verifyRes.body.verificationToken;
    });

    describe("1. Test Definitions Management", () => {
        it("retrieves active test definitions (TEST_1 and TEST_2)", async () => {
            const res = await request(app)
                .get("/api/assessment/tests")
                .set("Authorization", `Bearer ${studentToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.tests.length).toBeGreaterThanOrEqual(2);
            const testIds = res.body.tests.map((t) => t.testId);
            expect(testIds).toContain("TEST_1");
            expect(testIds).toContain("TEST_2");
        });

        it("allows admin to create or update test definition", async () => {
            const res = await request(app)
                .post("/api/assessment/tests")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                    testId: "TEST_COHORT_X",
                    title: "Advanced Engineering Psychometric Evaluation",
                    timeLimitMinutes: 60,
                    targetQuestionCount: 8
                });

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.test.testId).toBe("TEST_COHORT_X");
        });
    });

    describe("2. Dual-Test Lifecycle: Test 1 & Test 2 Independence", () => {
        let test1SessionId, test2SessionId;

        it("starts Test 1 for candidate and registers attemptNumber 1", async () => {
            const res = await request(app)
                .post("/api/assessment/start")
                .set("Authorization", `Bearer ${studentToken}`)
                .send({
                    enrollmentId,
                    verificationToken,
                    testId: "TEST_1",
                    cohortId: "COHORT_A",
                    setup: { startingDifficulty: 2, role: "Software Engineer" }
                });

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            test1SessionId = res.body.sessionId;
            expect(res.body.session.testId).toBe("TEST_1");
            expect(res.body.session.attemptNumber).toBe(1);
        });

        it("submits and finalizes Test 1 attempt", async () => {
            // Answer one question
            await request(app)
                .post("/api/assessment/answer")
                .set("Authorization", `Bearer ${studentToken}`)
                .send({
                    sessionId: test1SessionId,
                    questionId: "ds-01",
                    choiceIndex: 1
                });

            const res = await request(app)
                .post("/api/assessment/submit")
                .set("Authorization", `Bearer ${studentToken}`)
                .send({
                    sessionId: test1SessionId,
                    voice: { communication: 82, confidence: 78 }
                });

            expect(res.statusCode).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.session.status).toBe("COMPLETED");
        });

        it("starts Test 2 for the same candidate without overwriting Test 1", async () => {
            const res = await request(app)
                .post("/api/assessment/start")
                .set("Authorization", `Bearer ${studentToken}`)
                .send({
                    enrollmentId,
                    verificationToken,
                    testId: "TEST_2",
                    cohortId: "COHORT_A",
                    setup: { startingDifficulty: 2, role: "Software Engineer" }
                });

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            test2SessionId = res.body.sessionId;
            expect(test2SessionId).not.toBe(test1SessionId);
            expect(res.body.session.testId).toBe("TEST_2");
            expect(res.body.session.attemptNumber).toBe(1);

            // Confirm Test 1 still exists in database and is COMPLETED
            const checkTest1 = await request(app)
                .get(`/api/assessment/sessions/${test1SessionId}`)
                .set("Authorization", `Bearer ${studentToken}`);

            expect(checkTest1.statusCode).toBe(200);
            expect(checkTest1.body.session.testId).toBe("TEST_1");
            expect(checkTest1.body.session.status).toBe("COMPLETED");
        });

        it("submits and finalizes Test 2 attempt", async () => {
            const res = await request(app)
                .post("/api/assessment/submit")
                .set("Authorization", `Bearer ${studentToken}`)
                .send({
                    sessionId: test2SessionId,
                    voice: { communication: 90, confidence: 88 }
                });

            expect(res.statusCode).toBe(201);
            expect(res.body.success).toBe(true);
        });

        it("filters participant sessions accurately by testId", async () => {
            const resTest1 = await request(app)
                .get("/api/assessment/sessions/my?testId=TEST_1")
                .set("Authorization", `Bearer ${studentToken}`);

            expect(resTest1.statusCode).toBe(200);
            const allT1 = resTest1.body.sessions.every((s) => s.testId === "TEST_1");
            expect(allT1).toBe(true);

            const resTest2 = await request(app)
                .get("/api/assessment/sessions/my?testId=TEST_2")
                .set("Authorization", `Bearer ${studentToken}`);

            expect(resTest2.statusCode).toBe(200);
            const allT2 = resTest2.body.sessions.every((s) => s.testId === "TEST_2");
            expect(allT2).toBe(true);
        });

        it("computes test-wise aggregate analytics for examiners", async () => {
            const res = await request(app)
                .get("/api/assessment/aggregate/TEST_1")
                .set("Authorization", `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.summary.testId).toBe("TEST_1");
            expect(res.body.summary.totalAttempts).toBeGreaterThanOrEqual(1);
            expect(res.body.summary.avgReadiness).toBeDefined();
        });
    });
});
