import { test, expect } from '@playwright/test';
import { loginAsDefaultUser } from './fixtures';

test.describe('Auth — login flow', () => {
  test('should render login modal when clicking login button', async ({ page }) => {
    await loginAsDefaultUser(page);

    const loginButton = page.getByText('登录 / 注册');
    await expect(loginButton).toBeVisible();
    await loginButton.click();

    const modal = page.locator('.modal-content');
    await expect(modal).toBeVisible();
    await expect(page.getByPlaceholder('邮箱地址')).toBeVisible();
    await expect(page.getByPlaceholder('密码')).toBeVisible();
  });

  test('should show validation error for empty email', async ({ page }) => {
    await loginAsDefaultUser(page);
    await page.getByText('登录 / 注册').click();

    const form = page.locator('.modal-content form');
    await form.locator('button[type="submit"]').click();

    await expect(page.getByText('请输入邮箱')).toBeVisible();
  });

  test('should show validation error for empty password', async ({ page }) => {
    await loginAsDefaultUser(page);
    await page.getByText('登录 / 注册').click();

    await page.getByPlaceholder('邮箱地址').fill('user@test.com');
    const form = page.locator('.modal-content form');
    await form.locator('button[type="submit"]').click();

    await expect(page.getByText('请输入密码')).toBeVisible();
  });

  test('should switch to register view', async ({ page }) => {
    await loginAsDefaultUser(page);
    await page.getByText('登录 / 注册').click();

    await page.getByText('注册').click();

    await expect(page.getByText('发送验证码')).toBeVisible();
  });

  test('should close modal on overlay click', async ({ page }) => {
    await loginAsDefaultUser(page);
    await page.getByText('登录 / 注册').click();

    await page.locator('.modal-overlay').click();

    await expect(page.locator('.modal-content')).not.toBeVisible();
  });
});
