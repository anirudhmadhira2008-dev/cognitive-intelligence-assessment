const request = require("supertest");
const app = require("../server");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");

describe("Security & Assessment Lifecycle Tests", () => {
    let studentToken;
    let studentId = new mongoose.Types.ObjectId().toString();
    let adminToken;
    let adminId = new mongoose.Types.ObjectId().toString();

    beforeAll(async () => {
        if (app.locals?.dbConnected) {
            try {
                await User.create({
                    _id: studentId,
                    name: "Test Student",
                    email: "student@test.com",
                    password: "hashedpassword123",
                    role: "student"
                });
            } catch (err) {}
        }

        studentToken = jwt.sign(
            { id: studentId, role: "student", email: "student@test.com", name: "Test Student" },
            process.env.JWT_SECRET || "dev-only-insecure-jwt-secret-key-32ch",
            { expiresIn: "1h" }
        );
        adminToken = jwt.sign(
            { id: adminId, role: "admin", email: "admin@test.com", name: "Test Admin" },
            process.env.JWT_SECRET || "dev-only-insecure-jwt-secret-key-32ch",
            { expiresIn: "1h" }
        );
    });

    describe("Answer Key Leakage Prevention", () => {
        it("returns next-question without exposing the correct answer key", async () => {
            const res = await request(app)
                .get("/api/assessment/next-question?targetDifficulty=2")
                .set("Authorization", `Bearer ${studentToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.question).toBeDefined();
            expect(res.body.question.answer).toBeUndefined();
            expect(res.body.question.correctAnswerIndex).toBeUndefined();
        });

        it("verifies answer without exposing correctAnswerIndex", async () => {
            const res = await request(app)
                .post("/api/assessment/verify-answer")
                .set("Authorization", `Bearer ${studentToken}`)
                .send({ questionId: "ds-01", choiceIndex: 1 });

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.isCorrect).toBe(true);
            expect(res.body.correctAnswerIndex).toBeUndefined();
        });
    });

    describe("Score Injection Prevention", () => {
        it("rejects unprivileged direct result creation on /api/results/add", async () => {
            const res = await request(app)
                .post("/api/results/add")
                .set("Authorization", `Bearer ${studentToken}`)
                .send({ score: 100, cheatScore: 0 });

            expect(res.statusCode).toBe(403);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/restricted/i);
        });
    });

    describe("Feedback Access Control", () => {
        it("rejects unauthenticated feedback submission", async () => {
            const res = await request(app)
                .post("/api/feedback/add")
                .send({ feedback: "Great platform" });

            expect(res.statusCode).toBe(401);
        });

        it("allows authenticated student feedback submission", async () => {
            const res = await request(app)
                .post("/api/feedback/add")
                .set("Authorization", `Bearer ${studentToken}`)
                .send({ feedback: "Very intuitive UI and real-time proctoring telemetry", rating: 5 });

            expect(res.statusCode).toBe(201);
            expect(res.body.success).toBe(true);
        });
    });

    describe("Assessment Session Lifecycle", () => {
        let activeSessionId;
        let testEnrollmentId;
        let testVerificationToken;

        beforeAll(async () => {
            const dummyBuffer = Buffer.concat([Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBD"), Buffer.alloc(2000, "x")]);
            const dummyPhoto = "data:image/jpeg;base64," + dummyBuffer.toString("base64");
            const enrollRes = await request(app)
                .post("/api/enrollment/create")
                .set("Authorization", `Bearer ${studentToken}`)
                .send({
                    candidateId: studentId,
                    title: "AI Multimodal Psychometric Engineering Assessment",
                    referenceImage: dummyPhoto,
                    consent: true
                });

            if (enrollRes.body?.enrollment?._id) {
                testEnrollmentId = enrollRes.body.enrollment._id;
                const verifyRes = await request(app)
                    .post(`/api/enrollment/${testEnrollmentId}/verify-identity`)
                    .set("Authorization", `Bearer ${studentToken}`)
                    .send({
                        liveImage: dummyPhoto,
                        livenessScore: 0.92,
                        faceCount: 1,
                        consentGiven: true
                    });
                testVerificationToken = verifyRes.body.verificationToken;
            }
        });

        it("rejects identity verification when multiple faces are detected", async () => {
            const res = await request(app)
                .post(`/api/enrollment/${testEnrollmentId}/verify-identity`)
                .set("Authorization", `Bearer ${studentToken}`)
                .send({
                    faceCount: 2,
                    consentGiven: true
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.code).toBe("MULTIPLE_FACES");
            expect(res.body.message).toMatch(/multiple people/i);
        });

        it("rejects identity verification when candidate is not detected (0 faces)", async () => {
            const res = await request(app)
                .post(`/api/enrollment/${testEnrollmentId}/verify-identity`)
                .set("Authorization", `Bearer ${studentToken}`)
                .send({
                    faceCount: 0,
                    consentGiven: true
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.code).toBe("NO_FACE");
            expect(res.body.message).toMatch(/not detected/i);
        });

        it("rejects identity verification when prohibited objects are detected", async () => {
            const res = await request(app)
                .post(`/api/enrollment/${testEnrollmentId}/verify-identity`)
                .set("Authorization", `Bearer ${studentToken}`)
                .send({
                    faceCount: 1,
                    consentGiven: true,
                    prohibitedObjects: ["Mobile Phone"]
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.code).toBe("PROHIBITED_OBJECT");
            expect(res.body.message).toMatch(/prohibited object/i);
        });

        it("rejects direct assessment-start API calls without verification or with fake verified flag", async () => {
            const res = await request(app)
                .post("/api/assessment/start")
                .set("Authorization", `Bearer ${studentToken}`)
                .send({
                    isVerified: true, // Fake frontend manipulation
                    setup: { startingDifficulty: 2, role: "Backend Engineer" }
                });

            expect(res.statusCode).toBe(403);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/locked|verification/i);
        });

        it("starts a new assessment session for authenticated student with valid verification token", async () => {
            const res = await request(app)
                .post("/api/assessment/start")
                .set("Authorization", `Bearer ${studentToken}`)
                .send({
                    enrollmentId: testEnrollmentId,
                    verificationToken: testVerificationToken,
                    setup: { startingDifficulty: 2, role: "Backend Engineer" }
                });

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.sessionId).toBeDefined();
            activeSessionId = res.body.sessionId;
        });

        it("records answer idempotently for active session", async () => {
            const res = await request(app)
                .post("/api/assessment/answer")
                .set("Authorization", `Bearer ${studentToken}`)
                .send({
                    sessionId: activeSessionId,
                    questionId: "ds-01",
                    choiceIndex: 1,
                    responseMs: 12000
                });

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.isCorrect).toBe(true);

            // Resubmitting duplicate answer
            const dupRes = await request(app)
                .post("/api/assessment/answer")
                .set("Authorization", `Bearer ${studentToken}`)
                .send({
                    sessionId: activeSessionId,
                    questionId: "ds-01",
                    choiceIndex: 0
                });

            expect(dupRes.statusCode).toBe(200);
            expect(dupRes.body.duplicate).toBe(true);
            expect(dupRes.body.isCorrect).toBe(true);
        });

        it("submits and finalizes assessment session", async () => {
            const res = await request(app)
                .post("/api/assessment/submit")
                .set("Authorization", `Bearer ${studentToken}`)
                .send({
                    sessionId: activeSessionId,
                    monitoring: { events: [] },
                    voice: { communication: 80, confidence: 85 }
                });

            expect(res.statusCode).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.report).toBeDefined();
            expect(res.body.report.readiness).toBeGreaterThan(0);
        });
    });
});
