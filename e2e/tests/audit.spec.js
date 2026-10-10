const { test, expect } = require("@playwright/test");
const { ACCOUNTS } = require("../accounts");

test("changes made in the app appear in the audit log", async ({ browser }) => {
    // The warehouse corrects a stock level...
    const warehouse = await browser.newContext({ storageState: ".auth/warehouse.json" });
    const page = await warehouse.newPage();
    await page.goto("/products");
    await page.getByRole("button", { name: "Stock history" }).first().click();
    await page.getByRole("button", { name: "Adjust stock" }).click();
    const adjust = page.getByRole("dialog").last();
    await adjust.getByRole("tab", { name: "Add stock" }).click();
    await adjust.getByLabel("Quantity").fill("1");
    await adjust.getByLabel("Reason").selectOption("Found");
    await adjust.getByRole("button", { name: /^Set stock to/ }).click();
    await expect(page.getByRole("button", { name: /^Set stock to/ })).toHaveCount(0);
    await warehouse.close();

    // ...and the accountant finds it, with who did it and the before/after level.
    const accountant = await browser.newContext({ storageState: ".auth/accountant.json" });
    const log = await accountant.newPage();
    await log.goto("/audit?action=stock");
    const entry = log.getByRole("listitem").filter({ hasText: /Adjusted stock of product #\d+ by \+1 \(Found\)/ }).first();
    await expect(entry).toBeVisible();
    await expect(entry).toContainText(`${ACCOUNTS.warehouse.first_name} ${ACCOUNTS.warehouse.last_name}`);
    await expect(entry).toContainText(/stock:\s*\d+\s*→\s*\d+/);
    await accountant.close();
});

test("failed sign-ins are recorded", async ({ browser }) => {
    const anonymous = await browser.newContext();
    const page = await anonymous.newPage();
    await page.goto("/login");
    await page.getByLabel("Email address").fill(ACCOUNTS.employee.email);
    await page.getByLabel("Password", { exact: true }).fill("wrong-password-9");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await anonymous.close();

    const accountant = await browser.newContext({ storageState: ".auth/accountant.json" });
    const log = await accountant.newPage();
    await log.goto("/audit?action=auth");
    await expect(log.getByText(`Failed sign-in for ${ACCOUNTS.employee.email}`).first()).toBeVisible();
    await accountant.close();
});
