
const validate = require("../middleware/validate");

describe("Request Validation Middleware", () => {
    function runValidation(rules, body) {
        const req = { body };

        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        const next = jest.fn();

        validate(rules)(req, res, next);

        return { res, next };
    }

    test("Rejects a missing required field", () => {
        const { res, next } = runValidation(
            [{ field: "name", required: true, type: "string" }],
            {}
        );

        expect(res.status).toHaveBeenCalledWith(400);
        expect(next).not.toHaveBeenCalled();
    });

    test("Accepts a valid customer name", () => {
        const { res, next } = runValidation(
            [{ field: "name", required: true, type: "string", minLength: 2 }],
            { name: "Customer One" }
        );

        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
    });

    test("Rejects a negative product price", () => {
        const { res, next } = runValidation(
            [{ field: "price", required: true, type: "number", min: 0 }],
            { price: -10 }
        );

        expect(res.status).toHaveBeenCalledWith(400);
        expect(next).not.toHaveBeenCalled();
    });

    test("Rejects an invalid email address", () => {
        const { res, next } = runValidation(
            [{ field: "email", required: true, type: "email" }],
            { email: "not-an-email" }
        );

        expect(res.status).toHaveBeenCalledWith(400);
        expect(next).not.toHaveBeenCalled();
    });
});