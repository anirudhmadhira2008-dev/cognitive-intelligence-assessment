const request = require("supertest");
const app = require("../server");

describe("Authentication & RBAC API Tests", () => {
    const testEmail = `candidate_${Date.now()}@example.com`;
    let userToken = "";

    it("POST /api/auth/register fails with missing required fields", async () => {
        const res = await request(app).post("/api/auth/register").send({
            name: "A",
            email: "invalid-email",
            password: "short"
        });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    it("POST /api/auth/register creates a student account and returns token", async () => {
        const res = await request(app).post("/api/auth/register").send({
            name: "Candidate Test",
            email: testEmail,
            password: "StrongPassword123!",
            rollNumber: "TEST-2026",
            college: "Tech University",
            course: "B.Tech",
            branch: "CSE",
            year: "4"
        });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.token).toBeDefined();
        expect(res.body.user.role).toBe("student");
        userToken = res.body.token;
    });

    it("POST /api/auth/login succeeds with registered credentials", async () => {
        const res = await request(app).post("/api/auth/login").send({
            email: testEmail,
            password: "StrongPassword123!"
        });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.token).toBeDefined();
    });

    it("GET /api/auth/me returns authenticated user details", async () => {
        const res = await request(app)
            .get("/api/auth/me")
            .set("Authorization", `Bearer ${userToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.user.email).toBe(testEmail);
    });

    it("GET /api/admin/overview rejects student role with 403 Forbidden", async () => {
        const res = await request(app)
            .get("/api/admin/overview")
            .set("Authorization", `Bearer ${userToken}`);

        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
    });
});
