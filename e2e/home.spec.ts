import { expect, test } from "@playwright/test";
import { waitForSystemView } from "./helpers";

test("홈 페이지가 렌더링된다", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "워프레임 허브" }),
  ).toBeVisible();
});

test("홈에서 스타차트로 들어간다", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "스타차트 열기" }).click();
  await expect(page).toHaveURL(/\/starchart$/);
  await waitForSystemView(page);
});
