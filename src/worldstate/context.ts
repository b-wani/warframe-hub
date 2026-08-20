import type { RoadmapNode } from "@/roadmap/schema";
import { cycleRegionSchema, type CycleRegion } from "./schema";

/** 지역별 낮밤 주기가 지금 단계와 관련 있는지 판별할 키워드. */
const regionKeywords: Record<CycleRegion, string[]> = {
  earth: ["지구"],
  cetus: ["시터스", "에이도론", "평원", "오스트론"],
};

export type PreparationHint = {
  goalTitle: string;
  name: string;
  quantity: number;
  source: string;
};

/** 다음 목표들로부터 계산한, 위젯이 노출할 문맥. */
export type WidgetContext = {
  /** 지금 단계와 관련된 낮밤 주기 지역 */
  regions: CycleRegion[];
  /** 지금 단계에서 모아야 할 준비물과 획득처 */
  preparations: PreparationHint[];
};

/**
 * 트래커의 다음 목표 → 위젯이 보여줄 문맥. 단계가 바뀌면 결과가 바뀐다.
 * 순수 함수이므로 위젯 표시층은 얇게 유지된다.
 */
export function selectWidgetContext(nextGoals: RoadmapNode[]): WidgetContext {
  const regions = cycleRegionSchema.options.filter((region) =>
    nextGoals.some((node) =>
      regionKeywords[region].some((keyword) =>
        searchableText(node).includes(keyword),
      ),
    ),
  );

  const preparations = nextGoals.flatMap((node) =>
    node.preparations.map((prep) => ({
      goalTitle: node.title,
      name: prep.name,
      quantity: prep.quantity,
      source: prep.source,
    })),
  );

  return { regions, preparations };
}

function searchableText(node: RoadmapNode): string {
  return [
    node.title,
    node.summary,
    ...node.cautions,
    ...node.preparations.flatMap((prep) => [prep.name, prep.source]),
  ].join("\n");
}

/**
 * 남은 시간을 한국어로 짧게 표기한다. 이미 지난 시각이면 null —
 * 호출자가 "정보 없음"과 같은 방식으로 다루게 한다.
 */
export function formatRemaining(ms: number): string | null {
  if (!Number.isFinite(ms) || ms <= 0) return null;

  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}일 ${hours}시간`;
  if (hours > 0) return `${hours}시간 ${minutes}분`;
  if (minutes > 0) return `${minutes}분`;
  return "1분 미만";
}
