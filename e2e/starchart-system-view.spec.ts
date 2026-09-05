import { expect, test } from "@playwright/test";
import { labelPositions, labels, openStarchart } from "./helpers";

// 성계 뷰 (#41)
// 성계 뷰의 수용 기준 중 브라우저에서만 확인되는 것들 — 3D가 실제로 뜨는가,
// 서버 렌더에 3D가 안 들어가는가, 카메라 조작이 되는가.
// 어떤 천체를 어디에 놓는지는 단위 테스트(src/starchart/bodies.test.ts)가 본다.

test("성계 뷰에 행성/위성 17 + 특수 구역 5가 렌더된다", { tag: "@smoke" }, async ({ page }) => {
  await openStarchart(page);
  await expect(page.getByRole("heading", { level: 1, name: "스타차트" })).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();

  const ids = await labels(page).evaluateAll((elements) =>
    elements.map((element) => (element as HTMLElement).dataset.bodyId),
  );
  expect(ids).toContain("Earth");
  expect(ids).toContain("Saturn");
  expect(ids).toContain("Void"); // 특수 구역
});

test("릴레이와 프록시마는 지도에 없다", async ({ page }) => {
  await openStarchart(page);
  const ids = await labels(page).evaluateAll((elements) =>
    elements.map((element) => (element as HTMLElement).dataset.bodyId ?? ""),
  );
  expect(ids).not.toContain("RelayStationSanctuary");
  expect(ids.filter((id) => id.endsWith("_SPACE"))).toEqual([]);
});

test("서버 렌더에 3D가 들어가지 않는다", { tag: "@smoke" }, async ({ page, baseURL }) => {
  const html = await (await page.request.get(`${baseURL}/starchart`)).text();
  expect(html).not.toContain("<canvas");
  // 3D는 클라이언트에서만 붙으므로 서버가 보내는 것은 로딩 문구다
  expect(html).toContain("성계지도를 불러오는 중");
});

test("텍스처 출처 표기가 페이지에 있다", async ({ page }) => {
  await page.goto("/starchart");
  await expect(
    page.getByRole("link", { name: /Solar System Scope/ }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "CC BY 4.0" })).toHaveAttribute(
    "href",
    "https://creativecommons.org/licenses/by/4.0/",
  );
});

test("카메라 궤도·줌이 동작한다", { tag: "@smoke" }, async ({ page }) => {
  await openStarchart(page);
  const canvas = page.locator("canvas");
  const box = (await canvas.boundingBox())!;
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

  const start = await labelPositions(page);

  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  await page.mouse.move(center.x + 120, center.y + 40, { steps: 8 });
  await page.mouse.up();
  const afterOrbit = await labelPositions(page);
  expect(afterOrbit).not.toEqual(start);

  await page.mouse.wheel(0, -600);
  await expect
    .poll(() => labelPositions(page).then((p) => p.join()))
    .not.toBe(afterOrbit.join());
});
