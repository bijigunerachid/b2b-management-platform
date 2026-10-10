const { test, expect } = require("@playwright/test");

test.use({ storageState: ".auth/manager.json" });

/** Clicks a button in the order drawer, then confirms the dialog it opens. */
async function confirmAction(page, drawer, button) {
    await drawer.getByRole("button", { name: button, exact: true }).click();
    await page.getByRole("dialog", { name: /^Move order #\d+ to / }).getByRole("button", { name: button, exact: true }).click();
}

test("order to cash: create, fulfil, get paid, print the invoice, take a return", async ({ page, context }) => {
    await page.goto("/orders");
    await page.getByRole("button", { name: "Create order" }).click();

    const form = page.getByRole("dialog", { name: "Create an order" });
    await form.getByRole("combobox", { name: /^Customer/ }).selectOption({ index: 1 });
    const product = form.getByLabel("Product for line 1");
    // First product that is in stock.
    const value = await product.locator("option:not([disabled]):not([value=''])").first().getAttribute("value");
    await product.selectOption(value);
    await form.getByLabel("Quantity for line 1").fill("3");
    await form.getByRole("button", { name: /^Create order ·/ }).click();

    await expect(page.getByText("Order created")).toBeVisible();
    const drawer = page.getByRole("dialog", { name: /^Order #\d+$/ });
    await expect(drawer).toBeVisible();
    const orderNumber = (await drawer.getByRole("heading", { name: /^Order #\d+$/ }).textContent()).trim();

    await confirmAction(page, drawer, "Start processing");
    await expect(page.getByText(`${orderNumber} is now Processing.`)).toBeVisible();
    await confirmAction(page, drawer, "Mark completed");
    await expect(drawer.getByText("Completed").first()).toBeVisible();

    // Pay the full balance (the amount is prefilled).
    await drawer.getByRole("button", { name: "Record payment" }).click();
    const payment = page.getByRole("dialog", { name: "Record a payment" });
    await payment.getByLabel("Reference").fill("VIR-E2E-0001");
    await payment.getByRole("button", { name: /^Record / }).click();
    await expect(page.getByText(/is now paid in full/)).toBeVisible();
    await expect(drawer.getByText("Paid", { exact: true })).toBeVisible();

    // The invoice opens in a new tab and shows it as paid.
    const [invoice] = await Promise.all([context.waitForEvent("page"), drawer.getByRole("link", { name: "Invoice" }).click()]);
    await expect(invoice.getByText("INVOICE", { exact: true })).toBeVisible();
    await expect(invoice.getByText("PAID", { exact: true })).toBeVisible();
    await expect(invoice.getByText("VIR-E2E-0001")).toBeVisible();
    await invoice.close();

    // Return one unit: it's already paid, so the credit is refunded.
    await drawer.getByRole("button", { name: "Return items" }).click();
    const returns = page.getByRole("dialog", { name: "Return items" });
    await returns.getByRole("spinbutton").first().fill("1");
    await returns.getByLabel("Refund method").selectOption("Bank transfer");
    await returns.getByRole("button", { name: /^Create credit note for/ }).click();
    await expect(page.getByText(/^CN-\d{4}-\d{6} created$/)).toBeVisible();
    await expect(drawer.getByRole("link", { name: /^CN-\d{4}-\d{6}$/ })).toBeVisible();
});

test("a customer's price list shows up in the order form", async ({ page }) => {
    await page.goto("/orders");
    await page.getByRole("button", { name: "Create order" }).click();
    const form = page.getByRole("dialog", { name: "Create an order" });

    // Pick a customer on a price list (the seed puts about a third of them on one).
    const options = await form.getByRole("combobox", { name: /^Customer/ }).locator("option").allTextContents();
    let found = false;
    for (let index = 1; index < options.length && !found; index += 1) {
        await form.getByRole("combobox", { name: /^Customer/ }).selectOption({ index });
        found = await form.getByText(/price list, −\d/).isVisible();
    }
    expect(found).toBe(true);

    const product = form.getByLabel("Product for line 1");
    const value = await product.locator("option:not([disabled]):not([value=''])").first().getAttribute("value");
    await product.selectOption(value);
    await expect(form.getByText(/−\d+(\.\d+)?%/).first()).toBeVisible();
    await expect(form.getByText("Discounts")).toBeVisible();
});
