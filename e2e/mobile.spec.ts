import { expect, test } from "@playwright/test";

// 뉴비는 게임 중 폰으로 본다 — 핵심 화면은 모바일에서 그대로 쓸 수 있어야 한다.
// CI는 chromium만 설치하므로 디바이스 프리셋(webkit) 대신 뷰포트·터치만 흉내낸다.
test.use({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  hasTouch: true,
});

async function horizontalOverflow(page: import("@playwright/test").Page) {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
}

test("홈에 가로 스크롤이 생기지 않는다", async ({ page }) => {
  await page.goto("/");
  expect(await horizontalOverflow(page)).toBe(0);
});

test("스타차트에 가로 스크롤이 생기지 않는다", async ({ page }) => {
  await page.goto("/starchart");
  await expect(page.locator("[data-body-id]").first()).toBeAttached({
    timeout: 30_000,
  });
  expect(await horizontalOverflow(page)).toBe(0);
});

// 종횡비 인지 프레이밍·탭 타깃 44px·HUD 배치 등 적응 규칙 4항목(스펙 §8)의
// 나머지는 #51에서 본다.
