import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 2,
  timeout: 60000,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3100",
    timezoneId: "UTC",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --port 3100 --hostname 127.0.0.1",
    url: "http://localhost:3100",
    reuseExistingServer: true,
    timeout: 120000,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
