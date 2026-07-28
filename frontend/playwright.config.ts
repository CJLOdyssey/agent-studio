import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 120000,
  expect: { timeout: 8000 },
  retries: 0,
  maxFailures: 1,
  use: {
    baseURL: 'http://localhost:5174',
    actionTimeout: 10000,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    headless: true,
    launchOptions: {
      args: ['--no-sandbox'],
    },
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
});
