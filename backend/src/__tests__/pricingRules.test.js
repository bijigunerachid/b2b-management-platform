const {
    bestVolumeBreak,
    nextVolumeBreak,
    parseCustomerPrice,
    parsePriceList,
    parseVolumeDiscount,
    resolvePrice
} = require("../pricing/pricingRules");

const chair = { id: 3, price: "1000.00", category_id: 2 };
const breaks = [
    { category_id: null, min_quantity: 20, discount_percent: 2 },
    { category_id: null, min_quantity: 50, discount_percent: 4 },
    { category_id: 2, min_quantity: 30, discount_percent: 6 },
    { category_id: 9, min_quantity: 5, discount_percent: 20 }
];
const gold = { name: "Gold", discount_percent: 10 };

describe("resolvePrice", () => {
    test("no rules means the catalog price", () => {
        expect(resolvePrice({}, chair, 1)).toEqual({ unitPrice: 1000, listPrice: 1000, source: "list", discountPercent: 0, label: null });
    });

    test("price list discount", () => {
        expect(resolvePrice({ priceList: gold }, chair, 1)).toMatchObject({ unitPrice: 900, source: "price_list", label: "Gold −10%" });
    });

    test("price list and volume discounts compound", () => {
        expect(resolvePrice({ priceList: gold, breaks }, chair, 30)).toMatchObject({
            unitPrice: 846, // 1000 × 0.9 × 0.94
            source: "volume",
            discountPercent: 15.4,
            label: "Gold −10%, 30+ units −6%"
        });
    });

    test("a contract price wins over every discount", () => {
        const context = { priceList: gold, breaks, contracts: new Map([[3, 700]]) };
        expect(resolvePrice(context, chair, 100)).toMatchObject({ unitPrice: 700, source: "contract", discountPercent: 30, label: "Contract price" });
    });

    test("rounds to cents", () => {
        expect(resolvePrice({ priceList: { name: "Odd", discount_percent: 3.5 } }, { id: 1, price: "9.99", category_id: 1 }, 1).unitPrice).toBe(9.64);
    });
});

describe("volume breaks", () => {
    test.each([
        [19, null],
        [20, 2],
        [30, 6], // category break beats the global 2%
        [60, 6], // still larger than the global 4%
    ])("quantity %i gets %p%%", (quantity, percent) => {
        expect(bestVolumeBreak(breaks, 2, quantity)?.discount_percent ?? null).toBe(percent);
    });

    test("other categories' breaks never apply", () => {
        expect(bestVolumeBreak(breaks, 2, 10)).toBeNull();
    });

    test("next break is the smallest quantity that improves the discount", () => {
        expect(nextVolumeBreak(breaks, 2, 10)).toMatchObject({ min_quantity: 20 });
        expect(nextVolumeBreak(breaks, 2, 25)).toMatchObject({ min_quantity: 30 });
        expect(nextVolumeBreak(breaks, 2, 30)).toBeNull();
    });
});

describe("payload parsing", () => {
    test("price list", () => {
        expect(parsePriceList({ name: " Gold ", discount_percent: "7.5" }).value).toEqual({ name: "Gold", description: null, discountPercent: 7.5, isActive: true });
        expect(parsePriceList({ name: "Gold", discount_percent: 0 }).error).toMatch(/discount/);
        expect(parsePriceList({ name: "Gold", discount_percent: 60 }).error).toMatch(/50%/);
        expect(parsePriceList({ name: "G", discount_percent: 5 }).error).toMatch(/name/);
    });

    test("volume discount", () => {
        expect(parseVolumeDiscount({ category_id: "", min_quantity: 20, discount_percent: 3 }).value).toEqual({ categoryId: null, minQuantity: 20, discountPercent: 3 });
        expect(parseVolumeDiscount({ category_id: 4, min_quantity: 1, discount_percent: 3 }).error).toMatch(/minimum quantity/);
    });

    test("customer price", () => {
        expect(parseCustomerPrice({ product_id: 3, unit_price: "12.345" }).value).toEqual({ productId: 3, unitPrice: 12.35, note: null });
        expect(parseCustomerPrice({ product_id: 3, unit_price: -1 }).error).toMatch(/price/);
    });
});
