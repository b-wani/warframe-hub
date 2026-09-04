import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // 스펙이 기능별 파일로 쪼개져 있고 테스트끼리 공유하는 상태가 없다(각 테스트가
  // 자기 브라우저 컨텍스트의 localStorage로만 시작한다) — 파일 안에서도 병렬로 돈다.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm build && pnpm start",
    // localhost가 아니라 127.0.0.1로 확인한다 — localhost가 ::1로 풀리는 머신에서는
    // 이미 떠 있는 서버를 못 찾아 reuseExistingServer가 매번 빌드를 다시 돌린다.
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
