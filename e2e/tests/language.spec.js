const { test, expect } = require("@playwright/test");

test.use({ storageState: ".auth/manager.json" });

test("switching to Arabic translates the app and lays it out right to left", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");

    await page.getByRole("button", { name: /^Language:/ }).click();
    await page.getByRole("menuitemradio", { name: "العربية" }).click();

    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.getByRole("heading", { name: "لوحة القيادة" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "التنقل الرئيسي" }).getByRole("link", { name: "الطلبيات" })).toBeVisible();

    // The choice survives a reload.
    await page.reload();
    await expect(page.getByRole("heading", { name: "لوحة القيادة" })).toBeVisible();

    await page.getByRole("button", { name: /^اللغة:/ }).click();
    await page.getByRole("menuitemradio", { name: "Français" }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.getByRole("heading", { name: "Tableau de bord" })).toBeVisible();
});
