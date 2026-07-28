import { test as setup } from '@playwright/test';

const authFile = '.auth/user.json';

setup('登录并保存认证状态', async ({ page, request }) => {
  // API 登录（学习18推荐：比 UI 更快更可靠）
  const res = await request.post('http://localhost:8081/api/auth/login', {
    data: { email: 'cjlodyssey@outlook.com', password: 'Test1234!' },
  });
  const { access_token, refresh_token } = await res.json();

  // 注入 token → 刷新 → 完成登录
  await page.goto('http://localhost:5174/');
  await page.evaluate(({ at, rt }) => {
    localStorage.setItem('agentstudio_access_token', at);
    localStorage.setItem('agentstudio_refresh_token', rt);
  }, { at: access_token, rt: refresh_token });
  await page.reload();
  await page.getByRole('button', { name: /在线状态/ }).waitFor({ timeout: 10000 });

  await page.context().storageState({ path: authFile });
});
