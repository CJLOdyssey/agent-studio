import { test, expect } from '@playwright/test';
import { loginAsDefaultUser } from './fixtures';

test.describe('Agent CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDefaultUser(page);
  });

  test('should display agent list in sidebar', async ({ page }) => {
    const agents = page.locator('.agentstudio-sidebar .agentstudio-team-agent-item');
    // Agents are rendered after team expansion
    await expect(agents.first()).toBeVisible({ timeout: 10000 });
  });

  test('should open agent config modal on agent click', async ({ page }) => {
    const agents = page.locator('.agentstudio-sidebar .agentstudio-team-agent-item');
    await expect(agents.first()).toBeVisible({ timeout: 10000 });
    await agents.first().click();

    await expect(page.getByText(/与.*对话/)).toBeVisible();
  });

  test('should send a message to selected agent', async ({ page }) => {
    const agents = page.locator('.agentstudio-sidebar .agentstudio-team-agent-item');
    await expect(agents.first()).toBeVisible({ timeout: 10000 });
    await agents.first().click();

    const textarea = page.getByPlaceholderText(/描述你的需求/);
    await textarea.fill('Hello, this is an E2E test message');
    await textarea.press('Enter');

    await expect(page.locator('.agentstudio-messages-inner')).toContainText('Hello, this is an E2E test message');
  });
});
