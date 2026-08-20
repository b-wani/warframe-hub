import { describe, expect, it } from "vitest";
import cetusCycle from "./fixtures/cetus-cycle.json";
import earthCycle from "./fixtures/earth-cycle.json";
import voidTrader from "./fixtures/void-trader.json";
import { emptyWorldState, toWorldState } from "./adapter";

const fetchedAt = Date.parse("2026-08-20T10:24:00.000Z");
const realResponse = { voidTrader, earthCycle, cetusCycle };

describe("toWorldState", () => {
  it("실제 응답 픽스처를 내부 타입으로 변환한다", () => {
    const state = toWorldState(realResponse, { fetchedAt });

    expect(state).toEqual({
      voidTrader: {
        character: "Baro Ki'Teer",
        location: "Orcus Relay (Pluto)",
        activationAt: Date.parse("2026-08-21T13:00:00.000Z"),
        expiryAt: Date.parse("2026-08-23T13:00:00.000Z"),
      },
      cycles: [
        { region: "earth", isDay: true, expiryAt: Date.parse(earthCycle.expiry) },
        {
          region: "cetus",
          isDay: false,
          expiryAt: Date.parse(cetusCycle.expiry),
        },
      ],
      fetchedAt,
      stale: false,
    });
  });

  it("필드가 누락된 섹션만 떨어뜨리고 나머지는 살린다", () => {
    const state = toWorldState(
      {
        voidTrader: { character: "Baro Ki'Teer" },
        earthCycle: { ...earthCycle, expiry: "언젠가" },
        cetusCycle,
      },
      { fetchedAt },
    );

    expect(state.voidTrader).toBeNull();
    expect(state.cycles).toEqual([
      { region: "cetus", isDay: false, expiryAt: Date.parse(cetusCycle.expiry) },
    ]);
  });

  it("빈 응답이면 정보 없는 스냅숏이 된다", () => {
    expect(toWorldState({}, { fetchedAt })).toEqual(
      emptyWorldState(fetchedAt),
    );
  });

  it("응답이 객체가 아니어도 던지지 않는다", () => {
    for (const raw of [null, undefined, "down", 500, []]) {
      expect(toWorldState(raw, { fetchedAt })).toEqual(
        emptyWorldState(fetchedAt),
      );
    }
  });

  it("마지막 캐시로 대체된 스냅숏은 stale로 표시된다", () => {
    const state = toWorldState(realResponse, { fetchedAt, stale: true });
    expect(state.stale).toBe(true);
  });
});
