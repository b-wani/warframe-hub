import { expect, test } from "@playwright/test";

const widgetName = "현재 단계 문맥 정보";

test("월드스테이트가 죽어도 트래커는 정상 동작하고 위젯만 폴백된다", async ({
  page,
}) => {
  // 위젯의 유일한 데이터 경로를 끊는다 (외부 API 장애 시뮬레이션)
  await page.route("**/api/worldstate", (route) => route.abort());
  await page.goto("/roadmap");

  await expect(page.getByRole("region", { name: widgetName })).toContainText(
    "정보 없음",
  );

  // 트래커 코어는 무관하게 동작한다
  const nextGoals = page.getByRole("region", { name: "다음 목표" });
  await expect(nextGoals).toContainText("보어의 전리품 (Vor's Prize)");
  await page
    .getByRole("checkbox", { name: "보어의 전리품 (Vor's Prize) 완료" })
    .check();
  await expect(nextGoals).toContainText("스승 (The Teacher)");
});

test("위젯이 현재 단계에 맞는 실시간 정보를 보여준다", async ({ page }) => {
  const now = Date.now();
  await page.route("**/api/worldstate", (route) =>
    route.fulfill({
      json: {
        voidTrader: {
          character: "Baro Ki'Teer",
          location: "Orcus Relay (Pluto)",
          activationAt: now + 26 * 3_600_000 + 1_800_000,
          expiryAt: now + 74 * 3_600_000,
        },
        cycles: [
          { region: "earth", isDay: true, expiryAt: now + 96 * 60_000 + 30_000 },
          { region: "cetus", isDay: false, expiryAt: now + 31 * 60_000 },
        ],
        fetchedAt: now,
        stale: false,
      },
    }),
  );
  await page.goto("/roadmap");

  const widget = page.getByRole("region", { name: widgetName });
  await expect(widget).toContainText("Baro Ki'Teer 도착까지 1일 2시간");
  // 입문 단계에서는 지구·시터스 주기가 관련 없다
  await expect(widget).not.toContainText("낮밤 주기");

  // 지구를 다루는 금성 교차점이 다음 목표가 되면 지구 주기가 붙는다
  for (const title of ["보어의 전리품 (Vor's Prize)", "스승 (The Teacher)"]) {
    await page.getByRole("checkbox", { name: `${title} 완료` }).check();
  }
  await expect(widget).toContainText("지구 낮밤 주기");
  await expect(widget).toContainText("낮 — 전환까지 1시간 36분");
});
