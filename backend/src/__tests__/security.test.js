jest.mock("../config/database", () => ({
    query: jest.fn(),
    getConnection: jest.fn()
}));

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-that-is-at-least-32-characters-long";
process.env.DB_HOST = process.env.DB_HOST || "localhost";
process.env.DB_USER = process.env.DB_USER || "test";
process.env.DB_NAME = process.env.DB_NAME || "test";

const request = require("supertest");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const pool = require("../config/database");
const app = require("../server");
const validate = require("../middleware/validate");
const { checkPasswordPolicy } = require("../config/security");
const { createUserRules } = require("../validation/userRules");

const ALLOWED = "http://localhost:5173";
const EVIL = "https://evil.example";

const activeAdmin = {
    id: 1,
    role_id: 1,
    is_active: 1,
    token_version: 3,
    role: "Admin",
    first_name: "Test",
    last_name: "Admin",
    email: "admin@example.com"
};

function sessionCookie(payload, options = {}) {
    const token = jwt.sign(payload, process.env.JWT_SECRET, { algorithm: "HS256", expiresIn: "1h", ...options });
    return `token=${token}`;
}

beforeEach(() => {
    pool.query.mockReset();
});

describe("security headers", () => {
    test("sets hardening headers and hides the framework", async () => {
        const response = await request(app).get("/");

        expect(response.headers["x-powered-by"]).toBeUndefined();
        expect(response.headers["x-content-type-options"]).toBe("nosniff");
        expect(response.headers["x-frame-options"]).toBe("SAMEORIGIN");
        expect(response.headers["content-security-policy"]).toContain("default-src 'none'");
        expect(response.headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    });

    test("API responses are never cached", async () => {
        const response = await request(app).get("/api/customers");
        expect(response.headers["cache-control"]).toBe("no-store");
    });
});

describe("CORS and CSRF", () => {
    test("allows the configured frontend origin with credentials", async () => {
        const response = await request(app).get("/").set("Origin", ALLOWED);

        expect(response.headers["access-control-allow-origin"]).toBe(ALLOWED);
        expect(response.headers["access-control-allow-credentials"]).toBe("true");
    });

    test("does not grant CORS to other origins", async () => {
        const response = await request(app).get("/").set("Origin", EVIL);
        expect(response.headers["access-control-allow-origin"]).toBeUndefined();
    });

    test("blocks state-changing requests from foreign origins", async () => {
        const response = await request(app)
            .post("/api/auth/login")
            .set("Origin", EVIL)
            .send({ email: "a@b.co", password: "x" });

        expect(response.status).toBe(403);
        expect(pool.query).not.toHaveBeenCalled();
    });

    test("blocks foreign Referer when Origin is absent", async () => {
        const response = await request(app)
            .delete("/api/customers/1")
            .set("Referer", `${EVIL}/attack.html`);

        expect(response.status).toBe(403);
    });
});

describe("login", () => {
    test("unknown email gets the same generic answer and still runs bcrypt", async () => {
        pool.query.mockResolvedValueOnce([[]]);
        const compare = jest.spyOn(bcrypt, "compare");

        const response = await request(app)
            .post("/api/auth/login")
            .send({ email: "nobody-1@example.com", password: "whatever123" });

        expect(response.status).toBe(401);
        expect(response.body.message).toBe("Invalid email or password");
        expect(compare).toHaveBeenCalledTimes(1);
        compare.mockRestore();
    });

    test("inactive account is not revealed without the right password", async () => {
        const hash = await bcrypt.hash("correct-password-1", 4);
        pool.query.mockResolvedValueOnce([[{ ...activeAdmin, is_active: 0, password: hash }]]);

        const response = await request(app)
            .post("/api/auth/login")
            .send({ email: "inactive@example.com", password: "wrong-password-1" });

        expect(response.status).toBe(401);
        expect(response.body.message).toBe("Invalid email or password");
    });

    test("successful login sets a strict HttpOnly cookie and no role in the token", async () => {
        const hash = await bcrypt.hash("correct-password-1", 4);
        pool.query.mockResolvedValueOnce([[{ ...activeAdmin, password: hash }]]);

        const response = await request(app)
            .post("/api/auth/login")
            .send({ email: "  Admin@Example.com ", password: "correct-password-1" });

        expect(response.status).toBe(200);
        expect(pool.query.mock.calls[0][1]).toEqual(["admin@example.com"]);
        expect(response.body.user.password).toBeUndefined();

        const cookie = response.headers["set-cookie"][0];
        expect(cookie).toMatch(/HttpOnly/i);
        expect(cookie).toMatch(/SameSite=Strict/i);

        const token = cookie.split(";")[0].split("=")[1];
        const decoded = jwt.decode(token);
        expect(decoded).toMatchObject({ userId: 1, tokenVersion: 3 });
        expect(decoded.role).toBeUndefined();
    });

    test("rejects non-string credentials", async () => {
        const response = await request(app)
            .post("/api/auth/login")
            .send({ email: { $ne: "" }, password: ["x"] });

        expect(response.status).toBe(400);
        expect(pool.query).not.toHaveBeenCalled();
    });

    test("locks an account out after repeated failures", async () => {
        pool.query.mockResolvedValue([[]]);
        const attempt = () =>
            request(app)
                .post("/api/auth/login")
                .send({ email: "target@example.com", password: "guess-123456" });

        for (let i = 0; i < 5; i += 1) {
            expect((await attempt()).status).toBe(401);
        }

        const blocked = await attempt();
        expect(blocked.status).toBe(429);
        expect(blocked.body.message).toMatch(/Too many failed sign-in attempts/);
    });
});

describe("session tokens", () => {
    test("accepts a token whose version matches the database", async () => {
        pool.query.mockResolvedValue([[activeAdmin]]);

        const response = await request(app)
            .get("/api/auth/me")
            .set("Cookie", sessionCookie({ userId: 1, tokenVersion: 3 }));

        expect(response.status).toBe(200);
    });

    test("rejects a revoked token (version bumped by logout or password change)", async () => {
        pool.query.mockResolvedValue([[activeAdmin]]);

        const response = await request(app)
            .get("/api/auth/me")
            .set("Cookie", sessionCookie({ userId: 1, tokenVersion: 2 }));

        expect(response.status).toBe(401);
        expect(response.headers["set-cookie"][0]).toMatch(/token=;/);
    });

    test("rejects unsigned tokens (alg: none)", async () => {
        const forged = jwt.sign({ userId: 1, tokenVersion: 3 }, null, { algorithm: "none" });

        const response = await request(app)
            .get("/api/auth/me")
            .set("Cookie", `token=${forged}`);

        expect(response.status).toBe(401);
        expect(pool.query).not.toHaveBeenCalled();
    });

    test("rejects tokens signed with another secret", async () => {
        const forged = jwt.sign({ userId: 1, tokenVersion: 3 }, "attacker-secret-attacker-secret-1234");

        const response = await request(app)
            .get("/api/auth/me")
            .set("Cookie", `token=${forged}`);

        expect(response.status).toBe(401);
    });

    test("rejects sessions for deactivated users", async () => {
        pool.query.mockResolvedValue([[{ ...activeAdmin, is_active: 0 }]]);

        const response = await request(app)
            .get("/api/auth/me")
            .set("Cookie", sessionCookie({ userId: 1, tokenVersion: 3 }));

        expect(response.status).toBe(401);
    });

    test("logout revokes the session server-side", async () => {
        pool.query.mockResolvedValue([{ affectedRows: 1 }]);

        const response = await request(app)
            .post("/api/auth/logout")
            .set("Cookie", sessionCookie({ userId: 1, tokenVersion: 3 }));

        expect(response.status).toBe(200);
        expect(pool.query.mock.calls[0][0]).toMatch(/token_version = token_version \+ 1/);
        expect(pool.query.mock.calls[0][1]).toEqual([1, 3]);
    });
});

describe("request bodies", () => {
    test("malformed JSON is a 400, not a 500", async () => {
        const response = await request(app)
            .post("/api/auth/login")
            .set("Content-Type", "application/json")
            .send("{bad json");

        expect(response.status).toBe(400);
    });

    test("oversized bodies are rejected with 413", async () => {
        const response = await request(app)
            .post("/api/auth/login")
            .send({ email: "a@b.co", password: "x".repeat(200 * 1024) });

        expect(response.status).toBe(413);
    });
});

describe("validation rules", () => {
    function run(rules, body) {
        const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json() { return this; } };
        const next = jest.fn();
        validate(rules)({ body }, res, next);
        return { res, next };
    }

    test("user rules reject over-long fields and non-integer roles", () => {
        const { res } = run(createUserRules, {
            first_name: "x".repeat(101),
            last_name: "Doe",
            email: "jane@example.com",
            role_id: "1",
            password: "secret-pass-1"
        });

        expect(res.statusCode).toBe(400);
    });

    test("user rules accept a valid payload", () => {
        const { next } = run(createUserRules, {
            first_name: "Jane",
            last_name: "Doe",
            email: "jane@example.com",
            role_id: 2,
            password: "secret-pass-1"
        });

        expect(next).toHaveBeenCalled();
    });

    test.each([
        ["short1", false],
        ["onlyletters-long", false],
        ["1234567890", false],
        ["long-enough-1", true],
        [`${"é".repeat(37)}1`, false]
    ])("password policy: %s → %s", (password, ok) => {
        expect(checkPasswordPolicy(password) === null).toBe(ok);
    });
});
