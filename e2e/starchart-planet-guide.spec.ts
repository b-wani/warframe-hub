import { expect, test, type Page } from "./fixtures";
import { openStarchart } from "./helpers";

// 행성 가이드 그릇과 비노드 목표 체크 (#49)
// 가이드 스키마·로드 규칙은 단위 테스트(src/starchart/planet-guide.test.ts)가,
// 패널이 무엇을 그리는지와 체크가 슬러그로 알려지는지는
// src/app/starchart/planet-guide-panel.test.tsx가, 슬러그가 완료 집합에 저장·복원되는
// 것은 src/app/starchart/use-progress.test.ts가 본다. 여기서는 브라우저에서만
// 확인되는 것 — 3D 행성 뷰에 정말 함께 뜨고, 프록시마를 보는 동안 물러나는가.

const guide = (page: Page) => page.locator("[data-planet-guide]");

const objective = (page: Page, slug: string) =>
  page.locator(`[data-objective-slug="${slug}"]`).getByRole("checkbox");

test("행성 뷰에 들면 행성 가이드가 함께 뜨고, ⚓ 프록시마를 보는 동안에는 물러난다", async ({
  page,
}) => {
  await openStarchart(page);
  // 성계 뷰에는 가이드가 없다 — 어느 행성의 것인지가 정해지지 않았다
  await expect(guide(page)).toHaveCount(0);

  await page.getByRole("button", { name: "지구", exact: true }).click();
  await expect(guide(page)).toHaveAttribute("data-planet-guide", "Earth");
  await expect(objective(page, "vors-prize")).toBeVisible();

  // 가이드가 말하는 것은 행성이다 — 프록시마 고리를 보는 동안에는 물러난다
  await page.locator("[data-proxima-toggle='Earth_SPACE']").click();
  await expect(guide(page)).toHaveCount(0);
  await page.locator("[data-proxima-toggle='Earth_SPACE']").click();
  await expect(guide(page)).toHaveAttribute("data-planet-guide", "Earth");
});

