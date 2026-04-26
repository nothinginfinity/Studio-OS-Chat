import { test, expect, Page } from "@playwright/test";

const MOCK_LLM_RESPONSE = {
  id: "chatcmpl-test",
  object: "chat.completion",
  choices: [
    {
      index: 0,
      message: { role: "assistant", content: "This is a mocked assistant reply." },
      finish_reason: "stop",
    },
  ],
};

async function mockLLM(page: Page) {
  await page.route("**/api/chat**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_LLM_RESPONSE),
    });
  });
  await page.route("**/v1/chat/completions**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_LLM_RESPONSE),
    });
  });
}

test.describe("Chat flow — empty state", () => {
  test("empty MessageList shows empty-state heading and 3 prompt chips", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Start a conversation")).toBeVisible({ timeout: 5000 });
    const chips = page.locator("[data-testid=prompt-chip]");
    await expect(chips).toHaveCount(3);
  });

  test("clicking a prompt chip pre-fills the chat input", async ({ page }) => {
    await page.goto("/");
    const chip = page.locator("[data-testid=prompt-chip]").first();
    const chipText = await chip.textContent();
    await chip.click();
    const input = page.locator("[data-testid=chat-input]");
    await expect(input).toHaveValue(chipText ?? "");
  });
});

test.describe("Chat flow — sending messages", () => {
  test.beforeEach(async ({ page }) => {
    await mockLLM(page);
    await page.goto("/");
  });

  test("sending a message adds a user bubble immediately", async ({ page }) => {
    await page.locator("[data-testid=chat-input]").fill("Hello, test message");
    await page.locator("[data-testid=chat-send-button]").click();
    const userBubble = page.locator("[data-testid=message-bubble][data-role=user]").last();
    await expect(userBubble).toBeVisible({ timeout: 3000 });
    await expect(userBubble).toContainText("Hello, test message");
  });

  test("assistant bubble appears after mocked LLM response", async ({ page }) => {
    await page.locator("[data-testid=chat-input]").fill("What is 2 + 2?");
    await page.locator("[data-testid=chat-send-button]").click();
    const assistantBubble = page.locator("[data-testid=message-bubble][data-role=assistant]").last();
    await expect(assistantBubble).toBeVisible({ timeout: 8000 });
    await expect(assistantBubble).toContainText("mocked assistant reply");
  });
});

test.describe("Chat flow — offline state", () => {
  test("send button is disabled and shows tooltip when offline", async ({ page, context }) => {
    await page.goto("/");
    // Pre-fill the input so the send button's disabled state is driven purely
    // by the offline/isLoading condition — not by the empty-input guard
    // (disabled={disabled || !value.trim()}). Without this, the button is
    // disabled for the wrong reason and the test assertion is ambiguous.
    await page.locator("[data-testid=chat-input]").fill("test message");
    await context.setOffline(true);
    await expect(page.locator("[data-testid=offline-banner]")).toBeVisible({ timeout: 2000 });
    const sendButton = page.locator("[data-testid=chat-send-button]");
    await expect(sendButton).toBeDisabled();
    // Tooltip renders unconditionally when disabled===true (React-driven, not CSS :hover)
    await expect(page.locator("[role=tooltip]")).toContainText("internet connection");
  });
});
