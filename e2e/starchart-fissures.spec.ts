import { expect, test, type Page } from "./fixtures";
import {
  EARTH_NODE_COUNT,
  distinctFrames,
  nodeLabels,
  openEarth,
  openStarchart,
  recordFrames,
  waitForCameraRest,
} from "./helpers";

// 보이드 균열 오버레이 (#47)
// 어떤 균열을 어느 노드로 해석하는지는 단위 테스트(src/starchart/fissures.test.ts)가,
// 어댑터의 섹션 규약은 src/worldstate/*.test.ts가 본다. 여기서는 브라우저에서만
// 확인되는 것 — 심볼이 지도에 뜨는가, 목록에서 고르면 그 노드까지 날아가는가,
// 월드스테이트가 죽어도 지도가 서는가.

/** 월드스테이트 라우트를 우리가 정한 스냅숏으로 바꿔치기한다. */
async function withFissures(page: Page) {
  await page.route("**/api/worldstate", async (route) => {
    const now = Date.now();
    await route.fulfill({
      json: {
        voidTrader: null,
        cycles: [],
        fissures: [
          {
            nodeKey: "E Prime (Earth)",
            nodeName: "E Prime",
            tier: "Lith",
            activationAt: now - 60_000,
            expiryAt: now + 40 * 60_000,
            hard: false,
          },
          {
            nodeKey: "Mariana (Earth)",
            nodeName: "Mariana",
            tier: "Axi",
            activationAt: now - 60_000,
            expiryAt: now + 20 * 60_000,
            hard: false,
          },
        ],
        fetchedAt: now,
        stale: false,
      },
    });
  });
}

// 비행 자체를 보는 테스트 — 기본값(모션 감소)을 되돌린다
test.describe("연속 비행", () => {
  test.use({ contextOptions: { reducedMotion: "no-preference" } });

  test("목록에서 균열을 고르면 그 노드까지 연속 비행한다", async ({ page }) => {
    await withFissures(page);
    await openStarchart(page);
    await recordFrames(page, "Earth");

    await page.getByRole("button", { name: "보이드 균열 2" }).click();
    await page.locator("[data-fissure-node='SolNode89']").click();

    // 행성 뷰에 들면서 그 노드가 골라져 있다 — 상세가 이미 열려 있다
    await expect(page.locator("[data-focus-body='Earth']")).toBeVisible();
    await expect(
      page
        .locator("[data-selected-node='SolNode89']")
        .getByRole("heading", { name: "Mariana" }),
    ).toBeVisible();

    // 컷이 아니라 비행이다 — 지나온 자리가 여러 군데 남는다
    await waitForCameraRest(page);
    expect(await distinctFrames(page)).toBeGreaterThan(5);
  });
});

test("균열이 있는 노드에는 지도에도 로테이션 심볼이 얹힌다", async ({ page }) => {
  await withFissures(page);
  await openEarth(page);

  const symbol = page.getByRole("button", { name: /보이드 균열 리스 — E Prime/ });
  await expect(symbol).toBeVisible();
  // 심볼도 손잡이다 — 누르면 그 노드의 상세가 열린다
  await symbol.click();
  await expect(page.locator("[data-selected-node='SolNode27']")).toBeVisible();
});

test("월드스테이트가 죽어도 지도·진행도는 온전하고 균열만 빠진다", { tag: "@smoke" }, async ({
  page,
}) => {
  await page.route("**/api/worldstate", (route) => route.abort());
  await openStarchart(page);

  // 지도는 그대로다 — 천체도, 행성 뷰도, 완료 체크도 월드스테이트와 무관하다
  await page.getByRole("button", { name: "지구", exact: true }).click();
  await expect(nodeLabels(page)).toHaveCount(EARTH_NODE_COUNT);
  await waitForCameraRest(page);
  await page.getByRole("button", { name: "E Prime" }).click();
  await page
    .locator("[data-selected-node='SolNode27']")
    .getByRole("checkbox", { name: "완료" })
    .check();
  await expect(
    page.locator("[data-node-id='SolNode27']"),
  ).toHaveAttribute("data-state", "cleared");

  // 균열만 빠지고, 그 사실을 목록 탭이 말한다
  await expect(page.locator("[data-fissure-node]")).toHaveCount(0);
  await page.getByRole("button", { name: "보이드 균열" }).click();
  await expect(page.getByText(/월드스테이트를 받지 못해/)).toBeVisible();
});
