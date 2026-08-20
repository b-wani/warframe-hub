import { expect, test } from "@playwright/test";

test("노드 상세를 열면 준비물·선행조건·주의사항·출처가 보인다", async ({
  page,
}) => {
  await page.goto("/roadmap");

  const node = page
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { name: /라이노 제작 시작/ }) });

  const detail = node.locator("details");
  await expect(detail.getByText("라이노 본체 설계도")).not.toBeVisible();

  await detail.getByText("상세 보기").click();

  await expect(
    node.getByRole("region", { name: "선행조건" }),
  ).toContainText("금성 교차점");
  await expect(
    node.getByRole("region", { name: "준비물" }),
  ).toContainText("라이노 본체 설계도 ×1");
  await expect(
    node.getByRole("region", { name: "주의사항" }),
  ).toContainText("파라존 마무리");
  await expect(
    node.getByRole("link", { name: "공식 위키 — Rhino" }),
  ).toHaveAttribute("href", "https://wiki.warframe.com/w/Rhino");
});

test("스포일러 노드는 기본 가림, 공개 버튼으로 열린다", async ({ page }) => {
  await page.goto("/roadmap");

  await expect(
    page.getByRole("heading", { name: "나타 (Natah)" }),
  ).toHaveCount(0);

  // 가림 상태에서는 어느 게이트가 어느 노드인지 알 수 없으므로 전부 연다
  const revealButtons = page.getByRole("button", { name: "스포일러 공개" });
  while ((await revealButtons.count()) > 0) {
    await revealButtons.first().click();
  }

  await expect(
    page.getByRole("heading", { name: "나타 (Natah)" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "두 번째 꿈 (The Second Dream)" }),
  ).toBeVisible();
});

test("모바일 뷰포트에서 가로 스크롤이 생기지 않는다", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/roadmap");

  // 모든 상세를 열어 긴 주의사항·출처 URL까지 포함해 확인한다
  const summaries = page.locator("details summary");
  const count = await summaries.count();
  for (let i = 0; i < count; i++) {
    await summaries.nth(i).click();
  }

  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});
