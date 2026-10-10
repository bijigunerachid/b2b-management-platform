const { test, expect } = require("@playwright/test");
const { ACCOUNTS } = require("../accounts");

const as = (role) => ({ storageState: `.auth/${role}.json` });

test.describe("signing in", () => {
    test("a wrong password is refused with a clear message", async ({ page }) => {
        await page.goto("/login");
        await page.getByLabel("Email address").fill(ACCOUNTS.manager.email);
        await page.getByLabel("Password", { exact: true }).fill("not-the-password-1");
        await page.getByRole("button", { name: "Sign in" }).click();
        await expect(page.getByRole("alert")).toContainText(/invalid email or password/i);
        await expect(page).toHaveURL(/\/login$/);
    });

    test("pages need a session", async ({ page }) => {
        await page.goto("/orders");
        await expect(page).toHaveURL(/\/login$/);
    });
});

test.describe("warehouse role", () => {
    test.use(as("warehouse"));

    test("sees stock and orders but no money", async ({ page }) => {
        await page.goto("/");
        const nav = page.getByRole("navigation", { name: "Main navigation" });
        await expect(nav.getByRole("link", { name: "Stock" })).toBeVisible();
        await expect(nav.getByRole("link", { name: "Orders", exact: true })).toBeVisible();
        await expect(nav.getByRole("link", { name: "Receivables" })).toHaveCount(0);
        await expect(nav.getByRole("link", { name: "Reports" })).toHaveCount(0);
    });

    test("is stopped at the door of a money page", async ({ page }) => {
        await page.goto("/receivables");
        await expect(page.getByText("You don't have access to this page")).toBeVisible();
    });
});

test.describe("accountant role", () => {
    test.use(as("accountant"));

    test("has reports and the audit log but can't create orders", async ({ page }) => {
        await page.goto("/orders");
        const nav = page.getByRole("navigation", { name: "Main navigation" });
        await expect(nav.getByRole("link", { name: "Reports" })).toBeVisible();
        await expect(nav.getByRole("link", { name: "Audit log" })).toBeVisible();
        await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Create order" })).toHaveCount(0);
    });
});

test.describe("employee role", () => {
    test.use(as("employee"));

    test("browses read-only", async ({ page }) => {
        await page.goto("/customers");
        await expect(page.getByRole("heading", { name: "Customers" })).toBeVisible();
        await expect(page.getByRole("button", { name: /add customer/i })).toHaveCount(0);
        await page.goto("/users");
        await expect(page.getByText("You don't have access to this page")).toBeVisible();
    });
});
