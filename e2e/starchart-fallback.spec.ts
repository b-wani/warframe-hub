import { expect, test, type Page } from "@playwright/test";
import {
  BODY_COUNT,
  EARTH_NODE_COUNT,
  labels,
  nodeLabel,
  nodeLabels,
  openStarchart,
  storedProgress,
} from "./helpers";

// 폴백 뷰 (#45)
// 목록의 내용과 파생 3상태는 단위 테스트(src/starchart/fallback.test.ts,
// src/app/starchart/fallback-view.test.tsx)가, 어느 뷰를 띄우는지의 규칙은
// src/app/starchart/starchart-view.test.tsx가 본다. 여기서는 브라우저에서만
// 확인되는 것 — WebGL이 정말 없을 때 자동으로 뜨는가, 3D와 같은 진행도인가.

const earthAccordion = (page: Page) => page.locator("[data-group-id='Earth']");

/** WebGL을 못 얻는 브라우저인 척한다 — 확장·설정으로 실제로 벌어지는 일이다. */
async function blockWebgl(page: Page) {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...rest: unknown[]
    ) {
      if (type.startsWith("webgl")) return null;
      return (original as (...args: unknown[]) => unknown).call(
        this,
        type,
        ...rest,
      );
    } as typeof original;
  });
}

/** 폴백 뷰에서 지구 아코디언을 펼친다. */
async function openEarthAccordion(page: Page) {
  await expect(earthAccordion(page)).toBeVisible();
  await earthAccordion(page).locator("summary").click();
}

test("WebGL을 못 쓰면 폴백 뷰가 자동으로 뜬다", { tag: "@smoke" }, async ({ page }) => {
  await blockWebgl(page);
  await page.goto("/starchart");

  await expect(page.getByText(/3D를 렌더할 수 없어/)).toBeVisible();
  await expect(earthAccordion(page)).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
  // 3D를 띄울 수 없는 환경에 3D로 가는 버튼을 두지 않는다
  await expect(page.getByRole("button", { name: "3D로 보기" })).toHaveCount(0);

  // 진행도 조작은 3D 없이도 그대로 있다
  await expect(
    page.getByRole("button", { name: "진행도 가져오기" }).first(),
  ).toBeVisible();
});

test("3D 환경에서도 목록으로 수동 전환하고 되돌아올 수 있다", { tag: "@smoke" }, async ({ page }) => {
  await openStarchart(page);

  await page.getByRole("button", { name: "목록으로 보기" }).click();
  await expect(earthAccordion(page)).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);

  await page.getByRole("button", { name: "3D로 보기" }).click();
  await expect(labels(page)).toHaveCount(BODY_COUNT, { timeout: 30_000 });
  await expect(earthAccordion(page)).toHaveCount(0);
});

test("폴백 뷰의 완료 체크가 3D 뷰와 같은 완료 집합에 반영된다", async ({
  page,
}) => {
  // 두 뷰를 오가며 성계지도를 두 번 세운다 — CI 러너에서 기본 30초 예산을 넘긴다
  test.slow();
  await openStarchart(page);
  await page.getByRole("button", { name: "목록으로 보기" }).click();
  await openEarthAccordion(page);

  const ePrime = earthAccordion(page).getByRole("checkbox", {
    name: /E Prime/,
  });
  await expect(ePrime).not.toBeChecked();
  await ePrime.check();

  // 같은 저장소에 남는다
  expect(JSON.parse((await storedProgress(page))!).completedIds).toEqual([
    "SolNode27",
  ]);
  // 파생 상태도 함께 간다 — 다음 노드가 목록에서 열린다
  await expect(
    earthAccordion(page).locator("[data-node-id='SolNode89']"),
  ).toHaveAttribute("data-state", "uncleared");

  // 3D로 돌아가면 같은 사실을 지도가 말한다
  await page.getByRole("button", { name: "3D로 보기" }).click();
  await page.getByRole("button", { name: "지구", exact: true }).click();
  await expect(nodeLabels(page)).toHaveCount(EARTH_NODE_COUNT);
  await expect(nodeLabel(page, "SolNode27")).toHaveAttribute(
    "data-state",
    "cleared",
  );
});
