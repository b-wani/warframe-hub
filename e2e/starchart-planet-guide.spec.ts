import { expect, test, type Page } from "./fixtures";
import {
  BODY_COUNT,
  labels,
  openEarth,
  openStarchart,
  storedProgress,
  waitForCameraRest,
} from "./helpers";

// 행성 가이드 그릇과 비노드 목표 체크 (#49)
// 가이드 스키마·로드 규칙은 단위 테스트(src/starchart/planet-guide.test.ts)가,
// 패널이 무엇을 그리는지는 src/app/starchart/planet-guide-panel.test.tsx가 본다.
// 여기서는 브라우저에서만 확인되는 것 — 행성 뷰에 정말 함께 뜨는가, 체크가
// 로컬스토리지의 완료 집합에 슬러그로 남아 새로고침 뒤에도 살아 있는가.

const guide = (page: Page) => page.locator("[data-planet-guide]");

const objective = (page: Page, slug: string) =>
  page.locator(`[data-objective-slug="${slug}"]`).getByRole("checkbox");

test("행성 뷰에 들면 행성 가이드가 함께 뜬다", async ({ page }) => {
  await openStarchart(page);
  // 성계 뷰에는 가이드가 없다 — 어느 행성의 것인지가 정해지지 않았다
  await expect(guide(page)).toHaveCount(0);

  await page.getByRole("button", { name: "지구", exact: true }).click();
  await expect(guide(page)).toHaveAttribute("data-planet-guide", "Earth");
  await expect(objective(page, "vors-prize")).toBeVisible();
});

test("가이드가 없는 행성에는 패널도 뜨지 않는다", async ({ page }) => {
  await openStarchart(page);
  await page.getByRole("button", { name: "명왕성", exact: true }).click();

  await expect(page.locator("[data-focus-body='Pluto']")).toBeVisible();
  await expect(guide(page)).toHaveCount(0);
});

test("비노드 목표 체크가 완료 집합에 슬러그로 남고 새로고침 뒤에도 복원된다", async ({
  page,
}) => {
  await openEarth(page);

  await objective(page, "vors-prize").check();
  await expect(objective(page, "vors-prize")).toBeChecked();
  expect(await storedProgress(page)).toContain("vors-prize");

  await page.reload();
  // 새로고침 뒤에는 장면이 다시 서고 카메라가 멈출 때까지 기다린다 — 라벨이
  // 움직이는 동안 누르면 Playwright가 자리가 굳기를 기다리다 시간을 다 쓴다
  await expect(labels(page)).toHaveCount(BODY_COUNT, { timeout: 30_000 });
  await waitForCameraRest(page);
  await page.getByRole("button", { name: "지구", exact: true }).click();
  await expect(objective(page, "vors-prize")).toBeChecked();

  // 해제도 같은 슬러그로 되돌아간다
  await objective(page, "vors-prize").uncheck();
  expect(await storedProgress(page)).not.toContain("vors-prize");
});

test("⚓ 프록시마를 보는 동안에는 행성 가이드가 물러난다", async ({ page }) => {
  await openEarth(page);
  await expect(guide(page)).toHaveCount(1);

  await page.locator("[data-proxima-toggle='Earth_SPACE']").click();
  await expect(guide(page)).toHaveCount(0);

  await page.locator("[data-proxima-toggle='Earth_SPACE']").click();
  await expect(guide(page)).toHaveCount(1);
});

test("교차점은 비노드 목표가 아니다 — 가이드에 체크 항목으로 없다", async ({
  page,
}) => {
  await openEarth(page);

  const items = guide(page).locator("[data-objective-slug]");
  await expect(items).toHaveCount(3);
  for (const slug of await items.evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-objective-slug")),
  )) {
    expect(slug).not.toMatch(/^SolNode/);
  }
});
