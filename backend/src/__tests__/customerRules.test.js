const validate = require("../middleware/validate");
const customerRules = require("../validation/customerRules");

function run(body) {
    const req = { body };
    const res = {
        statusCode: 200,
        payload: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(data) {
            this.payload = data;
            return this;
        }
    };
    const next = jest.fn();

    validate(customerRules)(req, res, next);

    return { res, next };
}

describe("customer validation rules", () => {
    test("accepts the payload the frontend sends", () => {
        const { next, res } = run({
            company_name: "Atlas Solutions",
            contact_name: "Sara Alaoui",
            email: "sara@atlas.ma",
            phone: "+212 600 000 000",
            address: "12 Rue Hassan II",
            city: "Agadir",
            country: "Morocco"
        });

        expect(next).toHaveBeenCalled();
        expect(res.statusCode).toBe(200);
    });

    test("requires company and contact names", () => {
        const { next, res } = run({ email: "a@b.co" });

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(400);
        expect(res.payload.errors.map((e) => e.field)).toEqual([
            "company_name",
            "contact_name"
        ]);
    });

    test("rejects an invalid email", () => {
        const { res } = run({
            company_name: "Atlas",
            contact_name: "Sara",
            email: "not-an-email"
        });

        expect(res.statusCode).toBe(400);
    });
});
