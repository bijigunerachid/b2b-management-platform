const { test, expect } = require("@playwright/test");

test.use({ storageState: ".auth/manager.json" });

test("quote: draft, send, accept, convert into an order", async ({ page }) => {
    await page.goto("/quotes");
    await page.getByRole("button", { name: "New quote" }).first().click();

    const builder = page.getByRole("dialog", { name: "Create a quote" });
    await builder.getByRole("combobox", { name: /^Customer/ }).selectOption({ index: 1 });
    // Pick a product with stock, or converting would be (rightly) blocked.
    const product = builder.getByLabel("Product for line 1");
    for (let index = 1; ; index += 1) {
        await product.selectOption({ index });
        const stock = Number((await builder.getByText(/\d+ in stock/).first().textContent()).match(/(\d+) in stock/)[1]);
        if (stock >= 2) break;
    }
    await builder.getByLabel("Quantity for line 1").fill("2");
    await builder.getByLabel("Unit price for line 1").fill("99.50");
    await builder.getByRole("button", { name: /^Create draft/ }).click();
    await expect(page.getByText("Draft quote created.")).toBeVisible();

    const drawer = page.getByRole("dialog", { name: /^QUO-\d{4}-\d{6}$/ });
    await expect(drawer).toBeVisible();

    for (const [button, confirmLabel] of [["Mark as sent", "Mark as sent"], ["Accept", "Mark accepted"], ["Convert to order", "Create order"]]) {
        await drawer.getByRole("button", { name: button, exact: true }).click();
        await page.getByRole("dialog").getByRole("button", { name: confirmLabel, exact: true }).last().click();
    }

    const toast = page.getByText(/^Order #\d+ created from QUO-/);
    await expect(toast).toBeVisible();
    const orderId = (await toast.textContent()).match(/#(\d+)/)[1];

    // The order keeps the negotiated price.
    await page.goto(`/orders?view=${orderId}`);
    const order = page.getByRole("dialog", { name: `Order #${orderId}` });
    await expect(order.getByText(/99,50\s?MAD each/)).toBeVisible();
});
