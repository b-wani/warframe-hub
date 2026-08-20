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

test("트래커를 모바일에서 조작할 수 있다 — 완료 체크와 구간 일괄 체크", async ({
  page,
}) => {
  await page.goto("/roadmap");

  await expect(page.getByText(/콘텐츠 기준 패치: Update/)).toBeVisible();
  const summary = page.getByRole("region", { name: "진행 요약" });
  await expect(summary).toContainText("완료율 0%");

  await page.getByRole("checkbox").first().tap();
  await expect(summary).not.toContainText("완료율 0%");

  const bulk = page
    .getByRole("button", { name: /까지 일괄 완료/ })
    .last();
  await bulk.tap();
  const confirm = page.getByRole("region", { name: "일괄 완료 확인" });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "일괄 완료" }).tap();

  await expect(summary).toContainText("완료율 100%");
  expect(await horizontalOverflow(page)).toBe(0);
});

test("노드 상세를 모바일에서 열어 읽을 수 있다", async ({ page }) => {
  await page.goto("/roadmap");

  const node = page
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { name: /라이노 제작 시작/ }) });
  await node.locator("details summary").tap();

  await expect(node.getByRole("region", { name: "준비물" })).toBeVisible();
  await expect(node.getByText(/기준 패치: Update/)).toBeVisible();
  expect(await horizontalOverflow(page)).toBe(0);
});

test("탭 대상이 손가락으로 누를 만한 크기다", async ({ page }) => {
  await page.goto("/roadmap");

  // 상세(details summary)도 손가락으로 여는 대상이다
  const targets = page.locator(
    "button:visible, label:visible, details summary:visible",
  );
  const count = await targets.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const box = await targets.nth(i).boundingBox();
    const name = await targets.nth(i).innerText();
    expect(box, name).not.toBeNull();
    expect(box!.height, `높이: ${name}`).toBeGreaterThanOrEqual(40);
  }
});
