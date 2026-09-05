import { expect, type Page } from "@playwright/test";
import dataset from "../src/data/starchart.json";
import { STARCHART_PROGRESS_STORAGE_KEY } from "../src/starchart/progress-repository";

// 스타차트 e2e 스펙들이 함께 쓰는 손잡이들. 기능별 스펙 파일은 여기서 가져다
// 쓰고, 한 파일에서만 쓰는 헬퍼는 그 파일에 남긴다.

export const BODY_COUNT = 22; // 행성/위성 17 + 특수 구역 5
export const EARTH_NODE_COUNT = 21;

export const labels = (page: Page) => page.locator("[data-body-id]");

export const nodeLabels = (page: Page) => page.locator("[data-node-id]");

/**
 * 노드 하나를 id로 집는다. 이름으로 찾으면 균열이 열린 노드에서 심볼의
 * aria-label("보이드 균열 리스 — Mariana")까지 걸려 두 개가 잡힌다 — 월드스테이트는
 * fixtures.ts가 고정하지만, 균열 스펙은 자기 스냅숏으로 균열을 열어 둔다.
 */
export const nodeLabel = (page: Page, id: string) =>
  page.locator(`[data-node-id="${id}"]`);

/**
 * 성계 뷰가 다 설 때까지 기다린다. 첫 진입은 3D 자산을 받아 오므로 느리다 —
 * 그 대기를 여기 한 자리에 둔다. 주소로 바로 들어가지 않는 경로(홈의 링크)도
 * 같은 대기를 쓴다.
 */
export async function waitForSystemView(page: Page) {
  await expect(labels(page)).toHaveCount(BODY_COUNT, { timeout: 30_000 });
}

export async function openStarchart(page: Page) {
  await page.goto("/starchart");
  await waitForSystemView(page);
}

export async function openEarth(page: Page) {
  await openStarchart(page);
  await page.getByRole("button", { name: "지구", exact: true }).click();
  await expect(nodeLabels(page)).toHaveCount(EARTH_NODE_COUNT);
  await waitForCameraRest(page);
}

/** 라벨의 화면 위치 — 카메라가 움직였는지 보는 관찰 지점. */
export async function labelPositions(page: Page): Promise<number[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll("[data-body-id]")].flatMap((element) => {
      const { x, y } = element.getBoundingClientRect();
      return [Math.round(x), Math.round(y)];
    }),
  );
}

/**
 * 카메라가 움직이는 동안의 프레임을 모은다. 컷이면 두 자리만 남고, 연속
 * 비행이면 그 사이의 자리가 잔뜩 남는다.
 */
export async function recordFrames(page: Page, bodyId: string) {
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

export const distinctFrames = (page: Page) =>
  page.evaluate(
    () => new Set((window as unknown as { __frames: string[] }).__frames).size,
  );

/** 카메라 보간이 끝날 때까지 — 연속된 두 표본이 같아질 때까지 기다린다. */
export async function waitForCameraRest(page: Page) {
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

export const nodeIdsOf = (groupId: string) =>
  Object.entries(dataset.nodes)
    .filter(([, node]) => node.group === groupId)
    .map(([id]) => id);

export const EARTH_NODE_IDS = nodeIdsOf("Earth");
export const EARTH_PROXIMA_NODE_IDS = nodeIdsOf("Earth_SPACE");

/** 저장된 진행도를 심고 시작한다 — 행성 하나를 다 미는 데 21번을 누르지 않는다. */
export async function seedProgress(page: Page, completedIds: string[]) {
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

export const storedProgress = (page: Page) =>
  page.evaluate(
    (key) => window.localStorage.getItem(key),
    STARCHART_PROGRESS_STORAGE_KEY,
  );
