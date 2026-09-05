import { expect, test, type Page } from "./fixtures";
import {
  EARTH_NODE_COUNT,
  EARTH_NODE_IDS,
  EARTH_PROXIMA_NODE_IDS,
  distinctFrames,
  nodeLabel,
  nodeLabels,
  openEarth,
  openStarchart,
  recordFrames,
  seedProgress,
  waitForCameraRest,
} from "./helpers";

// 프록시마 ⚓ 토글 (#48)
// 고리를 어디에 놓는지와 천체 완료 집계는 단위 테스트(src/starchart/proxima.test.ts)
// 가 본다. 여기서는 브라우저에서만 확인되는 것 — 토글이 어느 행성에 뜨는가,
// 누르면 정말 갈아 끼워지는가, 고리의 노드도 같은 조작을 받는가.

const EARTH_PROXIMA_NODE_COUNT = EARTH_PROXIMA_NODE_IDS.length; // 7

/** ⚓ 토글. 이름으로 찾으면 "프록시마 전체 완료"와 겹치므로 자리로 찾는다. */
const proximaToggle = (page: Page) => page.locator("[data-proxima-toggle]");

test("프록시마가 있는 행성에만 ⚓ 토글이 뜬다", async ({ page }) => {
  await openEarth(page);
  // 손잡이는 버튼이고, 켜졌는지는 글로도 읽힌다(aria-pressed)
  await expect(
    page.getByRole("button", { name: "프록시마", exact: true }),
  ).toBeVisible();
  await expect(proximaToggle(page)).toHaveAttribute("aria-pressed", "false");

  // 수성에는 프록시마 그룹이 없다 — 토글할 것이 없으면 버튼도 없다
  await page.getByRole("button", { name: "← 성계로" }).click();
  await expect(page.locator("[data-focus-body]")).toHaveCount(0);
  await waitForCameraRest(page);
  await page.locator("[data-body-id='Mercury']").click();
  await expect(page.locator("[data-focus-body='Mercury']")).toBeVisible();
  await expect(proximaToggle(page)).toHaveCount(0);
});

// 비행 자체를 보는 테스트 — 기본값(모션 감소)을 되돌린다
test.describe("연속 비행", () => {
  test.use({ contextOptions: { reducedMotion: "no-preference" } });

  test("토글이 노드 구름과 행성 바깥 고리를 갈아 끼운다", async ({ page }) => {
    await openEarth(page);
    await recordFrames(page, "Earth");

    await proximaToggle(page).click();

    // 노드 구름 대신 프록시마 고리가 뜬다 — 행성 뷰에서 나가지는 않는다
    await expect(nodeLabels(page)).toHaveCount(EARTH_PROXIMA_NODE_COUNT);
    await expect(page.locator("[data-focus-group='Earth_SPACE']")).toContainText(
      "지구 프록시마",
    );
    await expect(proximaToggle(page)).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("[data-focus-body='Earth']")).toBeVisible();
    await expect(nodeLabel(page, "CrewBattleNode502")).toBeVisible();

    // 고리까지 가는 것도 컷이 아니라 비행이다(스펙 §2.1)
    await waitForCameraRest(page);
    expect(await distinctFrames(page)).toBeGreaterThan(5);

    // 되돌리면 일반 노드 구름으로 복귀한다
    await proximaToggle(page).click();
    await expect(nodeLabels(page)).toHaveCount(EARTH_NODE_COUNT);
    await expect(page.locator("[data-focus-group='Earth']")).toContainText("지구");
    await expect(proximaToggle(page)).toHaveAttribute("aria-pressed", "false");
  });
});

test("프록시마 노드도 3상태·상세·완료 체크가 같다", async ({ page }) => {
  await openEarth(page);
  await proximaToggle(page).click();
  await expect(nodeLabels(page)).toHaveCount(EARTH_PROXIMA_NODE_COUNT);
  await waitForCameraRest(page);

  // 진입 노드만 열려 있고 그 다음은 잠겨 있다 — 같은 파생 규칙이다
  await expect(nodeLabel(page, "CrewBattleNode502")).toHaveAttribute(
    "data-state",
    "uncleared",
  );
  const next = nodeLabel(page, "CrewBattleNode509");
  await expect(next).toHaveAttribute("data-state", "locked");
  await expect(next).toContainText("🔒");

  await nodeLabel(page, "CrewBattleNode502").click();
  const detail = page.locator("[data-selected-node='CrewBattleNode502']");
  await expect(detail).toContainText("Sover Strait");
  await expect(detail).toHaveAttribute("data-node-state", "uncleared");

  await detail.getByRole("checkbox", { name: "완료" }).check();
  await expect(nodeLabel(page, "CrewBattleNode502")).toHaveAttribute(
    "data-state",
    "cleared",
  );
  // 다음 노드가 함께 열린다 — 고리에서도 3상태는 파생값이다
  await expect(next).toHaveAttribute("data-state", "uncleared");
});

test("프록시마가 남아 있으면 행성 완료 아이콘이 뜨지 않는다", async ({ page }) => {
  // 행성 노드는 전부 완료, 프록시마는 손대지 않은 상태
  await seedProgress(page, EARTH_NODE_IDS);
  await openStarchart(page);
  await expect(page.locator("[data-body-id='Earth']")).not.toHaveAttribute(
    "data-state",
  );

  // 프록시마 쪽 HUD는 그 그룹의 일괄 체크를 내놓는다 — 그것까지 채우면 완료다
  await page.getByRole("button", { name: "지구", exact: true }).click();
  await expect(page.locator("[data-focus-body='Earth']")).toBeVisible();
  await proximaToggle(page).click();
  await page.getByRole("button", { name: "프록시마 전체 완료" }).click();
  await page
    .getByRole("button", { name: new RegExp(`${EARTH_PROXIMA_NODE_COUNT}개 완료`) })
    .click();

  await page.getByRole("button", { name: "← 성계로" }).click();
  const earth = page.locator("[data-body-id='Earth']");
  await expect(earth).toHaveAttribute("data-state", "complete");
  await expect(earth).toContainText("✓");
});
