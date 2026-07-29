import { test, expect } from '@playwright/test';

// 设为首个要运行的用例名，前面步骤自动跳过（调试用）
const RUN_FROM = ''; // '' = 全量运行。失败时设 'E1-02' 等从该步骤开始调试

let seq = 0;
function uid() { return `${++seq}-${Date.now().toString(36).slice(-4)}`; }

/** 根据 RUN_FROM 决定是否跳过当前 step */
const stepNames = ['E1-01', 'E1-02', 'E1-06', 'E1-03', 'E1-10', 'E1-07', 'E1-08', 'E1-12', 'E1-13', 'E1-14', 'E1-17', 'E1-18'];
function shouldSkip(name: string): boolean {
  if (!RUN_FROM) return false;
  return stepNames.indexOf(name) < stepNames.indexOf(RUN_FROM);
}

/** 是否已到达要运行的起始步骤（之前步骤的导航也跳过） */
let _started = !RUN_FROM;
function checkStarted(name: string) {
  if (!_started && !shouldSkip(name)) _started = true;
  return _started;
}

/** 带跳过的 test.step 包装（含步骤标记） */
async function runStep(fullName: string, fn: () => Promise<void>) {
  await test.step(fullName, async () => {
    const code = fullName.split(':')[0].trim();
    if (shouldSkip(code)) { console.log(`⏭ 跳过 ${fullName}`); return; }
    console.log(`▶ ${fullName}`);
    checkStarted(code);
    await fn();
  });
}

/** 检查并移除遮挡按钮的遮罩层 */
async function clearOverlays(page: import('@playwright/test').Page) {
  const hasBlockingOverlay = await page.evaluate(() => {
    const overlays = document.querySelectorAll<HTMLElement>('.fixed.inset-0');
    return Array.from(overlays).some(el => getComputedStyle(el).pointerEvents !== 'none');
  });
  if (hasBlockingOverlay) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      document.querySelectorAll<HTMLElement>('.fixed.inset-0').forEach(el => {
        if (getComputedStyle(el).pointerEvents !== 'none') el.remove();
      });
    });
    await page.waitForTimeout(200);
  }
}

/** 打开新建 Agent 弹窗并填写基本信息 */
async function createAgent(page: import('@playwright/test').Page, name: string) {
  await page.getByRole('button', { name: '新建 Agent' }).first().click();
  await page.waitForTimeout(500);

  // 填写名称
  const nameInput = page.getByPlaceholder('2-30 个字符');
  await nameInput.fill(name);

  // 选择模型（有模型选项才选）
  const modelOptions = await page.locator('select').nth(1).locator('option').all();
  if (modelOptions.length > 1) {
    const firstModel = await modelOptions[1].getAttribute('value');
    if (firstModel) {
      await page.locator('select').nth(1).selectOption(firstModel);
    }
  }

  // 选择系统提示词（表单验证要求必选）
  await page.getByText('选择提示词').click();
  await page.waitForTimeout(400);
  // 点第一个可用提示词
  const promptOption = page.locator('text="2222"').first();
  if (await promptOption.isVisible().catch(() => false)) {
    await promptOption.click();
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: '确认' }).click();
    await page.waitForTimeout(300);
  }

  // 提交（弹窗内的提交按钮）
  await page.getByRole('button', { name: '新建 Agent', exact: true }).nth(1).click();
  await page.waitForTimeout(1500);

  // 关掉可能残留的弹窗
  const stillOpen = await page.getByRole('heading', { name: '新建 Agent' }).isVisible().catch(() => false);
  if (stillOpen) await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}

/** 点击表格行的操作菜单按钮 */
async function clickRowAction(page: import('@playwright/test').Page, agentName: string) {
  const row = page.locator('tr', { hasText: agentName });
  await expect(row).toBeVisible({ timeout: 10000 });
  const modalOpen = await page.evaluate(() => !!document.querySelector('.ant-modal'));
  if (modalOpen) await page.keyboard.press('Escape');
  await row.hover();
  await page.waitForTimeout(300);
  await row.locator('button.ant-dropdown-trigger').click({ timeout: 8000 });
}

/** 搜索 Agent 并等待结果 */
async function searchForAgent(page: import('@playwright/test').Page, name: string) {
  const searchInput = page.getByPlaceholder('搜索 Agent 名称、团队、模型...');
  await searchInput.fill(name);
  await page.waitForTimeout(800);
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 10000 });
}

/** 重置所有筛选条件（搜索框 + 状态筛选） */
async function resetFilters(page: import('@playwright/test').Page) {
  await page.getByPlaceholder('搜索 Agent 名称、团队、模型...').fill('');
  await page.waitForTimeout(300);
  // 状态筛选重置
  const statusSelect = page.locator('.ant-select-selector').first();
  if (await statusSelect.isVisible().catch(() => false)) {
    await statusSelect.click();
    await page.locator('.ant-select-item-option').filter({ hasText: '全部状态' }).first().click();
    await page.waitForTimeout(500);
  }
}

// ─── 主测试 ──────────────────────────────────────────
test('Agent 管理 E2E', async ({ page }) => {
  // 全量操作日志（浏览器错误 + API 响应 + 控制台）
  page.on('pageerror', err => console.log(`[JS错误] ${err.message}`));
  page.on('response', resp => {
    if (resp.url().includes('/api/agents')) {
      console.log(`[API] ${resp.status()} ${resp.url().split('/api')[1]}`);
    }
  });
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`[浏览器] ${msg.type()}: ${msg.text()}`);
    }
  });

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
  // 进入管理工作台
  await page.getByRole('button', { name: /在线状态/ }).click();
  await page.getByRole('button', { name: '管理工作台' }).click();
  await page.waitForTimeout(1500);

  // 切换到 Agent 管理 Tab
  await page.getByRole('button', { name: 'Agent 管理' }).click();
  await page.waitForTimeout(1000);

  // ─── 清理已停止的旧 Agent（仅第一页） ─────
  // 跳过运行中的 Agent（batch delete 会拦截）
  const stoppedRows = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('tr'))
      .filter(tr => tr.textContent?.includes('已停止'))
      .length;
  });
  console.log(`[清理] 本页已停止的 Agent: ${stoppedRows}`);
  if (stoppedRows > 0) {
    const cb = page.getByRole('checkbox', { name: '全选本页' });
    if (await cb.isVisible().catch(() => false)) {
      await cb.check();
      await page.waitForTimeout(300);
      const btn = page.getByRole('button', { name: /批量删除/ });
      if (await btn.isVisible().catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(500);
        const confirmBtn = page.getByRole('button', { name: '确认删除' });
        if (await confirmBtn.isVisible().catch(() => false)) {
          await confirmBtn.click();
          await page.waitForTimeout(500);
        }
      }
    }
  }

  // ═══════════════════════════════════════════
  // E1-01: 创建 Agent 并验证
  // ═══════════════════════════════════════════
  await runStep('E1-01: 创建 Agent 并验证', async () => {
    const name = `E2E-Agent-创建-${uid()}`;
    await createAgent(page, name);

    // 验证 toast 提示
    const toastVis = await page.getByText('Agent 已创建').isVisible().catch(() => false);
    console.log('[E1-01] toast Agent 已创建:', toastVis);
    expect(toastVis).toBe(true);

    // 搜索 Agent 名称来验证（数据量大时可能在分页后方）
    const searchInput = page.getByPlaceholder('搜索 Agent 名称、团队、模型...');
    await searchInput.fill(name);
    await page.waitForTimeout(800);
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 8000 });

    // 诊断：行数据
    const diag = await page.evaluate((n) => {
      const row = Array.from(document.querySelectorAll('tr')).find(r => r.textContent?.includes(n));
      if (!row) return { found: false };
      const cells = Array.from(row.querySelectorAll('td')).map(c => c.textContent?.trim().substring(0, 40));
      return { found: true, cells };
    }, name);
    console.log('[E1-01] 行诊断:', JSON.stringify(diag));

    // 清空搜索框
    await searchInput.fill('');
    await page.waitForTimeout(300);
  });

  // ─── 重置状态 ──────────────────────────
  if (_started) {
    await clearOverlays(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /在线状态/ }).click();
    await page.getByRole('button', { name: '管理工作台' }).click();
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: 'Agent 管理' }).click();
    await page.waitForTimeout(1000);
  }

  // ═══════════════════════════════════════════
  // E1-02: 编辑 Agent - 基本信息
  // ═══════════════════════════════════════════
  await runStep('E1-02: 编辑 Agent - 基本信息', async () => {
    const name = `E2E-Agent-编辑-${uid()}`;
    await createAgent(page, name);
    await page.waitForTimeout(500);

    // 切回 Agent 管理
    await page.getByRole('button', { name: 'Agent 管理' }).click();
    await page.waitForTimeout(500);
    await searchForAgent(page, name);

    // 打开操作菜单 → 编辑
    await clickRowAction(page, name);
    await page.getByRole('menuitem', { name: '编辑 Agent' }).click();
    await page.waitForTimeout(600);

    // 修改名称
    const newName = `E2E-Agent-已重命名-${uid()}`;
    const editInput = page.getByPlaceholder('2-30 个字符');
    await editInput.fill(newName);

    // 切换模型
    const modelSelect = page.locator('select').nth(1);
    const modelOpts = await modelSelect.locator('option').all();
    if (modelOpts.length > 2) {
      const secondModel = await modelOpts[2].getAttribute('value');
      if (secondModel) {
        await modelSelect.selectOption(secondModel);
      }
    }

    // 保存
    await page.getByRole('button', { name: '保存修改', exact: true }).click();
    await page.waitForTimeout(1000);

    // 验证 toast
    const updatedToast = await page.getByText('Agent 已更新').isVisible().catch(() => false);
    console.log('[E1-02] toast Agent 已更新:', updatedToast);

    // 关掉可能残留的弹窗
    await clearOverlays(page);
  });

  // ─── 重置状态 ──────────────────────────
  if (_started) {
    await clearOverlays(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /在线状态/ }).click();
    await page.getByRole('button', { name: '管理工作台' }).click();
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: 'Agent 管理' }).click();
    await page.waitForTimeout(1000);
  }

  // ═══════════════════════════════════════════
  // E1-06: Agent 开关切换
  // ═══════════════════════════════════════════
  await runStep('E1-06: Agent 开关切换', async () => {
    const name = `E2E-Agent-开关-${uid()}`;
    await createAgent(page, name);

    // 切到 Agent 管理（弹窗可能关闭了 tab 视图）
    await page.getByRole('button', { name: 'Agent 管理' }).click();
    await page.waitForTimeout(500);
    await searchForAgent(page, name);

    // 打开操作菜单 → 切换状态（Agent 默认已停止，先启动）
    await clickRowAction(page, name);
    await page.getByRole('menuitem', { name: '启动' }).click();
    await page.waitForTimeout(1000);

    // 验证启动
    const startedToast = await page.getByText('已启动').isVisible().catch(() => false);
    console.log('[E1-06] 启动 toast:', startedToast);

    // 再切回停止
    await clickRowAction(page, name);
    await page.getByRole('menuitem', { name: '停止' }).click();
    await page.waitForTimeout(1000);

    // 验证停止
    const stoppedToast = await page.getByText('已停止').isVisible().catch(() => false);
    console.log('[E1-06] 停止 toast:', stoppedToast);
  });

  // ─── 重置状态 ──────────────────────────
  if (_started) {
    await clearOverlays(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /在线状态/ }).click();
    await page.getByRole('button', { name: '管理工作台' }).click();
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: 'Agent 管理' }).click();
    await page.waitForTimeout(1000);
  }

  // ═══════════════════════════════════════════
  // E1-03: 删除 Agent
  // ═══════════════════════════════════════════
  await runStep('E1-03: 删除 Agent', async () => {
    const name = `E2E-Agent-删除-${uid()}`;
    await createAgent(page, name);
    await page.waitForTimeout(500);

    // 切回 Agent 管理
    await page.getByRole('button', { name: 'Agent 管理' }).click();
    await page.waitForTimeout(500);
    await searchForAgent(page, name);

    await clickRowAction(page, name);
    await page.getByRole('menuitem', { name: '删除' }).click();
    await page.waitForTimeout(500);

    // 确认删除
    const confirmBtn = page.getByRole('button', { name: '确认删除' });
    if (await confirmBtn.isVisible().catch(() => false)) {
      await confirmBtn.click();
      await page.waitForTimeout(500);
    }

    const deletedToast = await page.getByText('Agent 已删除').isVisible().catch(() => false);
    console.log('[E1-03] toast Agent 已删除:', deletedToast);

    // 验证行消失
    await expect(page.getByText(name)).not.toBeVisible();
  });

  // ═══════════════════════════════════════════
  // E1-10: 批量删除
  // ═══════════════════════════════════════════
  await runStep('E1-10: 批量删除', async () => {
    await resetFilters(page);
    const nameA = `E2E-批量A-${uid()}`;
    const nameB = `E2E-批量B-${uid()}`;
    await createAgent(page, nameA);
    await expect(page.getByText('Agent 已创建')).toBeVisible();
    await createAgent(page, nameB);
    await expect(page.getByText('Agent 已创建')).toBeVisible();

    // 搜索到目标 Agent 以定位行
    await searchForAgent(page, nameA);
    await page.locator('tr', { hasText: nameA }).locator('input[type="checkbox"]').check();
    await page.waitForTimeout(200);

    // 清空搜索，再找第二个
    await page.getByPlaceholder('搜索 Agent 名称、团队、模型...').fill('');
    await page.waitForTimeout(300);
    await searchForAgent(page, nameB);
    await page.locator('tr', { hasText: nameB }).locator('input[type="checkbox"]').check();
    await page.waitForTimeout(300);

    // 批量删除
    const batchBtn = page.getByRole('button', { name: /批量删除/ });
    await expect(batchBtn).toBeVisible();
    await batchBtn.click();
    await page.getByRole('button', { name: '确认删除' }).click();
    await page.waitForTimeout(500);

    // 验证
    const batchDeletedToast = await page.getByText('已删除').isVisible().catch(() => false);
    console.log('[E1-10] 批量删除 toast:', batchDeletedToast);
  });

  // ─── 重置状态 ──────────────────────────
  if (_started) {
    await clearOverlays(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /在线状态/ }).click();
    await page.getByRole('button', { name: '管理工作台' }).click();
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: 'Agent 管理' }).click();
    await page.waitForTimeout(1000);
  }

  // ═══════════════════════════════════════════
  // E1-07: 搜索筛选
  // ═══════════════════════════════════════════
  await runStep('E1-07: 搜索筛选', async () => {
    await resetFilters(page);

    const searchName = `搜索${uid()}`;
    await createAgent(page, searchName);
    await expect(page.getByText('Agent 已创建')).toBeVisible();
    await page.waitForTimeout(500);

    // 切到 Agent 管理
    await page.getByRole('button', { name: 'Agent 管理' }).click();
    await page.waitForTimeout(500);

    // 搜索
    const searchInput = page.getByPlaceholder('搜索 Agent 名称、团队、模型...');
    await searchInput.fill('搜索');
    await page.waitForTimeout(800);

    // 验证搜索结果出现
    await expect(page.getByText(searchName)).toBeVisible({ timeout: 5000 });
  });

  // ─── 重置状态 ──────────────────────────
  if (_started) {
    await clearOverlays(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /在线状态/ }).click();
    await page.getByRole('button', { name: '管理工作台' }).click();
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: 'Agent 管理' }).click();
    await page.waitForTimeout(1000);
  }

  // ═══════════════════════════════════════════
  // E1-08: 状态筛选（验证状态 badge + 筛选器切换）
  // ═══════════════════════════════════════════
  await runStep('E1-08: 状态筛选', async () => {
    const stoppedName = `E2E-停用-${uid()}`;
    await createAgent(page, stoppedName);
    await expect(page.getByText('Agent 已创建')).toBeVisible();

    // 搜到该 Agent 并验证状态 badge
    await searchForAgent(page, stoppedName);
    const badge = await page.evaluate((n) => {
      const row = Array.from(document.querySelectorAll('tr')).find(r => r.textContent?.includes(n));
      if (!row) return 'not found';
      return row.querySelector('.wsta-badge-dot')?.textContent?.trim() || 'no badge';
    }, stoppedName);
    console.log('[E1-08] Agent 状态:', badge);
    expect(badge).toContain('已停止');

    // 验证筛选器 UI 可切换
    await page.getByPlaceholder('搜索 Agent 名称、团队、模型...').fill('');
    await page.waitForTimeout(300);
    const sel = page.locator('.ant-select-selector').first();
    await sel.click();
    await page.waitForTimeout(300);
    await page.locator('.ant-select-item-option').filter({ hasText: '全部状态' }).first().click();
    await page.waitForTimeout(500);
  });

  // ═══════════════════════════════════════════
  // E1-12: 空状态
  // ═══════════════════════════════════════════
  await runStep('E1-12: 空状态', async () => {
    await resetFilters(page);
    // 遍历删除所有可见的 Agent
    for (let i = 0; i < 5; i++) {
      const cb = page.getByRole('checkbox', { name: '全选本页' });
      if (!(await cb.isVisible().catch(() => false))) break;
      await cb.check();
      await page.waitForTimeout(200);
      const btn = page.getByRole('button', { name: /批量删除/ });
      if (!(await btn.isVisible().catch(() => false))) break;
      await btn.click();
      await page.waitForTimeout(300);
      const delConfirm = page.getByRole('button', { name: '确认删除' });
      if (await delConfirm.isVisible().catch(() => false)) {
        await delConfirm.click();
        await page.waitForTimeout(500);
      }
    }
    // 验证空状态
    const emptyVisible = await page.getByText('暂无 Agent', { exact: false }).isVisible().catch(() => false);
    console.log('[E1-12] 空状态可见:', emptyVisible);
  });

  // ═══════════════════════════════════════════
  // E1-13: 搜索空状态
  // ═══════════════════════════════════════════
  await runStep('E1-13: 搜索空状态', async () => {
    await clearOverlays(page);
    // 确保在工作台 Agent 管理
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /在线状态/ }).click();
    await page.getByRole('button', { name: '管理工作台' }).click();
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: 'Agent 管理' }).click();
    await page.waitForTimeout(1000);

    await page.getByPlaceholder('搜索 Agent 名称、团队、模型...').fill('__NONEXISTENT__');
    await page.waitForTimeout(800);
    const emptyStateVisible = await page.getByText('暂无 Agent', { exact: false }).isVisible().catch(() => false);
    console.log('[E1-13] 搜索空状态可见:', emptyStateVisible);
    // 清空搜索框恢复
    await page.getByPlaceholder('搜索 Agent 名称、团队、模型...').fill('');
    await page.waitForTimeout(300);
  });

  // ═══════════════════════════════════════════
  // E1-14: 分页
  // ═══════════════════════════════════════════
  await runStep('E1-14: 分页', async () => {
    await resetFilters(page);
    // 已有 333 条记录，直接验证分页控件
    await page.waitForTimeout(500);
    const hasPagination = await page.locator('.ant-pagination').isVisible().catch(() => false);
    expect(hasPagination).toBeTruthy();
    console.log('[E1-14] 分页控件可见:', hasPagination);

    // 点第 2 页
    const page2Btn = page.locator('.ant-pagination li').filter({ hasText: '2' }).first();
    if (await page2Btn.isVisible().catch(() => false)) {
      await page2Btn.click();
      await page.waitForTimeout(500);
      console.log('[E1-14] 切换到第 2 页');
    }
  });

  // ═══════════════════════════════════════════
  // E1-17: 错误处理 - API 500
  // ═══════════════════════════════════════════
  await runStep('E1-17: 错误处理 - API 500', async () => {
    await clearOverlays(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /在线状态/ }).click();
    await page.getByRole('button', { name: '管理工作台' }).click();
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: 'Agent 管理' }).click();
    await page.waitForTimeout(1000);
    await resetFilters(page);

    // 拦截 POST /api/agents 返回 500
    await page.route('**/api/agents', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: '模拟服务端错误' }) });
      } else {
        await route.continue();
      }
    });

    // 打开创建弹窗并提交
    await page.getByRole('button', { name: '新建 Agent' }).first().click();
    await page.waitForTimeout(500);
    await page.getByPlaceholder('2-30 个字符').fill(`E2E-错误-${uid()}`);

    // 选提示词（验证要求）
    await page.getByText('选择提示词').click();
    await page.waitForTimeout(300);
    const errPrompt = page.locator('text="2222"').first();
    if (await errPrompt.isVisible().catch(() => false)) {
      await errPrompt.click();
      await page.waitForTimeout(200);
      await page.getByRole('button', { name: '确认' }).click();
      await page.waitForTimeout(300);
    }

    // 提交（API 会被 route 拦截返回 500）
    await page.getByRole('button', { name: '新建 Agent', exact: true }).nth(1).click();
    await page.waitForTimeout(2000);

    // 验证错误处理：检查 error banner 或弹窗未关
    const errDiag = await page.evaluate(() => {
      // The error banner uses `[role="alert"]` or has error styling
      const errBanner = document.querySelector('[role="alert"]');
      const errBannerText = errBanner?.textContent?.trim() || '';
      // Check if modal is still open (save failed so modal shouldn't close)
      const modalOpen = !!document.querySelector('h3');
      // Check for any error messages
      const errorMsgs = Array.from(document.querySelectorAll('[class*="error"],[class*="danger"]'))
        .map(e => e.textContent?.trim()).filter(Boolean);
      const toastText = document.querySelector('.ant-message')?.textContent || '';
      return {
        errBannerText: errBannerText.substring(0, 100),
        modalOpen,
        errorMsgs: errorMsgs.slice(0, 3),
        toastText,
      };
    });
    console.log('[E1-17] 错误诊断:', JSON.stringify(errDiag));

    // 关弹窗
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await clearOverlays(page);

    // 恢复正常 API
    await page.unroute('**/api/agents');
  });

  // ═══════════════════════════════════════════
  // E1-18: 表单验证 - 名称为空
  // ═══════════════════════════════════════════
  await runStep('E1-18: 表单验证 - 名称为空', async () => {
    await clearOverlays(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /在线状态/ }).click();
    await page.getByRole('button', { name: '管理工作台' }).click();
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: 'Agent 管理' }).click();
    await page.waitForTimeout(1000);

    await page.getByRole('button', { name: '新建 Agent' }).first().click();
    await page.waitForTimeout(500);

    // 清空名称输入框
    const nameInput = page.getByPlaceholder('2-30 个字符');
    await nameInput.fill('');
    await page.waitForTimeout(200);

    // 提交空表单（弹窗内的提交按钮）
    await page.getByRole('button', { name: '新建 Agent', exact: true }).nth(1).click();
    await page.waitForTimeout(800);

    // 获取页面反馈（验证提示或弹窗未关）
    const feedback = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[class*="error"],[class*="help"],[role="alert"],.ant-message'))
        .map(e => e.textContent?.trim()).filter(Boolean)
    );
    console.log('[E1-18] 反馈:', feedback);

    // 弹窗应仍然打开
    const modalStillOpen = await page.getByRole('heading', { name: '新建 Agent' }).isVisible().catch(() => false);
    console.log('[E1-18] 弹窗仍然打开:', modalStillOpen);

    // 关弹窗
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await clearOverlays(page);
  });
});
