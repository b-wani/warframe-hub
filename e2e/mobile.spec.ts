import { expect, test } from "@playwright/test";
import {
  EARTH_NODE_COUNT,
  nodeLabel,
  nodeLabels,
  openStarchart,
  waitForCameraRest,
} from "./helpers";

// 뉴비는 게임 중 폰으로 본다 — 핵심 화면은 모바일에서 그대로 쓸 수 있어야 한다.
// CI는 chromium만 설치하므로 디바이스 프리셋(webkit) 대신 뷰포트·터치만 흉내낸다.
test.use({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  hasTouch: true,
});

async function horizontalOverflow(page: import("@playwright/test").Page) {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
}

test("홈에 가로 스크롤이 생기지 않는다", async ({ page }) => {
  await page.goto("/");
  expect(await horizontalOverflow(page)).toBe(0);
});

test("스타차트에 가로 스크롤이 생기지 않는다", async ({ page }) => {
  await page.goto("/starchart");
  await expect(page.locator("[data-body-id]").first()).toBeAttached({
    timeout: 30_000,
  });
  expect(await horizontalOverflow(page)).toBe(0);
});

/** 프레임 밖으로 나간 천체 라벨의 id — 비어 있어야 성계 전체가 보인다는 뜻이다. */
async function bodiesOutsideFrame(page: import("@playwright/test").Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("[data-body-id]")]
      .filter((element) => {
        const box = element.getBoundingClientRect();
        return (
          box.left < 0 ||
          box.right > window.innerWidth ||
          box.top < 0 ||
          box.bottom > window.innerHeight
        );
      })
      .map((element) => (element as HTMLElement).dataset.bodyId),
  );
}

// 적응 규칙 1 — 종횡비 인지 카메라 프레이밍(스펙 §8). 세로로 긴 화면은 가로
// 화각이 좁아 데스크톱과 같은 거리로는 성계 좌우가 잘린다.
test("세로 화면에서도 성계 전체가 프레임 안에 들어온다", async ({ page }) => {
  await page.goto("/starchart");
  await expect(page.locator("[data-body-id]")).toHaveCount(22, {
    timeout: 30_000,
  });
  expect(await bodiesOutsideFrame(page)).toEqual([]);
});

test("화면을 돌려도 프레임을 다시 잡는다 — 카메라를 만지기 전까지는", async ({
  page,
}) => {
  await page.goto("/starchart");
  await expect(page.locator("[data-body-id]")).toHaveCount(22, {
    timeout: 30_000,
  });

  await page.setViewportSize({ width: 844, height: 390 }); // 가로로 돌린다
  await expect.poll(() => bodiesOutsideFrame(page)).toEqual([]);

  await page.setViewportSize({ width: 390, height: 844 }); // 다시 세로로
  await expect.poll(() => bodiesOutsideFrame(page)).toEqual([]);
});


// ── 적응 규칙 2·3·4 (#51) ────────────────────────────────────────────────────

/**
 * 행성 뷰까지 들어간다.
 *
 * 데스크톱 스펙과 달리 이름표를 누르지 않고 클릭 이벤트를 직접 보낸다 — 폰 폭의
 * 성계 뷰는 천체 이름표끼리 붙어 서로를 가려서(지구 이름표 위에 루아 이름표가
 * 겹친다) 이름표를 겨냥하는 길이 막힌다. 그 겹침은 이름표 배치의 문제이고
 * (지도를 탭으로 쓰는 길은 천체 히트 영역이 따로 낸다), 여기서 볼 것은 행성 뷰에
 * 들어간 다음의 화면이다.
 */
async function focusEarth(page: import("@playwright/test").Page) {
  await openStarchart(page);
  await page.locator("[data-body-id='Earth']").dispatchEvent("click");
  // 노드 라벨 21개는 DOM 포털이라 한 프레임에 다 서지 않는다
  await expect(nodeLabels(page)).toHaveCount(EARTH_NODE_COUNT, {
    timeout: 30_000,
  });
  await waitForCameraRest(page);
}

test("세로 화면에서 행성 뷰의 노드도 프레임 안에 들어온다", async ({ page }) => {
  await focusEarth(page);
  const outside = await nodeLabels(page).evaluateAll((elements) =>
    elements
      .filter((element) => {
        const box = element.getBoundingClientRect();
        return (
          box.left < 0 ||
          box.right > window.innerWidth ||
          box.top < 0 ||
          box.bottom > window.innerHeight
        );
      })
      .map((element) => (element as HTMLElement).dataset.nodeId),
  );
  expect(outside).toEqual([]);
});

// 적응 규칙 2 — 호버 의존 금지. 손가락에는 호버가 없으므로, 탭 한 번으로
// 노드의 모든 정보(이름·상태·미션 정보·완료 체크)에 닿아야 한다.
test("탭 한 번으로 노드 상세에 닿는다 — 호버가 필요 없다", async ({ page }) => {
  await focusEarth(page);

  await nodeLabel(page, "SolNode89").tap();

  // 노드가 가진 정보가 전부 여기 있다 — 이름·상태·미션 정보·완료 조작
  const detail = page.locator("[data-selected-node='SolNode89']");
  await expect(detail.getByRole("heading", { name: "Mariana" })).toBeVisible();
  await expect(detail.getByText("미션")).toBeVisible();
  await expect(detail.getByText("팩션")).toBeVisible();
  await expect(detail.getByText("적 레벨")).toBeVisible();
  await expect(detail.getByRole("checkbox")).toBeVisible();
});

// 적응 규칙 3 — 탭 타깃. 마름모는 화면에서 8~19px이라 그것만으로는 손가락이
// 겨냥할 수 없다. 실제로 눌리는 것은 마름모를 감싼 히트 구체다(스펙 §8-3).
// 어느 크기까지 커지는지는 단위 테스트(src/starchart/tap-target.test.ts)가 본다.
test("마름모 바깥을 탭해도 노드가 선택된다", async ({ page }) => {
  // 두비리는 노드가 셋뿐이라 히트 영역이 44px을 그대로 채우는 구름이다
  await openStarchart(page);
  await page.locator("[data-body-id='Duviri']").dispatchEvent("click");
  await expect(nodeLabels(page)).toHaveCount(3, { timeout: 30_000 });
  await waitForCameraRest(page);

  const label = nodeLabels(page).first();
  const id = await label.getAttribute("data-node-id");
  const box = (await label.boundingBox())!;
  // 이름표는 마름모보다 24px 위에 뜬다(월드 좌표로 NODE_RADIUS × 2.5). 그래서
  // 이름표 중심에서 오른쪽 16px·아래 14px은 마름모 중심에서 19px 떨어진 점 —
  // 마름모(지름 19px)의 바깥이고 이름표 상자의 아래다. 그래도 눌려야 한다.
  await page.touchscreen.tap(box.x + box.width / 2 + 16, box.y + box.height / 2 + 14);

  await expect(page.locator(`[data-selected-node='${id}']`)).toBeVisible();
});

/** 활성 균열 목록을 여닫는 탭 — 지도 위의 균열 심볼도 같은 이름을 쓴다. */
const fissureTab = (page: import("@playwright/test").Page) =>
  page.locator("[data-hud='fissure-tab']");

/**
 * 화면에 자리를 차지하고 있는 HUD 조각들의 사각형.
 *
 * `data-hud`는 눈에 보이는 조각에 붙는다 — 균열 탭처럼 접힌 버튼과 펼친 목록이
 * 떨어져 서는 것은 둘로 나눠 붙었고, 투명한 배치용 상자에는 붙지 않는다.
 * 예외는 행성 뷰 HUD다: 좁은 폭에서 그 열이 통째로 한 띠를 차지하므로 열 전체를
 * 하나로 본다.
 */
async function hudBoxes(page: import("@playwright/test").Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("[data-hud]")]
      .map((element) => {
        const box = element.getBoundingClientRect();
        return {
          name: element.dataset.hud!,
          left: box.left,
          top: box.top,
          right: box.right,
          bottom: box.bottom,
        };
      })
      .filter((box) => box.right > box.left && box.bottom > box.top),
  );
}

/** 서로 겹치는 조각 쌍의 이름. 비어 있어야 적응 규칙 4를 지킨 것이다. */
function overlappingPairs(boxes: Awaited<ReturnType<typeof hudBoxes>>) {
  const pairs: string[] = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) {
        pairs.push(`${a.name}↔${b.name}`);
      }
    }
  }
  return pairs;
}

// 적응 규칙 4 — 좁은 폭(360~430px)에서 HUD 요소 겹침 금지(스펙 §8-4).
// 스펙이 말하는 양 끝과 그 사이를 본다.
for (const width of [360, 390, 430]) {
  test(`${width}px 폭에서 성계 뷰 HUD가 겹치지 않는다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 780 });
    await openStarchart(page);
    // 균열 목록은 접혀 있는 것이 기본이다 — 펼친 상태가 가장 넓게 차지한다
    await fissureTab(page).click();

    expect(overlappingPairs(await hudBoxes(page))).toEqual([]);
  });

  test(`${width}px 폭에서 행성 뷰 HUD가 겹치지 않는다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 780 });
    await focusEarth(page);
    // 가장 많은 것이 떠 있는 상태 — 행성 가이드 · 노드 상세 · 균열 목록
    await nodeLabel(page, "SolNode89").tap();
    await fissureTab(page).click();
    await expect(page.locator("[data-selected-node='SolNode89']")).toBeVisible();

    expect(overlappingPairs(await hudBoxes(page))).toEqual([]);
  });
}
