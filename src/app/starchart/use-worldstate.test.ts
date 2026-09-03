import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { WorldState } from "@/worldstate/schema";
import { WORLDSTATE_ENDPOINT, useWorldState } from "./use-worldstate";

const snapshot: WorldState = {
  voidTrader: null,
  cycles: [],
  fissures: [
    {
      nodeKey: "E Prime (Earth)",
      nodeName: "E Prime",
      tier: "Lith",
      activationAt: 0,
      expiryAt: 1,
      hard: false,
    },
  ],
  fetchedAt: 0,
  stale: false,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

test("서버 라우트의 스냅숏을 받아 온다", async () => {
  const fetch = vi.fn(async () => Response.json(snapshot));
  vi.stubGlobal("fetch", fetch);

  const { result } = renderHook(() => useWorldState());

  // 첫 렌더에는 아직 아무것도 없다 — 지도는 스냅숏을 기다리지 않는다
  expect(result.current).toBeNull();
  await waitFor(() => expect(result.current).toEqual(snapshot));
  expect(fetch).toHaveBeenCalledWith(WORLDSTATE_ENDPOINT, expect.anything());
});

test("월드스테이트를 못 받아도 던지지 않고 스냅숏만 없다", async () => {
  const fetch = vi.fn(async () => {
    throw new Error("offline");
  });
  vi.stubGlobal("fetch", fetch);

  const { result } = renderHook(() => useWorldState());

  await waitFor(() => expect(fetch).toHaveBeenCalled());
  expect(result.current).toBeNull();
});

test("응답이 실패 상태면 스냅숏으로 받지 않는다", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("nope", { status: 500 })),
  );

  const { result } = renderHook(() => useWorldState());

  await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
  expect(result.current).toBeNull();
});
