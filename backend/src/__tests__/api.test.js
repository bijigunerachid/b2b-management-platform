
const request = require("supertest");
const app = require("../server");

describe("B2B Management Platform API", () => {
    test("GET / returns HTTP 200", async () => {
        const response = await request(app).get("/");

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
    });

    test("Unknown routes return 404", async () => {
        const response = await request(app)
            .get("/api/this-route-does-not-exist");

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
    });

    test("GET /api/users rejects unauthenticated requests", async () => {
        const response = await request(app)
            .get("/api/users");

        expect(response.status).toBe(401);
    });

    test("GET /api/customers rejects unauthenticated requests", async () => {
        const response = await request(app)
            .get("/api/customers");

        expect(response.status).toBe(401);
    });

    test("GET /api/products rejects unauthenticated requests", async () => {
        const response = await request(app)
            .get("/api/products");

        expect(response.status).toBe(401);
    });

    test("ML endpoints reject unauthenticated requests", async () => {
        expect((await request(app).get("/api/ml/models")).status).toBe(401);
        expect((await request(app).get("/api/ml/forecasts/products/1")).status).toBe(401);
    });
});
