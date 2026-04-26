import { test, expect, Page } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FIXTURES = path.join(__dirname, "../fixtures");

/** Navigate to the Files panel from any starting page. */
async function navigateToFiles(page: Page) {
  const filesTab = page.locator('[aria-label="Files"], button:has-text("Files")');
  if (await filesTab.count() > 0) {
    await filesTab.first().click();
  }
  await page.waitForSelector(".files-panel", { timeout: 5000 }).catch(() => {});
}

/**
 * Ingest the sample CSV fixture via the ingest-dropzone file-chooser.
 */
async function ingestCsvFixture(page: Page) {
  await navigateToFiles(page);

  const dropzone = page.locator("[data-testid=ingest-dropzone]");
  await expect(dropzone).toBeVisible({ timeout: 5000 });
  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    dropzone.click(),
  ]);
  await fileChooser.setFiles(path.join(FIXTURES, "sample.csv"));
  await expect(page.locator("[data-testid=file-root-card]").first()).toBeVisible({ timeout: 10000 });
}

test.describe.skip("FileViewerModal — CSV viewer", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await ingestCsvFixture(page);
  });

  test("opening a CSV file shows the Table tab with rows", async ({ page }) => {
    await page.locator("[data-testid=file-root-card]").first().click();
    const modal = page.locator("[data-testid=file-viewer-modal]");
    await expect(modal).toBeVisible({ timeout: 5000 });
    await expect(modal.locator("[role=tab][data-value=table]")).toBeVisible();
    await expect(modal.locator("[data-testid=csv-table-row]").first()).toBeVisible({ timeout: 5000 });
  });

  test("switching to Charts tab renders at least one chart canvas", async ({ page }) => {
    await page.locator("[data-testid=file-root-card]").first().click();
    const modal = page.locator("[data-testid=file-viewer-modal]");
    await expect(modal).toBeVisible({ timeout: 5000 });
    await modal.locator("[role=tab][data-value=charts]").click();
    await expect(modal.locator("canvas").first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe.skip("FileViewerModal — error boundary", () => {
  test("error boundary shows fallback UI when a render error is injected", async ({ page }) => {
    await page.goto("/");
    await ingestCsvFixture(page);
    await page.addScriptTag({ content: "window.__FORCE_VIEWER_ERROR__ = true;" });
    await page.locator("[data-testid=file-root-card]").first().click();
    const modal = page.locator("[data-testid=file-viewer-modal]");
    await expect(modal).toBeVisible({ timeout: 5000 });
    await expect(modal.getByText("Couldn't load this file")).toBeVisible({ timeout: 5000 });
  });

  test("re-index button in error fallback triggers re-index without page reload", async ({ page }) => {
    await page.goto("/");
    await ingestCsvFixture(page);
    await page.addScriptTag({ content: "window.__FORCE_VIEWER_ERROR__ = true;" });
    await page.locator("[data-testid=file-root-card]").first().click();
    const modal = page.locator("[data-testid=file-viewer-modal]");
    await expect(modal.getByText("Couldn't load this file")).toBeVisible({ timeout: 5000 });
    await page.addScriptTag({ content: "window.__FORCE_VIEWER_ERROR__ = false;" });
    await modal.getByRole("button", { name: /re-index/i }).click();
    await expect(page).toHaveURL("/");
    await expect(modal.getByText("Couldn't load this file")).not.toBeVisible({ timeout: 5000 });
  });

  test("modal close animation completes before modal is removed from DOM", async ({ page }) => {
    await page.goto("/");
    await ingestCsvFixture(page);
    await page.locator("[data-testid=file-root-card]").first().click();
    const modal = page.locator("[data-testid=file-viewer-modal]");
    await expect(modal).toBeVisible({ timeout: 5000 });
    await modal.locator("[data-testid=modal-close-button]").click();
    await expect(modal).not.toBeAttached({ timeout: 2000 });
  });
});
