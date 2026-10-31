const request = require("supertest");
const app = require("../server");

describe("System Health & Diagnostic API", () => {
    it("GET /api/health returns operational status and 200 OK", async () => {
        const res = await request(app).get("/api/health");
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.status).toBe("healthy");
        expect(res.body.service).toBe("ai-psychometric-backend");
    });

    it("GET / returns system information envelope", async () => {
        const res = await request(app).get("/");
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.version).toBe("2.0.0");
    });

    it("GET /api/unknown-endpoint triggers centralized 404 handler", async () => {
        const res = await request(app).get("/api/non-existent-route-check");
        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toContain("Resource not found");
    });
});
