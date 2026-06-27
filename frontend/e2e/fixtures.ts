import { type Page } from '@playwright/test';

export async function loginAsDefaultUser(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
}

export async function navigateToWorkstation(page: Page) {
  await page.click('[data-testid="workstation-nav"]');
  await page.waitForSelector('[data-testid="wsta-panel"]');
}

export async function selectModule(page: Page, moduleName: string) {
  await page.click(`[data-testid="tab-${moduleName}"]`);
  await page.waitForSelector('[data-testid="module-content"]');
}

export async function waitForTableLoaded(page: Page) {
  await page.waitForSelector('[data-testid="data-table"]');
}

export async function takeEvidenceScreenshot(page: Page, name: string) {
  await page.screenshot({ path: `e2e-evidence/${name}.png`, fullPage: true });
}
