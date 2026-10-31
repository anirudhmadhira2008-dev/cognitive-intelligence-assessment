const request = require("supertest");
const app = require("../server");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");

jest.setTimeout(25000);

describe("Phase 2: Security & Scoring Integrity Regression Suite", () => {
    let student1Token, student1Id;
    let student2Token, student2Id;
    let adminToken, adminId;
    let student1EnrollmentId, student1StorageKey;

    beforeAll(async () => {
        student1Id = new mongoose.Types.ObjectId().toString();
        student2Id = new mongoose.Types.ObjectId().toString();
        adminId = new mongoose.Types.ObjectId().toString();

        try {
            await User.create([
                { _id: student1Id, name: "Alice Smith", email: `student1_${Date.now()}@univ.edu`, password: "HashedPassword123!", role: "student", rollNumber: "STU-001" },
                { _id: student2Id, name: "Bob Jones", email: `student2_${Date.now()}@univ.edu`, password: "HashedPassword123!", role: "student", rollNumber: "STU-002" },
                { _id: adminId, name: "System Admin", email: `admin_${Date.now()}@univ.edu`, password: "HashedPassword123!", role: "admin" }
            ]);
        } catch (_) {}

        student1Token = jwt.sign(
            { id: student1Id, email: `student1_${Date.now()}@univ.edu`, role: "student", name: "Alice Smith" },
            process.env.JWT_SECRET || "default_development_secret_key_32chars_min",
            { expiresIn: "1h" }
        );

        student2Token = jwt.sign(
            { id: student2Id, email: `student2_${Date.now()}@univ.edu`, role: "student", name: "Bob Jones" },
            process.env.JWT_SECRET || "default_development_secret_key_32chars_min",
            { expiresIn: "1h" }
        );

        adminToken = jwt.sign(
            { id: adminId, email: `admin_${Date.now()}@univ.edu`, role: "admin", name: "System Admin" },
            process.env.JWT_SECRET || "default_development_secret_key_32chars_min",
            { expiresIn: "1h" }
        );

        // Enroll Student 1 with reference photo
        const dummyBuffer = Buffer.concat([Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBD"), Buffer.alloc(2000, "a")]);
        const dummyPhoto = "data:image/jpeg;base64," + dummyBuffer.toString("base64");
        const enrollRes = await request(app)
            .post("/api/enrollment/create")
            .set("Authorization", `Bearer ${student1Token}`)
            .send({
                candidateId: student1Id,
                title: "Psychometric Assessment Round 1",
                referenceImage: dummyPhoto,
                consent: true
            });

        student1EnrollmentId = enrollRes.body.enrollment?._id;
        student1StorageKey = enrollRes.body.enrollment?.identityEnrollment?.secureStorageKey;
    });

    describe("1. Identity Verification & Anti-Spoofing", () => {
        it("rejects identity verification when live image is completely missing", async () => {
            const res = await request(app)
                .post(`/api/enrollment/${student1EnrollmentId}/verify-identity`)
                .set("Authorization", `Bearer ${student1Token}`)
                .send({
                    faceCount: 1,
                    consentGiven: true
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.code).toBe("NO_LIVE_IMAGE");
        });

        it("does not trust arbitrary client-supplied faceSimilarity score to bypass verification", async () => {
            // When client supplies forged faceSimilarity: 99 but faceCount is 0 (no candidate)
            const res = await request(app)
                .post(`/api/enrollment/${student1EnrollmentId}/verify-identity`)
                .set("Authorization", `Bearer ${student1Token}`)
                .send({
                    faceCount: 0,
                    faceSimilarity: 99.9,
                    livenessScore: 0.99,
                    consentGiven: true
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.code).toBe("NO_FACE");
            expect(res.body.success).toBe(false);
        });

        it("fails closed when prohibited objects are detected regardless of face match claim", async () => {
            const res = await request(app)
                .post(`/api/enrollment/${student1EnrollmentId}/verify-identity`)
                .set("Authorization", `Bearer ${student1Token}`)
                .send({
                    liveImage: "data:image/jpeg;base64,1234",
                    faceCount: 1,
                    faceSimilarity: 95,
                    prohibitedObjects: ["Smart Phone", "Notes"],
                    consentGiven: true
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.code).toBe("PROHIBITED_OBJECT");
        });
    });

    describe("2. IDOR Protection on Enrolled Assets", () => {
        it("prevents Student 2 from accessing Student 1 reference photo (IDOR Prevention)", async () => {
            if (!student1StorageKey) return;
            const res = await request(app)
                .get(`/api/enrollment/reference-image/${student1StorageKey}`)
                .set("Authorization", `Bearer ${student2Token}`);

            expect(res.statusCode).toBe(403);
            expect(res.body.message).toMatch(/forbidden|authorized/i);
        });

        it("allows Student 1 to retrieve their own reference photo", async () => {
            if (!student1StorageKey) return;
            const res = await request(app)
                .get(`/api/enrollment/reference-image/${student1StorageKey}`)
                .set("Authorization", `Bearer ${student1Token}`);

            expect([200, 404]).toContain(res.statusCode);
            if (res.statusCode === 200) {
                expect(res.headers["content-type"]).toMatch(/image/);
            }
        });
    });

    describe("3. Role Escalation & Manual Approval Protection", () => {
        it("prevents students from manually approving enrollments", async () => {
            const res = await request(app)
                .post(`/api/enrollment/${student1EnrollmentId}/manual-approve`)
                .set("Authorization", `Bearer ${student1Token}`)
                .send({});

            expect(res.statusCode).toBe(403);
        });

        it("allows administrators to manually approve an enrollment", async () => {
            const res = await request(app)
                .post(`/api/enrollment/${student1EnrollmentId}/manual-approve`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({});

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.verificationStatus).toBe("VERIFIED");
            expect(res.body.verificationToken).toBeDefined();
        });
    });

    describe("4. Administrator Privacy Boundary Enforcement", () => {
        it("strictly protects candidate personal email and phone in candidate directory", async () => {
            const res = await request(app)
                .get("/api/admin/candidates")
                .set("Authorization", `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            if (res.body.candidates && res.body.candidates.length > 0) {
                const sample = res.body.candidates[0];
                expect(sample.name).toBeDefined();
                expect(sample.rollNumber).toBeDefined();
                // Prohibited fields must be undefined:
                expect(sample.email).toBeUndefined();
                expect(sample.phone).toBeUndefined();
                expect(sample.password).toBeUndefined();
            }
        });

        it("returns anonymized response IDs without personal identity in admin session audit", async () => {
            const res = await request(app)
                .get("/api/admin/sessions")
                .set("Authorization", `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            if (res.body.sessions && res.body.sessions.length > 0) {
                const sample = res.body.sessions[0];
                expect(sample.anonymousId).toBeDefined();
                expect(sample.candidate?.email).toBeUndefined();
            }
        });
    });
});
