import { test, expect } from '@playwright/test';

let seq = 0;
function uid() { return `${++seq}-${Date.now().toString(36).slice(-4)}`; }

async function createTeam(page: import('@playwright/test').Page, name: string, category?: string, status?: string) {
  await page.getByRole('button', { name: '新建团队' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('textbox', { name: '输入团队名称' }).fill(name);
  if (category) await page.getByRole('combobox').nth(2).selectOption(category);
  if (status) await page.getByRole('combobox').nth(3).selectOption(status);
  await page.getByText('创建团队').click();
  await page.waitForTimeout(1500);
  const stillOpen = await page.getByRole('heading', { name: '新建团队' }).isVisible().catch(() => false);
  if (stillOpen) await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}

async function clickRowAction(page: import('@playwright/test').Page, teamName: string) {
  const row = page.locator('tr', { hasText: teamName });
  await expect(row).toBeVisible({ timeout: 10000 });
  const modalOpen = await page.evaluate(() => !!document.querySelector('.ant-modal'));
  if (modalOpen) await page.keyboard.press('Escape');
  await row.hover();
  await page.waitForTimeout(300);
  await row.locator('button.ant-dropdown-trigger').click({ timeout: 8000 });
}

test('团队管理 E2E', async ({ page }) => {
  // ─── 一次性登录 ──────────────────────────────
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const loggedIn = await page.getByRole('button', { name: /在线状态/ }).isVisible().catch(() => false);
  if (!loggedIn) {
    await page.getByRole('button', { name: /游客|登录/ }).first().click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: '登录', exact: true }).first().click();
    await page.getByRole('textbox', { name: '邮箱地址' }).fill('cjlodyssey@outlook.com');
    await page.getByRole('textbox', { name: '密码' }).fill('Test1234!');
    await page.locator('form').getByRole('button', { name: '登录' }).click();
    await page.getByRole('button', { name: /在线状态/ }).waitFor({ timeout: 15000 });
  }
  await page.getByRole('button', { name: /在线状态/ }).click();
  await page.getByRole('button', { name: '管理工作台' }).click();
  await page.waitForTimeout(1500);

  // ─── 清空旧数据 ────────────────────────────
  for (let i = 0; i < 3; i++) {
    const cb = page.getByRole('checkbox', { name: '全选本页' });
    if (!(await cb.isVisible().catch(() => false))) break;
    await cb.check();
    await page.waitForTimeout(300);
    const btn = page.getByRole('button', { name: /批量删除/ });
    if (!(await btn.isVisible().catch(() => false))) break;
    await btn.click();
    await page.getByRole('button', { name: '确认删除' }).click();
    await page.waitForTimeout(500);
  }

  // ─── E1-01 创建团队 ──────────────────────────
  await test.step('E1-01: 创建团队', async () => {
    const name = `E2E-创建-${uid()}`;
    await createTeam(page, name);
    await expect(page.getByText('团队已创建')).toBeVisible();
    await expect(page.getByText(name)).toBeVisible();
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /在线状态/ }).click();
    await page.getByRole('button', { name: '管理工作台' }).click();
    await page.waitForTimeout(1500);
  });

  // ─── E1-04 删除团队 ──────────────────────────
  await test.step('E1-04: 删除团队', async () => {
    const name = `E2E-删除-${uid()}`;
    await createTeam(page, name);
    await expect(page.getByText('团队已创建')).toBeVisible();

    await clickRowAction(page, name);
    await page.getByRole('menuitem', { name: '删除' }).click();
    await page.getByRole('button', { name: '确认删除' }).click();
    await expect(page.getByText('团队已删除')).toBeVisible();
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /在线状态/ }).click();
    await page.getByRole('button', { name: '管理工作台' }).click();
    await page.waitForTimeout(1500);
  });

  // ─── E1-06 分类筛选 ──────────────────────────
  await test.step('E1-06: 分类筛选', async () => {
    console.log('当前URL:', page.url());
    const devName = `E2E-开发-${uid()}`;
    await createTeam(page, devName);
    await expect(page.getByText('团队已创建')).toBeVisible();

    await createTeam(page, `E2E-运维-${uid()}`, 'ops');
    await expect(page.getByText('团队已创建')).toBeVisible();

    await page.locator('.ant-select-selector').first().click();
    await page.waitForTimeout(500);
    await page.locator('.ant-select-item-option').filter({ hasText: '开发' }).first().click();
    await page.waitForTimeout(800);
    await expect(page.getByText(devName)).toBeVisible();
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /在线状态/ }).click();
    await page.getByRole('button', { name: '管理工作台' }).click();
    await page.waitForTimeout(1500);
  });

  // ─── E1-07 状态筛选 ──────────────────────────
  await test.step('E1-07: 状态筛选', async () => {
    const inactiveName = `E2E-停用-${uid()}`;
    await createTeam(page, inactiveName, undefined, 'inactive');
    await expect(page.getByText('团队已创建')).toBeVisible();

    await page.locator('.ant-select-selector').nth(1).click();
    await page.waitForTimeout(500);
    await page.locator('.ant-select-item-option').filter({ hasText: '停用' }).first().click();
    await page.waitForTimeout(500);
    await expect(page.getByText(inactiveName)).toBeVisible();
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /在线状态/ }).click();
    await page.getByRole('button', { name: '管理工作台' }).click();
    await page.waitForTimeout(1500);
  });

  // ─── E1-05 搜索筛选 ──────────────────────────
  await test.step('E1-05: 搜索筛选', async () => {
    const searchName = `搜索${uid()}`;
    await createTeam(page, searchName);
    await expect(page.getByText('团队已创建')).toBeVisible();

    await page.getByRole('textbox', { name: '搜索团队名称、描述' }).fill('搜索');
    await expect(page.getByText(searchName)).toBeVisible();
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /在线状态/ }).click();
    await page.getByRole('button', { name: '管理工作台' }).click();
    await page.waitForTimeout(1500);
  });

  // ─── E1-14 成员管理弹窗 ──────────────────────
  await test.step('E1-14: 成员管理弹窗', async () => {
    const name = `E2E-成员-${uid()}`;
    await createTeam(page, name);
    await expect(page.getByText('团队已创建')).toBeVisible();
    await expect(page.getByText(name)).toBeVisible();

    await clickRowAction(page, name);
    await page.getByRole('menuitem', { name: '管理成员' }).click();
    await expect(page.getByRole('heading', { name: '管理成员' })).toBeVisible();
    // 关掉弹窗
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /在线状态/ }).click();
    await page.getByRole('button', { name: '管理工作台' }).click();
    await page.waitForTimeout(1500);
  });

  // ─── E1-15 表单验证 ──────────────────────────
  await test.step('E1-15: 表单验证 - 名称为空', async () => {
    await page.getByRole('button', { name: '新建团队' }).click();
    await page.getByText('创建团队').click();
    const error = await page.locator('text=不能为空').or(page.locator('text=错误')).isVisible();
    expect(error).toBeTruthy();
  });
});
