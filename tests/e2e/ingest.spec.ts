/**
 * ingest.spec.ts — Commit 1 road-repair smoke test
 *
 * Stripped to one stable smoke test to establish a green CI baseline.
 * Full ingest pipeline tests will be re-added after unit coverage is in place.
 */

import { test, expect } from "@playwright/test";

test("files panel opens", async ({ page }) => {
  await page.goto("/");
  const filesTab = page.locator('[aria-label="Files"], button:has-text("Files")');
  await filesTab.first().click();
  await expect(page.locator(".files-panel")).toBeVisible();
});
