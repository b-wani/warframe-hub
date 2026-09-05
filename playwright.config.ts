import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // 스펙이 기능별 파일로 쪼개져 있고 테스트끼리 공유하는 상태가 없다(각 테스트가
  // 자기 브라우저 컨텍스트의 localStorage로만 시작한다) — 파일 안에서도 병렬로 돈다.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // github 리포터는 성공 건을 찍지 않아 진행이 멈춘 듯 보인다 — list를 함께 둔다
  reporter: process.env.CI
    ? [["list"], ["github"], ["html", { open: "never" }]]
    : "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
    // 카메라 연속 비행을 건너뛴다(앱이 prefers-reduced-motion을 따른다) — 테스트
    // 하나가 비행이 멈추기를 기다리는 데 10초 넘게 쓰던 것을 없앤다. 비행 자체를
    // 검증하는 테스트만 `test.use({ contextOptions: { reducedMotion: "no-preference" } })`로 되돌린다.
    contextOptions: { reducedMotion: "reduce" },
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
