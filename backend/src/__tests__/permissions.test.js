const { PERMISSIONS, STAFF_ROLES, can, permissionsFor } = require("../config/permissions");
const { requirePermission } = require("../middleware/roleMiddleware");

describe("permission table", () => {
    test("every permission names only known staff roles", () => {
        for (const [key, { roles, label, group }] of Object.entries(PERMISSIONS)) {
            expect(label && group).toBeTruthy();
            expect(roles.length).toBeGreaterThan(0);
            for (const role of roles) expect(Object.keys(STAFF_ROLES)).toContain(role);
            expect(roles).toContain("Admin"); // Admins can always do everything
            expect(key).toMatch(/^[a-z]+\.[a-z]+$/);
        }
    });

    test("portal accounts get no staff permissions", () => {
        expect(permissionsFor("Customer")).toEqual([]);
    });

    test.each([
        ["Accountant", "payments.void", true],
        ["Accountant", "reports.view", true],
        ["Accountant", "orders.write", false],
        ["Accountant", "products.write", false],
        ["Warehouse", "purchasing.receive", true],
        ["Warehouse", "orders.fulfil", true],
        ["Warehouse", "orders.write", false],
        ["Warehouse", "payments.view", false],
        ["Warehouse", "costs.view", false],
        ["Employee", "costs.view", false],
        ["Employee", "orders.view", true],
        ["Manager", "users.manage", false],
        ["Manager", "audit.view", false]
    ])("%s → %s is %s", (role, permission, expected) => {
        expect(can({ role }, permission)).toBe(expected);
    });
});

describe("requirePermission", () => {
    const run = (user, permission) => {
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const next = jest.fn();
        requirePermission(permission)({ user }, res, next);
        return { res, next };
    };

    test("lets allowed roles through", () => {
        expect(run({ role: "Warehouse" }, "inventory.adjust").next).toHaveBeenCalled();
    });

    test("refuses other roles with 403 and anonymous requests with 401", () => {
        expect(run({ role: "Employee" }, "inventory.adjust").res.status).toHaveBeenCalledWith(403);
        expect(run(null, "inventory.adjust").res.status).toHaveBeenCalledWith(401);
    });

    test("an unknown permission is a programming error", () => {
        expect(() => requirePermission("orders.delete")).toThrow(/Unknown permission/);
    });
});
