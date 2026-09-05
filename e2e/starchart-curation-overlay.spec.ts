import { expect, test } from "@playwright/test";
import { nodeLabel, openEarth } from "./helpers";

// 큐레이션 오버레이 그릇 — 스키마·로더·상세 표시 (#50)
// 스키마와 로드 규칙은 단위 테스트(src/starchart/node-overlay.test.ts)가, 패널이
// 무엇을 그리는지는 src/app/starchart/node-detail-panel.test.tsx가 본다. 여기서는
// 브라우저에서만 확인되는 것 — 저작된 콘텐츠가 실제 노드를 고르면 정말 함께 뜨고,
// 저작이 없는 노드는 구조화 데이터만으로 서는가.

test("주요 노드를 고르면 큐레이션 오버레이가 상세에 함께 뜬다", async ({
  page,
}) => {
  await openEarth(page);

  await nodeLabel(page, "EarthToVenusJunction").click();
  const detail = page.locator("[data-selected-node='EarthToVenusJunction']");
  // 구조화 데이터는 그대로다 — 오버레이는 얹는 것이지 대신하는 것이 아니다
  await expect(detail).toContainText("금성 교차점");
  await expect(detail.locator("[data-node-overlay]")).toBeVisible();
  await expect(detail).toContainText("금성으로 가는 관문");
  await expect(detail).toContainText("택슨 센티넬 설계도");
  await expect(detail).toContainText("기준 패치 Update 43");
});

test("저작이 없는 노드는 구조화 데이터만으로 선다", async ({ page }) => {
  await openEarth(page);

  await nodeLabel(page, "SolNode27").click();
  const detail = page.locator("[data-selected-node='SolNode27']");
  await expect(detail).toContainText("E Prime");
  await expect(detail.locator("[data-node-overlay]")).toHaveCount(0);
});

test("콘텐츠 기준 패치가 페이지에 표기된다", async ({ page }) => {
  await openEarth(page);
  await expect(page.getByText(/콘텐츠 기준 패치/)).toBeVisible();
});
