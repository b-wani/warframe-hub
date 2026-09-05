/**
 * 스펙이 `@playwright/test` 대신 임포트하는 `test` — 모든 테스트에서 월드스테이트를
 * 우리가 정한 스냅숏으로 고정한다.
 *
 * 프로덕션 서버는 `/api/worldstate`로 실제 외부 API를 받아오므로, 그대로 두면
 * e2e 결과가 그날 어느 노드에 균열이 열렸는지에 매달린다(균열이 열린 노드에는
 * 심볼 라벨이 하나 더 붙는다). 게이트는 결정적이어야 한다 — 어제 초록이던 것이
 * 오늘 이유 없이 빨개지면 "또 flaky"로 넘기게 되고, 그 순간 게이트는 신호를 잃는다.
 *
 * 기본은 빈 스냅숏이다. 균열 스펙처럼 자기 스냅숏이 필요한 테스트는 `page.route`를
 * 한 번 더 등록한다 — 나중에 등록한 라우트가 먼저 잡힌다.
 */
import { test as base } from "@playwright/test";

export { expect, type Page } from "@playwright/test";

/** 월드스테이트 어댑터의 빈 응답 — 상인 없음, 주기 없음, 균열 없음. */
export const EMPTY_WORLDSTATE = { voidTrader: null, cycles: [], fissures: [] };

export const test = base.extend<{ worldstate: void }>({
  worldstate: [
    async ({ page }, use) => {
      await page.route("**/api/worldstate", (route) =>
        route.fulfill({ json: EMPTY_WORLDSTATE }),
      );
      await use();
    },
    { auto: true },
  ],
});
