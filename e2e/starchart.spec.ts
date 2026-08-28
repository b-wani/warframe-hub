import { expect, test, type Page } from "@playwright/test";
import dataset from "../src/data/starchart.json";
import { STARCHART_PROGRESS_STORAGE_KEY } from "../src/starchart/progress-repository";

// 성계 뷰의 수용 기준 중 브라우저에서만 확인되는 것들 — 3D가 실제로 뜨는가,
// 서버 렌더에 3D가 안 들어가는가, 카메라 조작이 되는가.
// 어떤 천체를 어디에 놓는지는 단위 테스트(src/starchart/bodies.test.ts)가 본다.

const BODY_COUNT = 22; // 행성/위성 17 + 특수 구역 5

const labels = (page: Page) => page.locator("[data-body-id]");

async function openStarchart(page: Page) {
  await page.goto("/starchart");
  await expect(labels(page)).toHaveCount(BODY_COUNT, { timeout: 30_000 });
}

/** 라벨의 화면 위치 — 카메라가 움직였는지 보는 관찰 지점. */
async function labelPositions(page: Page): Promise<number[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll("[data-body-id]")].flatMap((element) => {
      const { x, y } = element.getBoundingClientRect();
      return [Math.round(x), Math.round(y)];
    }),
  );
}

test("성계 뷰에 행성/위성 17 + 특수 구역 5가 렌더된다", async ({ page }) => {
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

test("서버 렌더에 3D가 들어가지 않는다", async ({ page, baseURL }) => {
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

test("카메라 궤도·줌이 동작한다", async ({ page }) => {
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

// ─── 행성 뷰와 연속 비행 (#42) ───────────────────────────────────────────────
// 어떤 노드를 어디에 놓는지는 단위 테스트(src/starchart/node-cloud.test.ts)가,
// 무엇이 프레임에 들어오는지는 src/starchart/camera.test.ts가 본다. 여기서는
// 브라우저에서만 확인되는 것 — 전환이 컷이 아니라 비행인가, 노드가 눌리는가.

const EARTH_NODE_COUNT = 21;

const nodeLabels = (page: Page) => page.locator("[data-node-id]");

/**
 * 카메라가 움직이는 동안의 프레임을 모은다. 컷이면 두 자리만 남고, 연속
 * 비행이면 그 사이의 자리가 잔뜩 남는다.
 */
async function recordFrames(page: Page, bodyId: string) {
  await page.evaluate((id) => {
    const seen: string[] = [];
    (window as unknown as { __frames: string[] }).__frames = seen;
    const tick = () => {
      const element = document.querySelector(`[data-body-id="${id}"]`);
      if (element) {
        const { x, y } = element.getBoundingClientRect();
        seen.push(`${Math.round(x)},${Math.round(y)}`);
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, bodyId);
}

const distinctFrames = (page: Page) =>
  page.evaluate(
    () =>
      new Set((window as unknown as { __frames: string[] }).__frames).size,
  );

/** 카메라 보간이 끝날 때까지 — 연속된 두 표본이 같아질 때까지 기다린다. */
async function waitForCameraRest(page: Page) {
  let previous = "";
  await expect
    .poll(
      async () => {
        const current = (await labelPositions(page)).join();
        const settled = current === previous;
        previous = current;
        return settled;
      },
      { timeout: 15_000 },
    )
    .toBe(true);
}

test("행성을 고르면 컷 없이 연속 비행으로 행성 뷰에 든다", async ({ page }) => {
  await openStarchart(page);
  await recordFrames(page, "Earth");

  await page.getByRole("button", { name: "지구", exact: true }).click();

  await expect(page.locator("[data-focus-body='Earth']")).toBeVisible();
  await expect(nodeLabels(page)).toHaveCount(EARTH_NODE_COUNT);
  await expect(page.getByRole("button", { name: "E Prime" })).toBeVisible();

  // 카메라가 멈출 때까지 기다린 뒤, 지나온 자리가 몇 군데였는지 센다
  await waitForCameraRest(page);
  expect(await distinctFrames(page)).toBeGreaterThan(5);
});

test("행성 뷰에서 노드를 고르면 표시된다", async ({ page }) => {
  await openStarchart(page);
  await page.getByRole("button", { name: "지구", exact: true }).click();
  await expect(nodeLabels(page)).toHaveCount(EARTH_NODE_COUNT);
  // 라벨은 비행이 끝나야 제자리에 선다 — 움직이는 동안 누르면 옆 라벨이 맞는다
  await waitForCameraRest(page);

  await page.getByRole("button", { name: "Mariana" }).click();
  await expect(
    page
      .locator("[data-selected-node='SolNode89']")
      .getByRole("heading", { name: "Mariana" }),
  ).toBeVisible();

  // 빈 곳을 누르면 선택만 풀리고 행성 뷰는 그대로다
  await page.mouse.click(4, 400);
  await expect(page.locator("[data-selected-node]")).toHaveCount(0);
  await expect(page.locator("[data-focus-body='Earth']")).toBeVisible();
});

test("성계 뷰로 되돌아가는 것도 같은 연속 비행이다", async ({ page }) => {
  await openStarchart(page);
  await page.getByRole("button", { name: "지구", exact: true }).click();
  await expect(nodeLabels(page)).toHaveCount(EARTH_NODE_COUNT);
  await waitForCameraRest(page);

  await recordFrames(page, "Earth");
  await page.getByRole("button", { name: "← 성계로" }).click();

  await expect(page.locator("[data-focus-body]")).toHaveCount(0);
  // 노드 라벨은 행성 뷰의 것이다 — 성계 뷰로 돌아오면 사라진다
  await expect(nodeLabels(page)).toHaveCount(0);
  expect(await distinctFrames(page)).toBeGreaterThan(5);
});

test("ESC로 선택과 행성 뷰를 차례로 빠져나온다", async ({ page }) => {
  await openStarchart(page);
  await page.getByRole("button", { name: "지구", exact: true }).click();
  await expect(nodeLabels(page)).toHaveCount(EARTH_NODE_COUNT);
  await waitForCameraRest(page);
  await page.getByRole("button", { name: "Mariana" }).click();
  await expect(page.locator("[data-selected-node]")).toHaveCount(1);

  await page.keyboard.press("Escape");
  await expect(page.locator("[data-selected-node]")).toHaveCount(0);
  await expect(page.locator("[data-focus-body='Earth']")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.locator("[data-focus-body]")).toHaveCount(0);
});

// ─── 노드 3상태·상세·개별 체크 (#43) ─────────────────────────────────────────
// 파생 3상태 자체는 단위 테스트(src/starchart/progress.test.ts)가, 상세 패널의
// 내용은 src/app/starchart/node-detail-panel.test.tsx가 본다. 여기서는 브라우저
// 에서만 확인되는 것 — 토글 하나가 저장·파생·지도까지 정말 끌고 가는가.

const EARTH_NODE_IDS = Object.entries(dataset.nodes)
  .filter(([, node]) => node.group === "Earth")
  .map(([id]) => id);

const nodeLabel = (page: Page, id: string) =>
  page.locator(`[data-node-id="${id}"]`);

/** 저장된 진행도를 심고 시작한다 — 행성 하나를 다 미는 데 21번을 누르지 않는다. */
async function seedProgress(page: Page, completedIds: string[]) {
  await page.addInitScript(
    ({ key, ids }) => {
      window.localStorage.setItem(
        key,
        JSON.stringify({ version: 2, completedIds: ids }),
      );
    },
    { key: STARCHART_PROGRESS_STORAGE_KEY, ids: completedIds },
  );
}

async function openEarth(page: Page) {
  await openStarchart(page);
  await page.getByRole("button", { name: "지구", exact: true }).click();
  await expect(nodeLabels(page)).toHaveCount(EARTH_NODE_COUNT);
  await waitForCameraRest(page);
}

test("노드가 3상태로 갈려 표시된다 — 잠긴 노드에는 자물쇠가 붙는다", async ({
  page,
}) => {
  await openEarth(page);

  // 진행도가 비어 있으면 진입 노드만 열려 있다
  await expect(nodeLabel(page, "SolNode27")).toHaveAttribute(
    "data-state",
    "uncleared",
  );
  const mariana = nodeLabel(page, "SolNode89");
  await expect(mariana).toHaveAttribute("data-state", "locked");
  await expect(mariana).toContainText("🔒");
});

test("완료 토글이 저장·파생 상태·지도를 한 번에 끌고 간다", async ({ page }) => {
  await openEarth(page);

  await nodeLabel(page, "SolNode27").click();
  const detail = page.locator("[data-selected-node='SolNode27']");
  await expect(detail).toHaveAttribute("data-node-state", "uncleared");
  // 표시명·미션 유형·팩션·레벨 범위가 상세에 다 있다
  await expect(detail).toContainText("E Prime");
  await expect(detail).toContainText("섬멸");
  await expect(detail).toContainText("그리니어");
  await expect(detail).toContainText("1–3");

  await detail.getByRole("checkbox", { name: "완료" }).check();

  await expect(detail).toHaveAttribute("data-node-state", "cleared");
  await expect(nodeLabel(page, "SolNode27")).toHaveAttribute(
    "data-state",
    "cleared",
  );
  // 다음 노드가 함께 열린다 — 3상태는 저장값이 아니라 파생값이다
  await expect(nodeLabel(page, "SolNode89")).toHaveAttribute(
    "data-state",
    "uncleared",
  );

  // 저장까지 갔는지는 새로고침이 말해 준다
  await openEarth(page);
  await expect(nodeLabel(page, "SolNode27")).toHaveAttribute(
    "data-state",
    "cleared",
  );
});

test("교차점은 상세에서도 구별된다", async ({ page }) => {
  await openEarth(page);

  await nodeLabel(page, "EarthToVenusJunction").click();
  const detail = page.locator("[data-selected-node='EarthToVenusJunction']");
  await expect(detail).toContainText("금성 교차점");
  await expect(detail).toContainText("교차점");
});

test("호버 없이 탭만으로 노드 정보에 닿는다", async ({ page }) => {
  await openEarth(page);

  // 포인터를 올리지 않고 탭만 보낸다 — 호버에만 기대는 정보가 있으면 안 된다
  await nodeLabel(page, "SolNode27").dispatchEvent("click");
  await expect(page.locator("[data-selected-node='SolNode27']")).toBeVisible();
});

test("행성 전체 클리어면 성계 뷰의 그 행성에 완료 아이콘이 뜬다", async ({
  page,
}) => {
  await seedProgress(page, EARTH_NODE_IDS);
  await openStarchart(page);

  const earth = page.locator("[data-body-id='Earth']");
  await expect(earth).toHaveAttribute("data-state", "complete");
  await expect(earth).toContainText("✓");
  // 아직 아무것도 안 한 행성은 그대로다
  await expect(page.locator("[data-body-id='Mars']")).not.toHaveAttribute(
    "data-state",
  );
});
