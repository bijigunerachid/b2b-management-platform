const { test, expect } = require("@playwright/test");

const as = (role) => ({ storageState: `.auth/${role}.json` });

test.describe("help assistant", () => {
    test.use(as("manager"));

    test("explains the current page and answers a question with a typo", async ({ page }) => {
        await page.goto("/receivables");
        await page.getByRole("button", { name: "Open the helper" }).click();
        const helper = page.getByRole("dialog", { name: "Helper" });

        await helper.getByRole("button", { name: "Explain this page" }).click();
        await expect(helper.getByText("Recording and voiding payments").first()).toBeVisible();

        await helper.getByLabel("Your question").fill("how do I cancle an order");
        await helper.getByRole("button", { name: "Send" }).click();
        await expect(helper.getByText("Order statuses and cancelling").first()).toBeVisible();

        await helper.getByRole("button", { name: "Open this page" }).last().click();
        await expect(page).toHaveURL(/\/orders$/);
    });
});

test.describe("help assistant on the portal", () => {
    test.use(as("client"));

    test("only gives clients portal help", async ({ page }) => {
        await page.goto("/portal");
        await page.getByRole("button", { name: "Open the helper" }).click();
        const helper = page.getByRole("dialog", { name: "Helper" });
        await helper.getByLabel("Your question").fill("how do I download my invoice");
        await helper.getByRole("button", { name: "Send" }).click();
        await expect(helper.getByText("Invoices and what you owe").first()).toBeVisible();
    });
});
