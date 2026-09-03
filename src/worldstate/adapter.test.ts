import { describe, expect, it } from "vitest";
import cetusCycle from "./fixtures/cetus-cycle.json";
import earthCycle from "./fixtures/earth-cycle.json";
import fissures from "./fixtures/fissures.json";
import voidTrader from "./fixtures/void-trader.json";
import { emptyWorldState, toWorldState } from "./adapter";

const fetchedAt = Date.parse("2026-08-20T10:24:00.000Z");
const realResponse = { voidTrader, earthCycle, cetusCycle, fissures };

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
      fissures: [
        {
          nodeKey: "E Gate (Venus)",
          nodeName: "E Gate",
          tier: "Lith",
          activationAt: Date.parse(fissures[0].activation),
          expiryAt: Date.parse(fissures[0].expiry),
          hard: false,
        },
        {
          nodeKey: "Oceanum (Pluto)",
          nodeName: "Oceanum",
          tier: "Axi",
          activationAt: Date.parse(fissures[1].activation),
          expiryAt: Date.parse(fissures[1].expiry),
          hard: true,
        },
        {
          nodeKey: "Yuvarium (Lua)",
          nodeName: "Yuvarium",
          tier: "Omnia",
          activationAt: Date.parse(fissures[2].activation),
          expiryAt: Date.parse(fissures[2].expiry),
          hard: true,
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

describe("toWorldState 균열 섹션", () => {
  it("알아볼 수 없는 균열 하나가 나머지를 떨어뜨리지 않는다", () => {
    const state = toWorldState(
      {
        fissures: [
          fissures[0],
          { ...fissures[1], tier: "Meme" },
          { ...fissures[2], expiry: "언젠가" },
        ],
      },
      { fetchedAt },
    );

    expect(state.fissures?.map((fissure) => fissure.nodeName)).toEqual([
      "E Gate",
    ]);
  });

  it("활성 균열이 없는 것과 섹션이 깨진 것을 구별한다", () => {
    expect(toWorldState({ fissures: [] }, { fetchedAt }).fissures).toEqual([]);
    // 배열이 아니면 이 섹션은 못 받은 것이다 — 폴백이 마지막 성공 값을 메울 수
    // 있어야 하므로 "없음"과 "0건"이 같은 값이어서는 안 된다
    expect(
      toWorldState({ fissures: { error: "boom" } }, { fetchedAt }).fissures,
    ).toBeNull();
  });

  it("노드 표시명은 원문과 행성 괄호를 뗀 이름을 함께 준다", () => {
    const state = toWorldState(
      { fissures: [{ ...fissures[0], nodeKey: "Tuvul Commons (Zariman)" }] },
      { fetchedAt },
    );

    expect(state.fissures?.[0]).toMatchObject({
      nodeKey: "Tuvul Commons (Zariman)",
      nodeName: "Tuvul Commons",
    });
  });

  it("isHard가 없는 응답은 일반 균열로 읽는다", () => {
    const { isHard, ...withoutFlag } = fissures[1];
    expect(isHard).toBe(true); // 픽스처가 실제로 그 필드를 갖고 있다는 확인

    const state = toWorldState({ fissures: [withoutFlag] }, { fetchedAt });
    expect(state.fissures?.[0].hard).toBe(false);
  });
});
