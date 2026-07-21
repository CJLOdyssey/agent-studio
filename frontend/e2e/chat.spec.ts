import { test, expect } from '@playwright/test';
import { loginAsDefaultUser } from './fixtures';

test.describe('Chat — session management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDefaultUser(page);
  });

  test('should show greeting on home page', async ({ page }) => {
    await expect(page.getByText('描述你的需求，我来帮你分析和规划')).toBeVisible();
  });

  test('should display typing animation on home page', async ({ page }) => {
    const cursor = page.locator('.typing-cursor');
    await expect(cursor).toBeVisible();
  });

  test('should allow typing in chat input', async ({ page }) => {
    const textarea = page.getByPlaceholderText(/描述你的需求/);
    await textarea.fill('你好，请帮我分析一下项目结构');
    await expect(textarea).toHaveValue('你好，请帮我分析一下项目结构');
  });

  test('should add user message bubble on Enter press', async ({ page }) => {
    const textarea = page.getByPlaceholderText(/描述你的需求/);
    await textarea.fill('E2E test message from chat');
    await textarea.press('Enter');

    await expect(page.locator('.agentstudio-messages-inner')).toContainText('E2E test message from chat');
  });

  test('should render user button with guest label', async ({ page }) => {
    await expect(page.getByText('游客')).toBeVisible();
  });
});
