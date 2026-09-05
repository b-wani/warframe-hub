import { expect, test, type Page } from "./fixtures";
import {
  EARTH_NODE_COUNT,
  EARTH_PROXIMA_NODE_IDS,
  distinctFrames,
  nodeLabel,
  nodeLabels,
  openEarth,
  recordFrames,
  waitForCameraRest,
} from "./helpers";

// 프록시마 ⚓ 토글 (#48)
// 고리를 어디에 놓는지와 천체 완료 집계는 단위 테스트(src/starchart/proxima.test.ts)
// 가 본다(어느 행성에 토글이 붙는가, 고리가 남으면 행성이 미완료인가도 거기).
// 여기서는 브라우저에서만 확인되는 것 — 누르면 정말 비행으로 갈아 끼워지는가.

const EARTH_PROXIMA_NODE_COUNT = EARTH_PROXIMA_NODE_IDS.length; // 7

/** ⚓ 토글. 이름으로 찾으면 "프록시마 전체 완료"와 겹치므로 자리로 찾는다. */
const proximaToggle = (page: Page) => page.locator("[data-proxima-toggle]");

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

