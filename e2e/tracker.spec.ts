import { expect, test } from "@playwright/test";

test("노드 체크 → 다음 목표 갱신 → 새로고침 후 유지", async ({ page }) => {
  await page.goto("/roadmap");

  const nextGoals = page.getByRole("region", { name: "다음 목표" });
  await expect(nextGoals).toContainText("보의 전리품 (Vor's Prize)");

  await page
    .getByRole("checkbox", { name: "보의 전리품 (Vor's Prize) 완료" })
    .check();

  await expect(nextGoals).toContainText("지구 → 금성 정크션");
  await expect(nextGoals).not.toContainText("보의 전리품");

  await page.reload();

  await expect(
    page.getByRole("checkbox", { name: "보의 전리품 (Vor's Prize) 완료" }),
  ).toBeChecked();
  await expect(
    page.getByRole("region", { name: "다음 목표" }),
  ).toContainText("지구 → 금성 정크션");
});
