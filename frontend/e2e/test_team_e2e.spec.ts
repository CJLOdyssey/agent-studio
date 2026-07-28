import { test, expect, Page } from '@playwright/test';

const EMAIL = 'e2e2@playwright.dev';
const PASSWORD = 'test123';
const TEAM_NAME = 'E2E-自动化测试团队';

class TeamManagementPage {
  constructor(private page: Page) {}

  async navigate() {
    await this.page.getByRole('button', { name: /在线状态/ }).click();
    await this.page.getByText('管理工作台').click({ force: true });
    await this.page.getByRole('button', { name: '团队管理' }).click();
  }

  async createTeam(name: string, desc?: string) {
    await this.page.getByRole('button', { name: '新建团队' }).click();
    await this.page.getByPlaceholder('输入团队名称').fill(name);
    if (desc) await this.page.getByPlaceholder('输入团队描述').fill(desc);
    await this.page.locator('form').getByRole('button', { name: '创建团队' }).click();
  }

  get table() { return this.page.getByRole('grid'); }
  get searchInput() { return this.page.getByPlaceholder('搜索团队名称、描述...'); }

  async teamRow(name: string) {
    return this.page.getByRole('row').filter({ hasText: name });
  }
}

test.describe('Team Management E2E', () => {
  test.describe.configure({ mode: 'serial' });

  let mgmt: TeamManagementPage;

  test.beforeEach(async ({ page }) => {
    mgmt = new TeamManagementPage(page);
    if (await page.getByRole('button', { name: /游客/ }).isVisible().catch(() => false)) {
      await page.getByRole('button', { name: /游客/ }).click();
      await page.getByText('登录 / 注册').click();
      await page.getByPlaceholder(/邮箱/).fill(EMAIL);
      await page.getByPlaceholder(/密码/).fill(PASSWORD);
      await page.locator('form').getByRole('button', { name: '登录' }).click();
      await page.waitForURL('http://localhost:5174/**');
    }
  });

  test('E1-01: create team, verify persistence after refresh', async ({ page }) => {
    await mgmt.navigate();
    await mgmt.createTeam(TEAM_NAME, 'Playwright E2E test');
    await expect(mgmt.table.getByText(TEAM_NAME)).toBeVisible();
    await page.reload();
    await page.waitForLoadState('networkidle');
    await mgmt.navigate();
    await expect(mgmt.table.getByText(TEAM_NAME)).toBeVisible();
  });

  test('E1-02: edit team name', async ({ page }) => {
    await mgmt.navigate();
    await mgmt.createTeam(TEAM_NAME);
    await expect(mgmt.table.getByText(TEAM_NAME)).toBeVisible();
    const row = await mgmt.teamRow(TEAM_NAME);
    await row.getByRole('button').first().dispatchEvent('click');
    await page.getByRole('menuitem', { name: '编辑团队' }).click();
    await page.getByPlaceholder('输入团队名称').fill('E2E-已重命名');
    await page.getByRole('button', { name: '保存修改' }).click();
    await expect(mgmt.table.getByText('E2E-已重命名')).toBeVisible();
  });

  test('E1-03: delete team', async ({ page }) => {
    await mgmt.navigate();
    await mgmt.createTeam(TEAM_NAME);
    await expect(mgmt.table.getByText(TEAM_NAME)).toBeVisible();
    const row = await mgmt.teamRow(TEAM_NAME);
    await row.getByRole('button').first().dispatchEvent('click');
    await page.getByRole('menuitem', { name: '删除' }).click();
    await page.getByRole('button', { name: /确认/ }).click();
    await expect(mgmt.table.getByText(TEAM_NAME)).not.toBeVisible();
  });

  test('E1-04: search filters teams', async ({ page }) => {
    await mgmt.navigate();
    await mgmt.createTeam('E2E-搜索-UNIQUE');
    await expect(mgmt.table.getByText('E2E-搜索-UNIQUE')).toBeVisible();
    await mgmt.searchInput.fill('UNIQUE');
    await expect(mgmt.table.getByText('E2E-搜索-UNIQUE')).toBeVisible();
    await mgmt.searchInput.fill('__NONEXISTENT__');
    await expect(page.getByText('暂无团队')).toBeVisible();
  });

  test('E1-05: empty state after deleting all teams', async ({ page }) => {
    await mgmt.navigate();
    for (let i = 0; i < 20; i++) {
      const rows = page.getByRole('rowgroup').last().getByRole('row');
      if (await rows.count() === 0) break;
      await rows.first().getByRole('button').first().dispatchEvent('click');
      await page.getByRole('menuitem', { name: '删除' }).click();
      await page.getByRole('button', { name: /确认/ }).click();
    }
    await expect(page.getByText('暂无团队')).toBeVisible();
  });
});
