import { defineConfig } from "@playwright/test";

const browserProject =
  process.env.PLAYWRIGHT_CHANNEL === "chrome"
    ? { channel: "chrome" as const }
    : { browserName: "chromium" as const };

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: false,
    env: {
      NEXT_PUBLIC_HAVENERR_ADMIN_API_BASE_URL: "http://localhost:3000",
    },
  },
  projects: [
    { name: "chromium", use: { ...browserProject } },
    {
      name: "mobile",
      use: {
        ...browserProject,
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
