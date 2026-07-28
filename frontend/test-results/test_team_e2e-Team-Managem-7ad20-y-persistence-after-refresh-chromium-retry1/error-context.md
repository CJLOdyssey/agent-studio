# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: test_team_e2e.spec.ts >> Team Management E2E >> E1-01: create team, verify persistence after refresh
- Location: e2e/test_team_e2e.spec.ts:45:3

# Error details

```
Test timeout of 30000ms exceeded while running "beforeEach" hook.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /在线状态/ })

```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | const EMAIL = 'e2e2@playwright.dev';
  4   | const PASSWORD = 'test123';
  5   | const TEAM_NAME = 'E2E-自动化测试团队';
  6   | 
  7   | test.describe('Team Management E2E', () => {
  8   |   test.describe.configure({ mode: 'serial' });
  9   | 
  10  |   async function login(page: any) {
  11  |     await page.goto('http://localhost:5174');
  12  |     await page.waitForLoadState('networkidle');
  13  | 
  14  |     const guestBtn = page.getByRole('button', { name: /游客/ });
  15  |     if (await guestBtn.isVisible().catch(() => false)) {
  16  |       await guestBtn.click();
  17  |       const loginOpt = page.getByText('登录 / 注册');
  18  |       if (await loginOpt.isVisible().catch(() => false)) {
  19  |         await loginOpt.click();
  20  |         await page.getByPlaceholder(/邮箱/).fill(EMAIL);
  21  |         await page.getByPlaceholder(/密码/).fill(PASSWORD);
  22  |         await page.locator('form').getByRole('button', { name: '登录' }).click();
  23  |         await page.waitForURL('http://localhost:5174/**');
  24  |       }
  25  |     }
  26  |   }
  27  | 
  28  |   async function navigateToTeamManagement(page: any) {
> 29  |     await page.getByRole('button', { name: /在线状态/ }).click();
      |                                                      ^ Error: locator.click: Test timeout of 30000ms exceeded.
  30  |     await page.getByText('管理工作台').click({ force: true });
  31  |     await page.getByRole('button', { name: '团队管理' }).click();
  32  |     await page.waitForTimeout(500);
  33  |   }
  34  | 
  35  |   test.beforeAll(async ({ browser }) => {
  36  |     const page = await browser.newPage();
  37  |     await login(page);
  38  |     await page.close();
  39  |   });
  40  | 
  41  |   test.beforeEach(async ({ page }) => {
  42  |     await navigateToTeamManagement(page);
  43  |   });
  44  | 
  45  |   test('E1-01: create team, verify persistence after refresh', async ({ page }) => {
  46  |     await page.getByRole('button', { name: '新建团队' }).click();
  47  |     await page.getByPlaceholder('输入团队名称').fill(TEAM_NAME);
  48  |     await page.getByPlaceholder('输入团队描述').fill('Playwright E2E test');
  49  |     await page.locator('form').getByRole('button', { name: '创建团队' }).click();
  50  |     await expect(page.getByRole('grid').getByText(TEAM_NAME)).toBeVisible();
  51  | 
  52  |     await page.reload();
  53  |     await page.waitForLoadState('networkidle');
  54  |     await navigateToTeamManagement(page);
  55  |     await expect(page.getByRole('grid').getByText(TEAM_NAME)).toBeVisible();
  56  |   });
  57  | 
  58  |   test('E1-02: edit team name', async ({ page }) => {
  59  |     await page.getByRole('button', { name: '新建团队' }).click();
  60  |     await page.getByPlaceholder('输入团队名称').fill(TEAM_NAME);
  61  |     await page.locator('form').getByRole('button', { name: '创建团队' }).click();
  62  |     await expect(page.getByRole('grid').getByText(TEAM_NAME)).toBeVisible();
  63  | 
  64  |     const row = page.getByRole('row').filter({ hasText: TEAM_NAME });
  65  |     await row.getByRole('button').first().dispatchEvent('click');
  66  |     await page.getByRole('menuitem', { name: '编辑团队' }).click();
  67  |     await page.getByPlaceholder('输入团队名称').fill('E2E-已重命名');
  68  |     await page.getByRole('button', { name: '保存修改' }).click();
  69  |     await expect(page.getByRole('grid').getByText('E2E-已重命名')).toBeVisible();
  70  |   });
  71  | 
  72  |   test('E1-03: delete team', async ({ page }) => {
  73  |     await page.getByRole('button', { name: '新建团队' }).click();
  74  |     await page.getByPlaceholder('输入团队名称').fill(TEAM_NAME);
  75  |     await page.locator('form').getByRole('button', { name: '创建团队' }).click();
  76  |     await expect(page.getByRole('grid').getByText(TEAM_NAME)).toBeVisible();
  77  | 
  78  |     const row = page.getByRole('row').filter({ hasText: TEAM_NAME });
  79  |     await row.getByRole('button').first().dispatchEvent('click');
  80  |     await page.getByRole('menuitem', { name: '删除' }).click();
  81  |     await page.getByRole('button', { name: /确认/ }).click();
  82  |     await expect(page.getByRole('grid').getByText(TEAM_NAME)).not.toBeVisible();
  83  |   });
  84  | 
  85  |   test('E1-04: search filters teams', async ({ page }) => {
  86  |     await page.getByRole('button', { name: '新建团队' }).click();
  87  |     await page.getByPlaceholder('输入团队名称').fill('E2E-搜索-UNIQUE');
  88  |     await page.locator('form').getByRole('button', { name: '创建团队' }).click();
  89  |     await expect(page.getByRole('grid').getByText('E2E-搜索-UNIQUE')).toBeVisible();
  90  | 
  91  |     await page.getByPlaceholder('搜索团队名称、描述...').fill('UNIQUE');
  92  |     await expect(page.getByRole('grid').getByText('E2E-搜索-UNIQUE')).toBeVisible();
  93  | 
  94  |     await page.getByPlaceholder('搜索团队名称、描述...').fill('__NONEXISTENT__');
  95  |     await expect(page.getByText('暂无团队')).toBeVisible();
  96  |   });
  97  | 
  98  |   test('E1-05: empty state after deleting all teams', async ({ page }) => {
  99  |     for (let i = 0; i < 20; i++) {
  100 |       const rows = page.getByRole('rowgroup').last().getByRole('row');
  101 |       if (await rows.count() === 0) break;
  102 |       await rows.first().getByRole('button').first().dispatchEvent('click');
  103 |       await page.getByRole('menuitem', { name: '删除' }).click();
  104 |       await page.getByRole('button', { name: /确认/ }).click();
  105 |     }
  106 |     await expect(page.getByText('暂无团队')).toBeVisible();
  107 |   });
  108 | });
  109 | 
```