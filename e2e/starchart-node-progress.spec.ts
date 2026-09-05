import { expect, test } from "@playwright/test";
import {
  EARTH_NODE_IDS,
  EARTH_PROXIMA_NODE_IDS,
  nodeLabel,
  openEarth,
  openStarchart,
  seedProgress,
} from "./helpers";

// 노드 3상태·상세·개별 체크 (#43)
// 파생 3상태 자체는 단위 테스트(src/starchart/progress.test.ts)가, 상세 패널의
// 내용은 src/app/starchart/node-detail-panel.test.tsx가 본다. 여기서는 브라우저
// 에서만 확인되는 것 — 토글 하나가 저장·파생·지도까지 정말 끌고 가는가.

test("노드가 3상태로 갈려 표시된다 — 잠긴 노드에는 자물쇠가 붙는다", async ({
  page,
}) => {
  await openEarth(page);

  // 진행도가 비어 있으면 진입 노드만 열려 있다
  await expect(nodeLabel(page, "SolNode27")).toHaveAttribute(
    "data-state",
    "uncleared",
  );
  const mariana = nodeLabel(page, "SolNode89");
  await expect(mariana).toHaveAttribute("data-state", "locked");
  await expect(mariana).toContainText("🔒");
});

test("완료 토글이 저장·파생 상태·지도를 한 번에 끌고 간다", { tag: "@smoke" }, async ({ page }) => {
  // 저장 검증을 새로고침으로 하느라 openEarth(≈10초)를 두 번 부르는 유일한 테스트 —
  // CI 러너에서 기본 30초 예산을 초과한다
  test.slow();
  await openEarth(page);

  await nodeLabel(page, "SolNode27").click();
  const detail = page.locator("[data-selected-node='SolNode27']");
  await expect(detail).toHaveAttribute("data-node-state", "uncleared");
  // 표시명·미션 유형·팩션·레벨 범위가 상세에 다 있다
  await expect(detail).toContainText("E Prime");
  await expect(detail).toContainText("섬멸");
  await expect(detail).toContainText("그리니어");
  await expect(detail).toContainText("1–3");

  await detail.getByRole("checkbox", { name: "완료" }).check();

  await expect(detail).toHaveAttribute("data-node-state", "cleared");
  await expect(nodeLabel(page, "SolNode27")).toHaveAttribute(
    "data-state",
    "cleared",
  );
  // 다음 노드가 함께 열린다 — 3상태는 저장값이 아니라 파생값이다
  await expect(nodeLabel(page, "SolNode89")).toHaveAttribute(
    "data-state",
    "uncleared",
  );

  // 저장까지 갔는지는 새로고침이 말해 준다
  await openEarth(page);
  await expect(nodeLabel(page, "SolNode27")).toHaveAttribute(
    "data-state",
    "cleared",
  );
});

test("교차점은 상세에서도 구별된다", async ({ page }) => {
  await openEarth(page);

  await nodeLabel(page, "EarthToVenusJunction").click();
  const detail = page.locator("[data-selected-node='EarthToVenusJunction']");
  await expect(detail).toContainText("금성 교차점");
  await expect(detail).toContainText("교차점");
});

test("호버 없이 탭만으로 노드 정보에 닿는다", async ({ page }) => {
  await openEarth(page);

  // 포인터를 올리지 않고 탭만 보낸다 — 호버에만 기대는 정보가 있으면 안 된다
  await nodeLabel(page, "SolNode27").dispatchEvent("click");
  await expect(page.locator("[data-selected-node='SolNode27']")).toBeVisible();
});

test("행성 전체 클리어면 성계 뷰의 그 행성에 완료 아이콘이 뜬다", async ({
  page,
}) => {
  // 지구는 프록시마가 종속된 행성이라 고리까지 채워야 천체가 완료다(스펙 §4.2)
  await seedProgress(page, [...EARTH_NODE_IDS, ...EARTH_PROXIMA_NODE_IDS]);
  await openStarchart(page);

  const earth = page.locator("[data-body-id='Earth']");
  await expect(earth).toHaveAttribute("data-state", "complete");
  await expect(earth).toContainText("✓");
  // 아직 아무것도 안 한 행성은 그대로다
  await expect(page.locator("[data-body-id='Mars']")).not.toHaveAttribute(
    "data-state",
  );
});
