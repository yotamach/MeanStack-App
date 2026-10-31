import { defineConfig, devices } from '@playwright/test';
import { tmpdir } from 'os';
import { join } from 'path';

const CI = !!process.env.CI;
export const E2E_MONGODB_URI =
  process.env.E2E_MONGODB_URI ?? 'mongodb://localhost:27017/meanstack_e2e';

export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',
  // Tests share one database and the API's per-IP auth rate limit, so they run one at a time.
  fullyParallel: false,
  workers: 1,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
    // Lets a machine with a preinstalled Chromium skip `playwright install`.
    launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH || undefined },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm start:server',
      cwd: '..',
      url: 'http://localhost:3000/api/health',
      reuseExistingServer: !CI,
      timeout: 120_000,
      env: {
        MONGODB_URI: E2E_MONGODB_URI,
        JWT_SECRET: 'e2e-secret',
        CLIENT_ORIGIN: 'http://localhost:4200',
        UPLOAD_DIR: join(tmpdir(), 'meanstack-e2e-uploads'),
        LOG_LEVEL: 'warn',
      },
    },
    {
      command: 'pnpm start',
      cwd: '..',
      url: 'http://localhost:4200',
      reuseExistingServer: !CI,
      timeout: 180_000,
    },
  ],
});
