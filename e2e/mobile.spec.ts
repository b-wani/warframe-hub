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

/** 프레임 밖으로 나간 천체 라벨의 id — 비어 있어야 성계 전체가 보인다는 뜻이다. */
async function bodiesOutsideFrame(page: import("@playwright/test").Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("[data-body-id]")]
      .filter((element) => {
        const box = element.getBoundingClientRect();
        return (
          box.left < 0 ||
          box.right > window.innerWidth ||
          box.top < 0 ||
          box.bottom > window.innerHeight
        );
      })
      .map((element) => (element as HTMLElement).dataset.bodyId),
  );
}

// 적응 규칙 1 — 종횡비 인지 카메라 프레이밍(스펙 §8). 세로로 긴 화면은 가로
// 화각이 좁아 데스크톱과 같은 거리로는 성계 좌우가 잘린다.
test("세로 화면에서도 성계 전체가 프레임 안에 들어온다", async ({ page }) => {
  await page.goto("/starchart");
  await expect(page.locator("[data-body-id]")).toHaveCount(22, {
    timeout: 30_000,
  });
  expect(await bodiesOutsideFrame(page)).toEqual([]);
});

test("화면을 돌려도 프레임을 다시 잡는다 — 카메라를 만지기 전까지는", async ({
  page,
}) => {
  await page.goto("/starchart");
  await expect(page.locator("[data-body-id]")).toHaveCount(22, {
    timeout: 30_000,
  });

  await page.setViewportSize({ width: 844, height: 390 }); // 가로로 돌린다
  await expect.poll(() => bodiesOutsideFrame(page)).toEqual([]);

  await page.setViewportSize({ width: 390, height: 844 }); // 다시 세로로
  await expect.poll(() => bodiesOutsideFrame(page)).toEqual([]);
});

// 탭 타깃 44px·HUD 배치·실기기 스모크 등 적응 규칙의 나머지는 #51에서 본다.
