const { test, expect } = require("@playwright/test");

test.use({ storageState: ".auth/manager.json" });

// The test servers have no mail server, so emails land in the outbox: this
// checks the whole path (form, API, log, preview) without sending anything.
test("emailing an invoice saves it to the outbox and shows it on the Emails page", async ({ page }) => {
    await page.goto("/orders");
    await page.getByRole("button", { name: "Create order" }).click();
    const form = page.getByRole("dialog", { name: "Create an order" });
    await form.getByRole("combobox", { name: /^Customer/ }).selectOption({ index: 1 });
    const product = form.getByLabel("Product for line 1");
    const value = await product.locator("option:not([disabled]):not([value=''])").first().getAttribute("value");
    await product.selectOption(value);
    await form.getByRole("button", { name: /^Create order ·/ }).click();

    const drawer = page.getByRole("dialog", { name: /^Order #\d+$/ });
    await expect(drawer).toBeVisible();
    await drawer.getByRole("button", { name: "Email invoice" }).click();

    const send = page.getByRole("dialog", { name: "Email the invoice" });
    await expect(send.getByText(/No mail server is set up/)).toBeVisible();

    // A list of addresses is refused (by the browser here, and by the API too),
    // so no hidden recipients can be added.
    await send.getByLabel("To").fill("a@client.example, b@other.example");
    await send.getByRole("button", { name: "Send" }).click();
    expect(await send.getByLabel("To").evaluate((input) => input.validity.valid)).toBe(false);
    await expect(send).toBeVisible();

    await send.getByLabel("To").fill("accounts@client.example");
    await send.getByLabel("Language").selectOption("en");
    await send.getByLabel("Message").fill("Thank you for your order.");
    await send.getByRole("button", { name: "Send" }).click();

    await expect(page.getByText("Saved to the outbox")).toBeVisible();
    await expect(drawer.getByText("Invoice · accounts@client.example")).toBeVisible();

    await page.goto("/emails");
    const row = page.getByRole("row").filter({ hasText: "accounts@client.example" }).first();
    await expect(row.getByText("In the outbox")).toBeVisible();
    await row.click();
    const preview = page.getByRole("dialog", { name: /INV-\d{4}-\d{6}/ });
    await expect(preview.getByText(/To accounts@client\.example/)).toBeVisible();
    await expect(preview.frameLocator("iframe").getByText("Thank you for your order.")).toBeVisible();
});
