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

/**
 * 보이드 균열의 로테이션 — 인게임 렐릭 등급 순서다(스펙 §6). 이 순서가 곧
 * 목록의 정렬 기준이므로 열거 순서에 의미가 있다.
 */
export const fissureTierSchema = z.enum([
  "Lith",
  "Meso",
  "Neo",
  "Axi",
  "Requiem",
  "Omnia",
]);

/**
 * 외부 응답의 fissures 항목 하나 → 내부 타입.
 *
 * 외부는 노드를 SolNode id가 아니라 영문 표시명("E Gate (Venus)")으로만 알려준다.
 * 괄호 안 행성은 우리 데이터셋이 이미 아는 사실이라 떼어 둔 이름도 함께 준다 —
 * 이름 자체가 괄호로 끝나는 노드가 있어("THE INDEX: ENDURANCE (LOW RISK)") 뗀
 * 것만 남기면 그 노드를 영영 못 알아본다. 이름을 노드 id로 바꾸는 일은 스타차트
 * 쪽 소관이다.
 */
export const voidFissureSchema = z
  .object({
    nodeKey: z.string().min(1),
    tier: fissureTierSchema,
    activation: epochFromIso,
    expiry: epochFromIso,
    /** 스틸패스 균열인가. 없는 응답도 있어 기본은 일반 균열이다. */
    isHard: z.boolean().optional(),
  })
  .transform((raw) => ({
    /** 외부가 준 원문 그대로. */
    nodeKey: raw.nodeKey,
    /** 행성 괄호를 뗀 이름 — 대조는 이 둘을 차례로 시도한다. */
    nodeName: raw.nodeKey.replace(/\s*\([^()]*\)\s*$/, ""),
    tier: raw.tier,
    activationAt: raw.activation,
    expiryAt: raw.expiry,
    hard: raw.isHard ?? false,
  }));

export type CycleRegion = z.infer<typeof cycleRegionSchema>;
export type FissureTier = z.infer<typeof fissureTierSchema>;
export type VoidFissure = z.infer<typeof voidFissureSchema>;
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
  /**
   * 활성 보이드 균열. 빈 배열은 "지금 균열이 없다", null은 "이 섹션을 못
   * 받았다" — 폴백이 마지막 성공 값으로 메울 대상을 가리려면 둘이 달라야 한다.
   */
  fissures: VoidFissure[] | null;
  /** 이 스냅숏을 외부에서 받아온 시각(epoch ms) */
  fetchedAt: number;
  /** 마지막 성공 캐시로 대체된 스냅숏인지 */
  stale: boolean;
};
