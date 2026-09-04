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
 * 노드 하나를 id로 집는다. 이름으로 찾으면 균열이 열린 노드에서 심볼의
 * aria-label("보이드 균열 리스 — Mariana")까지 걸려 두 개가 잡힌다 — 실제
 * 월드스테이트를 쓰는 테스트라 그날 균열이 어디 열렸는지에 결과가 매달린다.
 */
const nodeLabel = (page: Page, id: string) =>
  page.locator(`[data-node-id="${id}"]`);

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
  await expect(nodeLabel(page, "SolNode27")).toBeVisible();

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

  await nodeLabel(page, "SolNode89").click();
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
  await nodeLabel(page, "SolNode89").click();
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

const nodeIdsOf = (groupId: string) =>
  Object.entries(dataset.nodes)
    .filter(([, node]) => node.group === groupId)
    .map(([id]) => id);

const EARTH_NODE_IDS = nodeIdsOf("Earth");
const EARTH_PROXIMA_NODE_IDS = nodeIdsOf("Earth_SPACE");

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
  // 저장 검증을 새로고침으로 하느라 openEarth(≈10초)를 두 번 부르는 유일한 테스트 —
  // CI 러너에서 기본 30초 예산을 초과한다
  test.slow();
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
  // 지구는 프록시마가 종속된 행성이라 고리까지 채워야 천체가 완료다(스펙 §4.2)
  await seedProgress(page, [...EARTH_NODE_IDS, ...EARTH_PROXIMA_NODE_IDS]);
  await openStarchart(page);

  const earth = page.locator("[data-body-id='Earth']");
  await expect(earth).toHaveAttribute("data-state", "complete");
  await expect(earth).toContainText("✓");
  // 아직 아무것도 안 한 행성은 그대로다
  await expect(page.locator("[data-body-id='Mars']")).not.toHaveAttribute(
    "data-state",
  );
});

// ─── 진행도 가져오기 (#44) ───────────────────────────────────────────────────
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

const storedProgress = (page: Page) =>
  page.evaluate(
    (key) => window.localStorage.getItem(key),
    STARCHART_PROGRESS_STORAGE_KEY,
  );

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

test("계정 ID를 넣으면 앱이 조립한 프로필 URL이 새 탭으로 열린다", async ({
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

test("붙여넣기 한 번이 미리보기를 거쳐 합집합으로 저장까지 간다", async ({
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

// ─── 폴백 뷰 (#45) ───────────────────────────────────────────────────────────
// 목록의 내용과 파생 3상태는 단위 테스트(src/starchart/fallback.test.ts,
// src/app/starchart/fallback-view.test.tsx)가, 어느 뷰를 띄우는지의 규칙은
// src/app/starchart/starchart-view.test.tsx가 본다. 여기서는 브라우저에서만
// 확인되는 것 — WebGL이 정말 없을 때 자동으로 뜨는가, 3D와 같은 진행도인가.

const earthAccordion = (page: Page) => page.locator("[data-group-id='Earth']");

/** WebGL을 못 얻는 브라우저인 척한다 — 확장·설정으로 실제로 벌어지는 일이다. */
async function blockWebgl(page: Page) {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...rest: unknown[]
    ) {
      if (type.startsWith("webgl")) return null;
      return (original as (...args: unknown[]) => unknown).call(
        this,
        type,
        ...rest,
      );
    } as typeof original;
  });
}

/** 폴백 뷰에서 지구 아코디언을 펼친다. */
async function openEarthAccordion(page: Page) {
  await expect(earthAccordion(page)).toBeVisible();
  await earthAccordion(page).locator("summary").click();
}

test("WebGL을 못 쓰면 폴백 뷰가 자동으로 뜬다", async ({ page }) => {
  await blockWebgl(page);
  await page.goto("/starchart");

  await expect(page.getByText(/3D를 렌더할 수 없어/)).toBeVisible();
  await expect(earthAccordion(page)).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
  // 3D를 띄울 수 없는 환경에 3D로 가는 버튼을 두지 않는다
  await expect(page.getByRole("button", { name: "3D로 보기" })).toHaveCount(0);

  // 진행도 조작은 3D 없이도 그대로 있다
  await expect(
    page.getByRole("button", { name: "진행도 가져오기" }).first(),
  ).toBeVisible();
});

test("3D 환경에서도 목록으로 수동 전환하고 되돌아올 수 있다", async ({ page }) => {
  await openStarchart(page);

  await page.getByRole("button", { name: "목록으로 보기" }).click();
  await expect(earthAccordion(page)).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);

  await page.getByRole("button", { name: "3D로 보기" }).click();
  await expect(labels(page)).toHaveCount(BODY_COUNT, { timeout: 30_000 });
  await expect(earthAccordion(page)).toHaveCount(0);
});

test("폴백 뷰의 완료 체크가 3D 뷰와 같은 완료 집합에 반영된다", async ({
  page,
}) => {
  // 두 뷰를 오가며 성계지도를 두 번 세운다 — CI 러너에서 기본 30초 예산을 넘긴다
  test.slow();
  await openStarchart(page);
  await page.getByRole("button", { name: "목록으로 보기" }).click();
  await openEarthAccordion(page);

  const ePrime = earthAccordion(page).getByRole("checkbox", {
    name: /E Prime/,
  });
  await expect(ePrime).not.toBeChecked();
  await ePrime.check();

  // 같은 저장소에 남는다
  expect(JSON.parse((await storedProgress(page))!).completedIds).toEqual([
    "SolNode27",
  ]);
  // 파생 상태도 함께 간다 — 다음 노드가 목록에서 열린다
  await expect(
    earthAccordion(page).locator("[data-node-id='SolNode89']"),
  ).toHaveAttribute("data-state", "uncleared");

  // 3D로 돌아가면 같은 사실을 지도가 말한다
  await page.getByRole("button", { name: "3D로 보기" }).click();
  await page.getByRole("button", { name: "지구", exact: true }).click();
  await expect(nodeLabels(page)).toHaveCount(EARTH_NODE_COUNT);
  await expect(nodeLabel(page, "SolNode27")).toHaveAttribute(
    "data-state",
    "cleared",
  );
});

// ─── 구간 일괄 체크 (#46) ────────────────────────────────────────────────────
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

// ─── 보이드 균열 오버레이 (#47) ──────────────────────────────────────────────
// 어떤 균열을 어느 노드로 해석하는지는 단위 테스트(src/starchart/fissures.test.ts)가,
// 어댑터의 섹션 규약은 src/worldstate/*.test.ts가 본다. 여기서는 브라우저에서만
// 확인되는 것 — 심볼이 지도에 뜨는가, 목록에서 고르면 그 노드까지 날아가는가,
// 월드스테이트가 죽어도 지도가 서는가.

/** 월드스테이트 라우트를 우리가 정한 스냅숏으로 바꿔치기한다. */
async function withFissures(page: Page) {
  await page.route("**/api/worldstate", async (route) => {
    const now = Date.now();
    await route.fulfill({
      json: {
        voidTrader: null,
        cycles: [],
        fissures: [
          {
            nodeKey: "E Prime (Earth)",
            nodeName: "E Prime",
            tier: "Lith",
            activationAt: now - 60_000,
            expiryAt: now + 40 * 60_000,
            hard: false,
          },
          {
            nodeKey: "Mariana (Earth)",
            nodeName: "Mariana",
            tier: "Axi",
            activationAt: now - 60_000,
            expiryAt: now + 20 * 60_000,
            hard: false,
          },
        ],
        fetchedAt: now,
        stale: false,
      },
    });
  });
}

test("활성 균열이 목록 탭에 로테이션 순서로 뜬다", async ({ page }) => {
  await withFissures(page);
  await openStarchart(page);

  await page.getByRole("button", { name: "보이드 균열 2" }).click();
  const items = page.locator("[data-fissure-node]");
  await expect(items).toHaveCount(2);
  // 리스가 액시보다 앞이다 — 정렬은 로테이션 순서다
  await expect(items.first()).toHaveAttribute("data-fissure-tier", "Lith");
  await expect(items.first()).toContainText("E Prime");
  await expect(items.first()).toContainText("지구");
});

test("목록에서 균열을 고르면 그 노드까지 연속 비행한다", async ({ page }) => {
  await withFissures(page);
  await openStarchart(page);
  await recordFrames(page, "Earth");

  await page.getByRole("button", { name: "보이드 균열 2" }).click();
  await page.locator("[data-fissure-node='SolNode89']").click();

  // 행성 뷰에 들면서 그 노드가 골라져 있다 — 상세가 이미 열려 있다
  await expect(page.locator("[data-focus-body='Earth']")).toBeVisible();
  await expect(
    page
      .locator("[data-selected-node='SolNode89']")
      .getByRole("heading", { name: "Mariana" }),
  ).toBeVisible();

  // 컷이 아니라 비행이다 — 지나온 자리가 여러 군데 남는다
  await waitForCameraRest(page);
  expect(await distinctFrames(page)).toBeGreaterThan(5);
});

test("균열이 있는 노드에는 지도에도 로테이션 심볼이 얹힌다", async ({ page }) => {
  await withFissures(page);
  await openStarchart(page);

  await page.getByRole("button", { name: "지구", exact: true }).click();
  await expect(nodeLabels(page)).toHaveCount(EARTH_NODE_COUNT);
  await waitForCameraRest(page);

  const symbol = page.getByRole("button", { name: /보이드 균열 리스 — E Prime/ });
  await expect(symbol).toBeVisible();
  // 심볼도 손잡이다 — 누르면 그 노드의 상세가 열린다
  await symbol.click();
  await expect(page.locator("[data-selected-node='SolNode27']")).toBeVisible();
});

test("월드스테이트가 죽어도 지도·진행도는 온전하고 균열만 빠진다", async ({
  page,
}) => {
  await page.route("**/api/worldstate", (route) => route.abort());
  await openStarchart(page);

  // 지도는 그대로다 — 천체도, 행성 뷰도, 완료 체크도 월드스테이트와 무관하다
  await page.getByRole("button", { name: "지구", exact: true }).click();
  await expect(nodeLabels(page)).toHaveCount(EARTH_NODE_COUNT);
  await waitForCameraRest(page);
  await page.getByRole("button", { name: "E Prime" }).click();
  await page
    .locator("[data-selected-node='SolNode27']")
    .getByRole("checkbox", { name: "완료" })
    .check();
  await expect(
    page.locator("[data-node-id='SolNode27']"),
  ).toHaveAttribute("data-state", "cleared");

  // 균열만 빠지고, 그 사실을 목록 탭이 말한다
  await expect(page.locator("[data-fissure-node]")).toHaveCount(0);
  await page.getByRole("button", { name: "보이드 균열" }).click();
  await expect(page.getByText(/월드스테이트를 받지 못해/)).toBeVisible();
});

// ─── 프록시마 ⚓ 토글 (#48) ───────────────────────────────────────────────────
// 고리를 어디에 놓는지와 천체 완료 집계는 단위 테스트(src/starchart/proxima.test.ts)
// 가 본다. 여기서는 브라우저에서만 확인되는 것 — 토글이 어느 행성에 뜨는가,
// 누르면 정말 갈아 끼워지는가, 고리의 노드도 같은 조작을 받는가.

const EARTH_PROXIMA_NODE_COUNT = EARTH_PROXIMA_NODE_IDS.length; // 7

/** ⚓ 토글. 이름으로 찾으면 "프록시마 전체 완료"와 겹치므로 자리로 찾는다. */
const proximaToggle = (page: Page) => page.locator("[data-proxima-toggle]");

test("프록시마가 있는 행성에만 ⚓ 토글이 뜬다", async ({ page }) => {
  await openEarth(page);
  // 손잡이는 버튼이고, 켜졌는지는 글로도 읽힌다(aria-pressed)
  await expect(
    page.getByRole("button", { name: "프록시마", exact: true }),
  ).toBeVisible();
  await expect(proximaToggle(page)).toHaveAttribute("aria-pressed", "false");

  // 수성에는 프록시마 그룹이 없다 — 토글할 것이 없으면 버튼도 없다
  await page.getByRole("button", { name: "← 성계로" }).click();
  await expect(page.locator("[data-focus-body]")).toHaveCount(0);
  await waitForCameraRest(page);
  await page.locator("[data-body-id='Mercury']").click();
  await expect(page.locator("[data-focus-body='Mercury']")).toBeVisible();
  await expect(proximaToggle(page)).toHaveCount(0);
});

test("토글이 노드 구름과 행성 바깥 고리를 갈아 끼운다", async ({ page }) => {
  await openEarth(page);
  await recordFrames(page, "Earth");

  await proximaToggle(page).click();

  // 노드 구름 대신 프록시마 고리가 뜬다 — 행성 뷰에서 나가지는 않는다
  await expect(nodeLabels(page)).toHaveCount(EARTH_PROXIMA_NODE_COUNT);
  await expect(page.locator("[data-focus-group='Earth_SPACE']")).toContainText(
    "지구 프록시마",
  );
  await expect(proximaToggle(page)).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-focus-body='Earth']")).toBeVisible();
  await expect(nodeLabel(page, "CrewBattleNode502")).toBeVisible();

  // 고리까지 가는 것도 컷이 아니라 비행이다(스펙 §2.1)
  await waitForCameraRest(page);
  expect(await distinctFrames(page)).toBeGreaterThan(5);

  // 되돌리면 일반 노드 구름으로 복귀한다
  await proximaToggle(page).click();
  await expect(nodeLabels(page)).toHaveCount(EARTH_NODE_COUNT);
  await expect(page.locator("[data-focus-group='Earth']")).toContainText("지구");
  await expect(proximaToggle(page)).toHaveAttribute("aria-pressed", "false");
});

test("프록시마 노드도 3상태·상세·완료 체크가 같다", async ({ page }) => {
  await openEarth(page);
  await proximaToggle(page).click();
  await expect(nodeLabels(page)).toHaveCount(EARTH_PROXIMA_NODE_COUNT);
  await waitForCameraRest(page);

  // 진입 노드만 열려 있고 그 다음은 잠겨 있다 — 같은 파생 규칙이다
  await expect(nodeLabel(page, "CrewBattleNode502")).toHaveAttribute(
    "data-state",
    "uncleared",
  );
  const next = nodeLabel(page, "CrewBattleNode509");
  await expect(next).toHaveAttribute("data-state", "locked");
  await expect(next).toContainText("🔒");

  await nodeLabel(page, "CrewBattleNode502").click();
  const detail = page.locator("[data-selected-node='CrewBattleNode502']");
  await expect(detail).toContainText("Sover Strait");
  await expect(detail).toHaveAttribute("data-node-state", "uncleared");

  await detail.getByRole("checkbox", { name: "완료" }).check();
  await expect(nodeLabel(page, "CrewBattleNode502")).toHaveAttribute(
    "data-state",
    "cleared",
  );
  // 다음 노드가 함께 열린다 — 고리에서도 3상태는 파생값이다
  await expect(next).toHaveAttribute("data-state", "uncleared");
});

test("프록시마가 남아 있으면 행성 완료 아이콘이 뜨지 않는다", async ({ page }) => {
  // 행성 노드는 전부 완료, 프록시마는 손대지 않은 상태
  await seedProgress(page, EARTH_NODE_IDS);
  await openStarchart(page);
  await expect(page.locator("[data-body-id='Earth']")).not.toHaveAttribute(
    "data-state",
  );

  // 프록시마 쪽 HUD는 그 그룹의 일괄 체크를 내놓는다 — 그것까지 채우면 완료다
  await page.getByRole("button", { name: "지구", exact: true }).click();
  await expect(page.locator("[data-focus-body='Earth']")).toBeVisible();
  await proximaToggle(page).click();
  await page.getByRole("button", { name: "프록시마 전체 완료" }).click();
  await page
    .getByRole("button", { name: new RegExp(`${EARTH_PROXIMA_NODE_COUNT}개 완료`) })
    .click();

  await page.getByRole("button", { name: "← 성계로" }).click();
  const earth = page.locator("[data-body-id='Earth']");
  await expect(earth).toHaveAttribute("data-state", "complete");
  await expect(earth).toContainText("✓");
});
