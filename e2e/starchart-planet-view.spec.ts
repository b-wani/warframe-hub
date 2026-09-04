import { expect, test } from "@playwright/test";
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
// 브라우저에서만 확인되는 것 — 전환이 컷이 아니라 비행인가, 노드가 눌리는가.

test("행성을 고르면 컷 없이 연속 비행으로 행성 뷰에 든다", async ({ page }) => {
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

test("행성 뷰에서 노드를 고르면 표시된다", async ({ page }) => {
  // 라벨은 비행이 끝나야 제자리에 선다 — 움직이는 동안 누르면 옆 라벨이 맞는다
  await openEarth(page);

  await nodeLabel(page, "SolNode89").click();
  await expect(
    page
      .locator("[data-selected-node='SolNode89']")
      .getByRole("heading", { name: "Mariana" }),
  ).toBeVisible();

  // 빈 곳을 누르면 선택만 풀리고 행성 뷰는 그대로다
  await page.mouse.click(4, 400);
  await expect(page.locator("[data-selected-node]")).toHaveCount(0);
  await expect(page.locator("[data-focus-body='Earth']")).toBeVisible();
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

test("ESC로 선택과 행성 뷰를 차례로 빠져나온다", async ({ page }) => {
  await openEarth(page);
  await nodeLabel(page, "SolNode89").click();
  await expect(page.locator("[data-selected-node]")).toHaveCount(1);

  await page.keyboard.press("Escape");
  await expect(page.locator("[data-selected-node]")).toHaveCount(0);
  await expect(page.locator("[data-focus-body='Earth']")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.locator("[data-focus-body]")).toHaveCount(0);
});
