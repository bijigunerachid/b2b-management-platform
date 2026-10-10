const { test, expect } = require("@playwright/test");

test("a client orders from the portal and staff see the order", async ({ browser }) => {
    const client = await browser.newContext({ storageState: ".auth/client.json" });
    const page = await client.newPage();

    await page.goto("/portal/catalog");
    await page.getByRole("button", { name: "Add", exact: true }).first().click();
    await expect(page.getByText(/added to your cart/)).toBeVisible();
    await page.getByRole("button", { name: /^Cart, \d+ items?$/ }).click();

    const cart = page.getByRole("dialog");
    await cart.getByRole("button", { name: /^Place order ·/ }).click();
    await expect(page.getByText(/^We received order #\d+/)).toBeVisible();
    await expect(page).toHaveURL(/\/portal\/orders\?view=\d+/);
    const orderId = new URL(page.url()).searchParams.get("view");
    await client.close();

    const staff = await browser.newContext({ storageState: ".auth/manager.json" });
    const staffPage = await staff.newPage();
    await staffPage.goto(`/orders?view=${orderId}`);
    const drawer = staffPage.getByRole("dialog", { name: `Order #${orderId}` });
    await expect(drawer.getByText("Pending").first()).toBeVisible();
    await staff.close();
});

test("clients can't open staff pages", async ({ browser }) => {
    const client = await browser.newContext({ storageState: ".auth/client.json" });
    const page = await client.newPage();
    await page.goto("/orders");
    await expect(page).toHaveURL(/\/portal$/);
    await client.close();
});
