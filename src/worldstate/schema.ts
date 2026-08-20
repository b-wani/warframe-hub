import { z } from "zod";

/** 낮밤 주기를 가진 지역. 위젯이 단계별로 골라 보여준다. */
export const cycleRegionSchema = z.enum(["earth", "cetus"]);

const epochFromIso = z.string().transform((value, ctx) => {
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    ctx.addIssue({ code: "custom", message: "ISO 시각이 아니다" });
    return z.NEVER;
  }
  return ms;
});

/** 외부 응답의 voidTrader 섹션 → 내부 타입. 모르는 필드는 버린다. */
export const voidTraderSchema = z
  .object({
    character: z.string().min(1),
    location: z.string().min(1),
    activation: epochFromIso,
    expiry: epochFromIso,
  })
  .transform((raw) => ({
    character: raw.character,
    location: raw.location,
    activationAt: raw.activation,
    expiryAt: raw.expiry,
  }));

/** 외부 응답의 earthCycle/cetusCycle 섹션 → 내부 타입. */
export const dayNightCycleSchema = z
  .object({
    isDay: z.boolean(),
    expiry: epochFromIso,
  })
  .transform((raw) => ({ isDay: raw.isDay, expiryAt: raw.expiry }));

export type CycleRegion = z.infer<typeof cycleRegionSchema>;
export type VoidTrader = z.infer<typeof voidTraderSchema>;
export type DayNightCycle = z.infer<typeof dayNightCycleSchema> & {
  region: CycleRegion;
};

/**
 * 위젯이 소비하는 월드스테이트. 섹션별로 독립 실패한다 —
 * 한 섹션이 깨져도 나머지는 그대로 살아있고, 없는 섹션은 null이다.
 */
export type WorldState = {
  voidTrader: VoidTrader | null;
  cycles: DayNightCycle[];
  /** 이 스냅숏을 외부에서 받아온 시각(epoch ms) */
  fetchedAt: number;
  /** 마지막 성공 캐시로 대체된 스냅숏인지 */
  stale: boolean;
};
