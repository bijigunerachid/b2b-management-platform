
const { authorize } = require("../middleware/roleMiddleware");

describe("Role-Based Authorization", () => {
    function createMocks(role) {
        const req = {
            user: role ? { role } : null
        };

        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        const next = jest.fn();

        return { req, res, next };
    }

    test("Rejects requests without an authenticated user", () => {
        const { req, res, next } = createMocks(null);

        authorize("Admin")(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    test("Allows Admin to access an Admin-only route", () => {
        const { req, res, next } = createMocks("Admin");

        authorize("Admin")(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
    });

    test("Rejects Employee from an Admin-only route", () => {
        const { req, res, next } = createMocks("Employee");

        authorize("Admin")(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });

    test("Allows Manager when Manager is an authorized role", () => {
        const { req, res, next } = createMocks("Manager");

        authorize("Admin", "Manager")(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
    });

    test("Rejects Manager from an Admin-only route", () => {
        const { req, res, next } = createMocks("Manager");

        authorize("Admin")(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });
});