import { expect, test } from "./fixtures";
import {
  EARTH_NODE_COUNT,
  distinctFrames,
  nodeLabel,
  nodeLabels,
  openEarth,
  openStarchart,
  recordFrames,
  waitForCameraRest,
} from "./helpers";

// 행성 뷰와 연속 비행 (#42)
// 어떤 노드를 어디에 놓는지는 단위 테스트(src/starchart/node-cloud.test.ts)가,
// 무엇이 프레임에 들어오는지는 src/starchart/camera.test.ts가 본다. 여기서는
// 브라우저에서만 확인되는 것 — 전환이 컷이 아니라 비행인가, 빈 곳 클릭과 ESC로
// 빠져나오는가.

// 이 파일은 전환이 "컷이 아니라 비행"임을 보는 자리다 — 기본값(모션 감소)을 되돌린다
test.use({ contextOptions: { reducedMotion: "no-preference" } });

test("행성을 고르면 컷 없이 연속 비행으로 행성 뷰에 든다", { tag: "@smoke" }, async ({ page }) => {
  await openStarchart(page);
  await recordFrames(page, "Earth");

  await page.getByRole("button", { name: "지구", exact: true }).click();

  await expect(page.locator("[data-focus-body='Earth']")).toBeVisible();
  await expect(nodeLabels(page)).toHaveCount(EARTH_NODE_COUNT);
  await expect(nodeLabel(page, "SolNode27")).toBeVisible();

  // 카메라가 멈출 때까지 기다린 뒤, 지나온 자리가 몇 군데였는지 센다
  await waitForCameraRest(page);
  expect(await distinctFrames(page)).toBeGreaterThan(5);
});

test("성계 뷰로 되돌아가는 것도 같은 연속 비행이다", async ({ page }) => {
  await openEarth(page);

  await recordFrames(page, "Earth");
  await page.getByRole("button", { name: "← 성계로" }).click();

  await expect(page.locator("[data-focus-body]")).toHaveCount(0);
  // 노드 라벨은 행성 뷰의 것이다 — 성계 뷰로 돌아오면 사라진다
  await expect(nodeLabels(page)).toHaveCount(0);
  expect(await distinctFrames(page)).toBeGreaterThan(5);
});

test("빈 곳을 누르면 선택만 풀리고 행성 뷰는 그대로다", async ({ page }) => {
  // r3f의 onPointerMissed — 캔버스에서 아무것도 맞지 않은 클릭이 선택을 지운다.
  // 3D 히트 판정 위의 일이라 브라우저에서만 볼 수 있다.
  await openEarth(page);
  await nodeLabel(page, "SolNode89").click();
  await expect(
    page
      .locator("[data-selected-node='SolNode89']")
      .getByRole("heading", { name: "Mariana" }),
  ).toBeVisible();

  await page.mouse.click(4, 400);
  await expect(page.locator("[data-selected-node]")).toHaveCount(0);
  await expect(page.locator("[data-focus-body='Earth']")).toBeVisible();
});

test("ESC로 선택과 행성 뷰를 차례로 빠져나온다", { tag: "@smoke" }, async ({ page }) => {
  await openEarth(page);
  await nodeLabel(page, "SolNode89").click();
  await expect(page.locator("[data-selected-node]")).toHaveCount(1);

  await page.keyboard.press("Escape");
  await expect(page.locator("[data-selected-node]")).toHaveCount(0);
  await expect(page.locator("[data-focus-body='Earth']")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.locator("[data-focus-body]")).toHaveCount(0);
});
