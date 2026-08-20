import {
  cycleRegionSchema,
  dayNightCycleSchema,
  voidTraderSchema,
  type CycleRegion,
  type DayNightCycle,
  type VoidTrader,
  type WorldState,
} from "./schema";

/** 외부 API에서 받아온 원본 응답 묶음. 섹션 단위로 없거나 깨질 수 있다. */
export type RawWorldState = {
  voidTrader?: unknown;
  earthCycle?: unknown;
  cetusCycle?: unknown;
};

const cycleKeys: Record<CycleRegion, keyof RawWorldState> = {
  earth: "earthCycle",
  cetus: "cetusCycle",
};

/**
 * 외부 월드스테이트 응답을 내부 타입으로 변환한다. 어떤 입력에도 던지지
 * 않는다 — 필드가 없거나 형식이 어긋난 섹션은 조용히 빠지고, 빈 응답이면
 * 전부 빈 스냅숏이 된다. 외부 스키마를 아는 유일한 지점.
 */
export function toWorldState(
  raw: unknown,
  options: { fetchedAt: number; stale?: boolean },
): WorldState {
  const sections: RawWorldState =
    typeof raw === "object" && raw !== null ? (raw as RawWorldState) : {};

  return {
    voidTrader: parseVoidTrader(sections.voidTrader),
    cycles: parseCycles(sections),
    fetchedAt: options.fetchedAt,
    stale: options.stale ?? false,
  };
}

/** 아무 정보도 없는 스냅숏. 외부 호출이 통째로 실패했을 때의 폴백. */
export function emptyWorldState(fetchedAt: number): WorldState {
  return { voidTrader: null, cycles: [], fetchedAt, stale: false };
}

function parseVoidTrader(raw: unknown): VoidTrader | null {
  const result = voidTraderSchema.safeParse(raw);
  return result.success ? result.data : null;
}

function parseCycles(sections: RawWorldState): DayNightCycle[] {
  const cycles: DayNightCycle[] = [];
  for (const region of cycleRegionSchema.options) {
    const result = dayNightCycleSchema.safeParse(sections[cycleKeys[region]]);
    if (result.success) {
      cycles.push({ region, ...result.data });
    }
  }
  return cycles;
}
