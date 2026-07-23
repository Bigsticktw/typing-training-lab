import { defineConfig, devices } from '@playwright/test';

const frontendUrl = 'http://127.0.0.1:4173';
const serverUrl = 'http://127.0.0.1:3100';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: frontendUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npm --prefix server run start',
      url: `${serverUrl}/health`,
      env: {
        PORT: '3100',
        ALLOWED_ORIGINS: frontendUrl,
      },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 4173',
      url: frontendUrl,
      env: {
        VITE_WEBSOCKET_URL: serverUrl,
      },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
