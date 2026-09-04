import { expect, test } from "@playwright/test";
import {
  EARTH_NODE_COUNT,
  nodeLabel,
  openEarth,
  storedProgress,
} from "./helpers";

// 구간 일괄 체크 (#46)
// 확인 단계의 규칙(개수·무효화·비노출)은 단위 테스트(src/app/starchart/
// bulk-complete.test.tsx)가 본다. 여기서는 브라우저에서만 확인되는 것 — 확정
// 한 번이 저장·파생·지도까지 정말 끌고 가는가.

test("여기까지 완료가 확인 단계를 거쳐 선행 노드까지 채운다", async ({ page }) => {
  await openEarth(page);

  await nodeLabel(page, "SolNode89").click();
  const detail = page.locator("[data-selected-node='SolNode89']");
  await detail.getByRole("button", { name: "여기까지 완료" }).click();
  // E Prime + Mariana = 2개
  await expect(detail).toContainText("2개가 새로 완료됩니다");

  await detail.getByRole("button", { name: "2개 완료" }).click();

  // 지도가 곧바로 같은 사실을 말한다 — 선행 노드도 함께 클리어다
  await expect(nodeLabel(page, "SolNode27")).toHaveAttribute(
    "data-state",
    "cleared",
  );
  await expect(nodeLabel(page, "SolNode89")).toHaveAttribute(
    "data-state",
    "cleared",
  );
  // 확인 단계가 읽은 개수만큼만 반영된다
  expect(JSON.parse((await storedProgress(page))!).completedIds.sort()).toEqual([
    "SolNode27",
    "SolNode89",
  ]);
  // 자신과 선행이 다 찼으니 버튼이 사라진다
  await expect(
    detail.getByRole("button", { name: "여기까지 완료" }),
  ).toHaveCount(0);
});

test("확인을 띄운 뒤 진행이 바뀌면 그 확인은 무효가 된다", async ({ page }) => {
  await openEarth(page);

  await nodeLabel(page, "SolNode89").click();
  const detail = page.locator("[data-selected-node='SolNode89']");
  await detail.getByRole("button", { name: "여기까지 완료" }).click();
  await expect(detail).toContainText("2개가 새로 완료됩니다");

  // 확인이 떠 있는 채로 개별 체크를 한다 — 화면에 남은 개수가 옛말이 된다
  await detail.getByRole("checkbox", { name: "완료" }).check();

  await expect(detail.getByRole("button", { name: "2개 완료" })).toHaveCount(0);
  await expect(detail).toContainText("진행도가 바뀌어");
  // 다시 확인하면 그때의 개수를 센다
  await detail.getByRole("button", { name: "여기까지 완료" }).click();
  await expect(detail).toContainText("1개가 새로 완료됩니다");
});

test("행성 전체 완료가 같은 규칙으로 행성 하나를 채운다", async ({ page }) => {
  await openEarth(page);

  await page.getByRole("button", { name: "행성 전체 완료" }).click();
  await expect(page.getByText("21개가 새로 완료됩니다")).toBeVisible();
  await page.getByRole("button", { name: "21개 완료" }).click();

  expect(JSON.parse((await storedProgress(page))!).completedIds).toHaveLength(
    EARTH_NODE_COUNT,
  );
  await expect(page.getByRole("button", { name: "행성 전체 완료" })).toHaveCount(
    0,
  );

  // "행성 전체 완료"가 채우는 것은 그 행성의 그룹이지 천체가 아니다 — 지구는
  // 프록시마가 종속돼 있어(스펙 §4.2) 고리가 남은 채로는 완료 아이콘이 뜨지
  // 않는다. 고리까지 채우는 길은 #48 섹션의 테스트가 끝까지 따라간다.
  await page.getByRole("button", { name: "← 성계로" }).click();
  await expect(page.locator("[data-body-id='Earth']")).not.toHaveAttribute(
    "data-state",
  );
});
