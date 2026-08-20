import { expect, test } from "@playwright/test";

test("노드 체크 → 다음 목표 갱신 → 새로고침 후 유지", async ({ page }) => {
  await page.goto("/roadmap");

  const nextGoals = page.getByRole("region", { name: "다음 목표" });
  await expect(nextGoals).toContainText("보어의 전리품 (Vor's Prize)");

  await page
    .getByRole("checkbox", { name: "보어의 전리품 (Vor's Prize) 완료" })
    .check();

  await expect(nextGoals).toContainText("스승 (The Teacher)");
  await expect(nextGoals).not.toContainText("보어의 전리품");

  await page.reload();

  await expect(
    page.getByRole("checkbox", { name: "보어의 전리품 (Vor's Prize) 완료" }),
  ).toBeChecked();
  await expect(
    page.getByRole("region", { name: "다음 목표" }),
  ).toContainText("스승 (The Teacher)");
});

test("복귀 유저: 구간 일괄 체크 → 다음 목표 갱신 → 새로고침 후 유지", async ({
  page,
}) => {
  await page.goto("/roadmap");

  await page
    .getByRole("button", { name: "수성 교차점 (금성 → 수성)까지 일괄 완료" })
    .click();

  const confirm = page.getByRole("region", { name: "일괄 완료 확인" });
  await expect(confirm).toContainText("6개");
  await confirm.getByRole("button", { name: "일괄 완료" }).click();

  const nextGoals = page.getByRole("region", { name: "다음 목표" });
  await expect(nextGoals).toContainText("각성의 순간 (Once Awake)");
  await expect(page.getByRole("region", { name: "진행 요약" })).toContainText(
    "6/16",
  );

  await page.reload();

  await expect(
    page.getByRole("checkbox", { name: "수성 교차점 (금성 → 수성) 완료" }),
  ).toBeChecked();
  await expect(
    page.getByRole("region", { name: "다음 목표" }),
  ).toContainText("각성의 순간 (Once Awake)");
});
