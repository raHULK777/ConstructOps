import { defineConfig, devices } from '@playwright/test';

const processEnv = process.env as Record<string, string>;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run dev:memory',
      url: 'http://127.0.0.1:8080/healthz',
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      env: { ...processEnv, SEED_PASSWORD: 'ChangeMe!123' },
    },
    {
      command: 'npm run dev -w @constructops/portal',
      url: 'http://localhost:3000/login',
      timeout: 180_000,
      reuseExistingServer: !process.env.CI,
      env: {
        ...processEnv,
        API_BASE_URL: 'http://127.0.0.1:8080',
        TENANT_HOST_OVERRIDE: 'alpha-builders.constructops.test',
      },
    },
  ],
});
