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
import type { WorldState } from "../src/worldstate/schema";

export { expect, type Page } from "@playwright/test";

/**
 * 월드스테이트가 살아 있고 알릴 것이 없는 스냅숏 — 상인 없음, 주기 없음, 균열
 * 0건. 균열이 `null`(섹션을 못 받음)이 아니라 `[]`인 것이 요점이다: 여기서는
 * 폴백이 아니라 조용한 하루를 흉내 낸다.
 */
export const emptyWorldstate = (): WorldState => ({
  voidTrader: null,
  cycles: [],
  fissures: [],
  fetchedAt: Date.now(),
  stale: false,
});

export const test = base.extend<{ worldstate: void }>({
  worldstate: [
    async ({ page }, use) => {
      await page.route("**/api/worldstate", (route) =>
        route.fulfill({ json: emptyWorldstate() }),
      );
      await use();
    },
    { auto: true },
  ],
});
