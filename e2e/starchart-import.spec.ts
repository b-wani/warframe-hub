import { expect, test, type Page } from "./fixtures";
import { openStarchart, seedProgress, storedProgress } from "./helpers";

// 진행도 가져오기 (#44)
// 파싱 4구분과 미리보기 숫자는 단위 테스트(src/starchart/profile-import.test.ts,
// src/app/starchart/import-wizard.test.tsx)가 본다. 여기서는 브라우저에서만
// 확인되는 것 — 새 탭이 정말 열리는가, 붙여넣기 한 번이 저장까지 가는가,
// 배너 해제와 초기화가 새로고침을 견디는가.

const PROFILE_JSON = JSON.stringify({
  Results: [
    {
      Missions: [
        { Tag: "SolNode27", Completes: 4 },
        { Tag: "SolNode89", Tier: 1 }, // 스틸패스 — 무시된다
        { Tag: "EventNode1" }, // 우리가 모르는 노드 — 버린다
      ],
    },
  ],
});

const banner = (page: Page) =>
  page.getByText(/프로필을 붙여넣으면 클리어한 노드/);

/** 2단계까지 연다 — 새 탭을 여는 길은 따로 본다. */
async function openPasteStep(page: Page) {
  await page.getByRole("button", { name: "진행도 가져오기" }).first().click();
  await page.getByRole("button", { name: "이미 복사했어요" }).click();
}

test("온보딩 배너는 완료가 비어 있을 때만, 닫으면 다시 뜨지 않는다", async ({
  page,
}) => {
  await openStarchart(page);
  await expect(banner(page)).toBeVisible();

  await page.getByRole("button", { name: "닫기" }).click();
  await expect(banner(page)).toHaveCount(0);

  // 해제는 영구 기록이다 — 새로고침해도 돌아오지 않는다
  await openStarchart(page);
  await expect(banner(page)).toHaveCount(0);
  // 가져오기는 툴바에서 언제든 열린다
  await expect(
    page.getByRole("button", { name: "진행도 가져오기" }),
  ).toBeVisible();
});

test("완료가 하나라도 있으면 배너가 뜨지 않는다", async ({ page }) => {
  await seedProgress(page, ["SolNode27"]);
  await openStarchart(page);
  await expect(banner(page)).toHaveCount(0);
});

test("계정 ID를 넣으면 앱이 조립한 프로필 URL이 새 탭으로 열린다", { tag: "@smoke" }, async ({
  page,
}) => {
  // 비문서화 엔드포인트를 실제로 부르지 않는다 — 열리는 주소만 확인한다
  await page
    .context()
    .route("**/getProfileViewingData.php*", (route) =>
      route.fulfill({ contentType: "application/json", body: "{}" }),
    );
  await openStarchart(page);

  await page.getByRole("button", { name: "진행도 가져오기" }).first().click();
  await page.getByLabel("계정 ID").fill("5f2b9c1d3e4a5b6c7d8e9f01");

  const [profileTab] = await Promise.all([
    page.waitForEvent("popup"),
    page.getByRole("button", { name: "프로필 열기" }).click(),
  ]);

  expect(profileTab.url()).toBe(
    "https://api.warframe.com/cdn/getProfileViewingData.php?playerId=5f2b9c1d3e4a5b6c7d8e9f01",
  );
  await profileTab.close();
  await expect(page.getByLabel("프로필 JSON")).toBeVisible();
});

test("붙여넣기 한 번이 미리보기를 거쳐 합집합으로 저장까지 간다", { tag: "@smoke" }, async ({
  page,
}) => {
  await seedProgress(page, ["SolNode11"]);
  await openStarchart(page);
  await openPasteStep(page);

  await page.getByLabel("프로필 JSON").fill(PROFILE_JSON);
  await page.getByRole("button", { name: "확인" }).click();

  await expect(page.getByText(/노드 1개 인식/)).toContainText("1개 새로 추가");
  await expect(page.getByText(/노드 1개 인식/)).toContainText("기존 1개 유지");
  await expect(page.getByText(/스틸패스 기록은 v1에서 다루지 않습니다/)).toBeVisible();

  await page.getByRole("button", { name: "진행도에 반영" }).click();

  // 기존 완료는 남고 인식한 노드만 더해진다 — 지워지는 것이 없다
  const stored = JSON.parse((await storedProgress(page))!);
  expect(stored.completedIds.sort()).toEqual(["SolNode11", "SolNode27"]);
});

test("URL을 붙여넣으면 1단계로 되돌아간다", async ({ page }) => {
  await openStarchart(page);
  await openPasteStep(page);

  await page
    .getByLabel("프로필 JSON")
    .fill(
      "https://api.warframe.com/cdn/getProfileViewingData.php?playerId=5f2b9c1d3e4a5b6c7d8e9f01",
    );
  await page.getByRole("button", { name: "확인" }).click();

  await expect(page.getByLabel("계정 ID")).toHaveValue(
    "5f2b9c1d3e4a5b6c7d8e9f01",
  );
});

test("진행도 전체 초기화는 삭제 개수를 확인받고 나서야 지운다", async ({
  page,
}) => {
  await seedProgress(page, ["SolNode27", "SolNode89"]);
  await openStarchart(page);

  // 먼저 취소해 본다 — 진행도가 그대로여야 한다
  page.once("dialog", (dialog) => {
    expect(dialog.message()).toContain("완료 2개가 삭제됩니다");
    return dialog.dismiss();
  });
  await page.getByRole("button", { name: "진행도 설정" }).click();
  await page.getByRole("button", { name: "진행도 전체 초기화" }).click();
  expect(JSON.parse((await storedProgress(page))!).completedIds).toHaveLength(2);

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "진행도 설정" }).click();
  await page.getByRole("button", { name: "진행도 전체 초기화" }).click();

  await expect
    .poll(async () => JSON.parse((await storedProgress(page))!).completedIds)
    .toEqual([]);
});
