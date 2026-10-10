const { test: setup, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const { ACCOUNTS, PASSWORD } = require("../accounts");

// Signs in once per role through the real login form and saves the session,
// so each test starts already signed in.
for (const [key, account] of Object.entries(ACCOUNTS)) {
    setup(`sign in as ${key}`, async ({ page }) => {
        await page.goto("/login");
        await page.getByLabel("Email address").fill(account.email);
        await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
        await page.getByRole("button", { name: "Sign in" }).click();
        await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
        await page.context().storageState({ path: path.join(__dirname, `../.auth/${key}.json`) });
    });
}

setup("sign in as the portal client", async ({ page }) => {
    const buyer = JSON.parse(fs.readFileSync(path.join(__dirname, "../.auth/portal.json"), "utf8"));
    await page.goto("/login");
    await page.getByLabel("Email address").fill(buyer.email);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: buyer.company_name })).toBeVisible();
    await page.context().storageState({ path: path.join(__dirname, "../.auth/client.json") });
});
