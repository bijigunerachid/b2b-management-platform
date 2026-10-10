const { describe: describeRequest, diff, sanitize } = require("../audit/describe");

const ok = { status: 200, body: {} };

describe("describe", () => {
    test("ignores reads and failed requests", () => {
        expect(describeRequest({ method: "GET", path: "/api/orders" }, ok)).toBeNull();
        expect(describeRequest({ method: "POST", path: "/api/orders", body: {} }, { status: 409, body: {} })).toBeNull();
    });

    test("ignores POSTs that only read", () => {
        expect(describeRequest({ method: "POST", path: "/api/pricing/preview", body: {} }, ok)).toBeNull();
        expect(describeRequest({ method: "POST", path: "/api/portal/cart/price", body: {} }, ok)).toBeNull();
    });

    test("records sign-ins, failed ones included, without the password", () => {
        const success = describeRequest(
            { method: "POST", path: "/api/auth/login", body: { email: "a@b.ma", password: "secret" } },
            { status: 200, body: { user: { id: 7, role: "Manager" } } }
        );
        expect(success).toMatchObject({ action: "auth.login", actor: { id: 7, role: "Manager" }, entity: ["user", 7], details: null });

        const failed = describeRequest({ method: "POST", path: "/api/auth/login", body: { email: " A@B.ma ", password: "x" } }, { status: 401, body: {} });
        expect(failed).toMatchObject({ action: "auth.login_failed", actor: null, summary: "Failed sign-in for a@b.ma", details: { email: "a@b.ma" } });
        expect(JSON.stringify(failed)).not.toContain("password");
    });

    test("names the entity and writes a readable summary", () => {
        expect(describeRequest({ method: "PATCH", path: "/api/orders/42/status", body: { status: "Completed" } }, ok)).toMatchObject({
            action: "order.status_changed", entity: ["order", "42"], summary: "Moved order #42 to Completed"
        });
        expect(describeRequest({ method: "POST", path: "/api/orders", body: { customer_id: 3 } }, { status: 201, body: { data: { orderId: 99 } } })).toMatchObject({
            action: "order.created", entity: ["order", 99]
        });
        expect(describeRequest({ method: "POST", path: "/api/quotes/5/convert" }, { status: 201, body: { data: { orderId: 12 } } }).summary).toBe("Converted quote #5 into order #12");
    });

    test("anything unmapped is still recorded", () => {
        expect(describeRequest({ method: "DELETE", path: "/api/something/new", body: {} }, ok)).toMatchObject({ action: "request", summary: "DELETE /api/something/new" });
    });

    test("stored request bodies never contain secrets", () => {
        const entry = describeRequest({ method: "POST", path: "/api/users", body: { email: "x@y.ma", password: "Hunter2!", nested: { api_token: "t" } } }, { status: 201, body: { userId: 4 } });
        expect(entry.details).toEqual({ email: "x@y.ma", password: "[hidden]", nested: { api_token: "[hidden]" } });
        expect(entry.entity).toEqual(["user", 4]);
    });
});

test("sanitize caps long strings and deep objects", () => {
    expect(sanitize("x".repeat(600))).toHaveLength(503);
    expect(sanitize({ a: { b: { c: { d: { e: 1 } } } } })).toEqual({ a: { b: { c: { d: "[...]" } } } });
});

test("diff lists only changed fields and ignores number formatting", () => {
    expect(diff(
        { name: "Chair", price: "850.10", is_active: 1, note: null },
        { name: "Chair Pro", price: 850.1, is_active: true, note: "" },
        ["name", "price", "is_active", "note"]
    )).toEqual([{ field: "name", from: "Chair", to: "Chair Pro" }]);
});

test("diff keeps leading zeros, so phone numbers and references stay intact", () => {
    expect(diff({ phone: "0699999999" }, { phone: "+212 699999999" }, ["phone"])).toEqual([{ field: "phone", from: "0699999999", to: "+212 699999999" }]);
});
