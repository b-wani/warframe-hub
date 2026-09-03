import { afterEach, describe, expect, it, vi } from "vitest";
import cetusCycle from "./fixtures/cetus-cycle.json";
import earthCycle from "./fixtures/earth-cycle.json";
import fissures from "./fixtures/fissures.json";
import voidTrader from "./fixtures/void-trader.json";
import {
  WORLDSTATE_TTL_MS,
  clearWorldStateCache,
  fetchWorldState,
} from "./fetch";

const baseUrl = "https://worldstate.test/pc";
const bodies: Record<string, unknown> = {
  voidTrader,
  earthCycle,
  cetusCycle,
  fissures,
};

function okFetch() {
  return vi.fn(async (input: string | URL | Request) => {
    const path = String(input).split("/").pop()!;
    return Response.json(bodies[path]);
  });
}

/** 한 섹션만 죽은 외부 API인 척한다. */
function failing(deadPath: string) {
  return vi.fn(async (input: string | URL | Request) => {
    const path = String(input).split("/").pop()!;
    if (path === deadPath) throw new Error("timeout");
    return Response.json(bodies[path]);
  });
}

function clock(start: number) {
  let current = start;
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
    },
  };
}

afterEach(() => {
  clearWorldStateCache();
});

describe("fetchWorldState", () => {
  it("TTL 안에서는 외부 API를 다시 부르지 않는다", async () => {
    const fetch = okFetch();
    const time = clock(Date.parse("2026-08-20T10:00:00.000Z"));

    const first = await fetchWorldState({ fetch, baseUrl, now: time.now });
    time.advance(WORLDSTATE_TTL_MS - 1);
    const second = await fetchWorldState({ fetch, baseUrl, now: time.now });

    expect(fetch).toHaveBeenCalledTimes(4); // 섹션 4개 = 1회 갱신
    expect(second).toEqual(first);
  });

  it("TTL이 지나면 다시 갱신한다", async () => {
    const fetch = okFetch();
    const time = clock(Date.parse("2026-08-20T10:00:00.000Z"));

    await fetchWorldState({ fetch, baseUrl, now: time.now });
    time.advance(WORLDSTATE_TTL_MS);
    await fetchWorldState({ fetch, baseUrl, now: time.now });

    expect(fetch).toHaveBeenCalledTimes(8);
  });

  it("외부 API가 죽으면 마지막 성공 스냅숏으로 폴백한다", async () => {
    const time = clock(Date.parse("2026-08-20T10:00:00.000Z"));
    const fresh = await fetchWorldState({
      fetch: okFetch(),
      baseUrl,
      now: time.now,
    });

    time.advance(WORLDSTATE_TTL_MS);
    const down = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    const state = await fetchWorldState({ fetch: down, baseUrl, now: time.now });

    expect(state).toEqual({ ...fresh, stale: true });
  });

  it("캐시도 없이 외부 API가 죽으면 정보 없는 스냅숏이다", async () => {
    const down = vi.fn(async () => new Response("nope", { status: 503 }));
    const now = Date.parse("2026-08-20T10:00:00.000Z");

    const state = await fetchWorldState({ fetch: down, baseUrl, now: () => now });

    expect(state).toEqual({
      voidTrader: null,
      cycles: [],
      fissures: null,
      fetchedAt: now,
      stale: false,
    });
  });

  it("일부 섹션만 실패하면 마지막 성공 값으로 메우고 stale로 알린다", async () => {
    const time = clock(Date.parse("2026-08-20T10:00:00.000Z"));
    const fresh = await fetchWorldState({
      fetch: okFetch(),
      baseUrl,
      now: time.now,
    });

    time.advance(WORLDSTATE_TTL_MS);
    const partial = vi.fn(async (input: string | URL | Request) => {
      const path = String(input).split("/").pop()!;
      if (path === "voidTrader") throw new Error("timeout");
      return Response.json(bodies[path]);
    });
    const state = await fetchWorldState({
      fetch: partial,
      baseUrl,
      now: time.now,
    });

    expect(state.voidTrader).toEqual(fresh.voidTrader);
    expect(state.stale).toBe(true);
  });

  it("외부 장애 중에도 TTL 안에서는 재시도하지 않는다", async () => {
    const time = clock(Date.parse("2026-08-20T10:00:00.000Z"));
    const down = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });

    await fetchWorldState({ fetch: down, baseUrl, now: time.now });
    time.advance(WORLDSTATE_TTL_MS - 1);
    await fetchWorldState({ fetch: down, baseUrl, now: time.now });

    expect(down).toHaveBeenCalledTimes(4);
  });

  it("균열 섹션만 실패하면 마지막 성공 균열로 메우고 stale로 알린다", async () => {
    const time = clock(Date.parse("2026-08-20T10:00:00.000Z"));
    const fresh = await fetchWorldState({
      fetch: okFetch(),
      baseUrl,
      now: time.now,
    });

    time.advance(WORLDSTATE_TTL_MS);
    const state = await fetchWorldState({
      fetch: failing("fissures"),
      baseUrl,
      now: time.now,
    });

    expect(state.fissures).toEqual(fresh.fissures);
    expect(state.stale).toBe(true);
    // 실시간 항목만 잃는다 — 나머지 섹션은 이번에 받은 값 그대로다
    expect(state.voidTrader).toEqual(fresh.voidTrader);
  });

  it("캐시 없이 균열 섹션만 실패하면 균열만 빠진다", async () => {
    const now = Date.parse("2026-08-20T10:00:00.000Z");

    const state = await fetchWorldState({
      fetch: failing("fissures"),
      baseUrl,
      now: () => now,
    });

    expect(state.fissures).toBeNull();
    expect(state.cycles.map((cycle) => cycle.region)).toEqual([
      "earth",
      "cetus",
    ]);
  });

  it("캐시가 없을 때 일부 섹션만 실패하면 받은 섹션만 살린다", async () => {
    const fetch = vi.fn(async (input: string | URL | Request) => {
      const path = String(input).split("/").pop()!;
      if (path === "voidTrader") throw new Error("timeout");
      return Response.json(bodies[path]);
    });
    const now = Date.parse("2026-08-20T10:00:00.000Z");

    const state = await fetchWorldState({ fetch, baseUrl, now: () => now });

    expect(state.voidTrader).toBeNull();
    expect(state.cycles.map((c) => c.region)).toEqual(["earth", "cetus"]);
  });
});
