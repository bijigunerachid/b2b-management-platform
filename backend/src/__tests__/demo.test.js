const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../server");
const pool = require("../config/database");
const validateEnv = require("../config/validateEnv");
const { DEMO_ACCOUNTS } = require("../config/demo");

function withDemo(enabled) {
    const saved = { mode: process.env.DEMO_MODE, password: process.env.DEMO_PASSWORD };
    beforeEach(() => {
        if (enabled) {
            process.env.DEMO_MODE = "true";
            process.env.DEMO_PASSWORD = "TryTheDemo2026";
        } else {
            delete process.env.DEMO_MODE;
        }
    });
    afterEach(() => {
        if (saved.mode === undefined) delete process.env.DEMO_MODE;
        else process.env.DEMO_MODE = saved.mode;
        if (saved.password === undefined) delete process.env.DEMO_PASSWORD;
        else process.env.DEMO_PASSWORD = saved.password;
    });
}

describe("demo mode off (the default)", () => {
    withDemo(false);

    test("the login page gets no demo accounts", async () => {
        const response = await request(app).get("/api/demo");
        expect(response.body.data).toEqual({ enabled: false });
    });

    test("account actions go through normal authentication", async () => {
        expect((await request(app).post("/api/users").send({})).status).toBe(401);
        expect((await request(app).post("/api/auth/password").send({})).status).toBe(401);
    });
});

describe("demo mode on", () => {
    withDemo(true);

    test("lists the one-click accounts, the shared password and the reset time", async () => {
        const { data } = (await request(app).get("/api/demo")).body;
        expect(data.enabled).toBe(true);
        expect(data.password).toBe("TryTheDemo2026");
        expect(data.reset_time).toBeTruthy();
        expect(data.accounts.map((account) => account.key)).toEqual(DEMO_ACCOUNTS.map((account) => account.key));
        expect(data.accounts.find((account) => account.key === "client").role).toBe("Customer");
    });

    test.each([
        ["post", "/api/users"],
        ["put", "/api/users/3"],
        ["patch", "/api/users/3/status"],
        ["post", "/api/auth/password"],
        ["patch", "/api/portal-users/4/status"],
        ["post", "/api/customers/5/portal-users"]
    ])("refuses %s %s, which would lock other visitors out", async (method, path) => {
        const response = await request(app)[method](path).send({});
        expect(response.status).toBe(403);
        expect(response.body.message).toMatch(/turned off in the demo/);
    });

    test("signing out doesn't end the shared account's other sessions", async () => {
        const query = jest.spyOn(pool, "query");
        const token = jwt.sign({ userId: 2, tokenVersion: 0 }, process.env.JWT_SECRET, { algorithm: "HS256", expiresIn: "1h" });
        const response = await request(app).post("/api/auth/logout").set("Cookie", `token=${token}`);
        expect(response.status).toBe(200);
        expect(query).not.toHaveBeenCalled();
        query.mockRestore();
    });

    test("the server refuses to start without a usable demo password", () => {
        const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
        process.env.DEMO_PASSWORD = "short";
        expect(() => validateEnv()).toThrow(/DEMO_PASSWORD/);
        process.env.DEMO_PASSWORD = "TryTheDemo2026";
        expect(validateEnv()).toBe(true);
        warn.mockRestore();
    });
});
