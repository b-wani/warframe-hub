import { describe, expect, it } from "vitest";
import { getRoadmap } from "@/roadmap/roadmap";
import type { RoadmapNode } from "@/roadmap/schema";
import { formatRemaining, selectWidgetContext } from "./context";

const nodesById = new Map(getRoadmap().nodes.map((n) => [n.id, n]));

function node(id: string): RoadmapNode {
  return nodesById.get(id)!;
}

describe("selectWidgetContext", () => {
  it("단계가 다르면 다른 준비물을 노출한다", () => {
    const early = selectWidgetContext([node("vors-prize")]);
    const rhino = selectWidgetContext([node("rhino-prep")]);

    expect(early.preparations).toEqual([]);
    expect(rhino.preparations).toEqual([
      {
        goalTitle: node("rhino-prep").title,
        name: "라이노 본체 설계도",
        quantity: 1,
        source: "마켓에서 크레딧으로 구매",
      },
      {
        goalTitle: node("rhino-prep").title,
        name: "라이노 부품 설계도 (뉴로옵틱스·섀시·시스템)",
        quantity: 3,
        source: "금성 포사(Fossa) — 잭클 처치 보상",
      },
    ]);
  });

  it("단계가 지구를 다루면 지구 낮밤 주기가 관련된다", () => {
    expect(selectWidgetContext([node("mars-junction")]).regions).toEqual([
      "earth",
    ]);
    expect(selectWidgetContext([node("the-second-dream")]).regions).toEqual([]);
  });

  it("시터스 평원을 다루는 단계면 시터스 주기가 관련된다", () => {
    const cetusGoal: RoadmapNode = {
      ...node("vors-prize"),
      id: "saya-vigil",
      title: "사야의 철야",
      summary: "시터스에서 에이도론 평원으로 나간다.",
    };

    expect(selectWidgetContext([cetusGoal]).regions).toEqual(["cetus"]);
  });

  it("다음 목표가 없으면 노출할 문맥도 없다", () => {
    expect(selectWidgetContext([])).toEqual({ regions: [], preparations: [] });
  });
});

describe("formatRemaining", () => {
  it("남은 시간을 한국어로 표기한다", () => {
    expect(formatRemaining(2 * 86_400_000 + 3 * 3_600_000)).toBe("2일 3시간");
    expect(formatRemaining(96 * 60_000)).toBe("1시간 36분");
    expect(formatRemaining(31 * 60_000)).toBe("31분");
    expect(formatRemaining(30_000)).toBe("1분 미만");
  });

  it("이미 지난 시각은 null이다", () => {
    expect(formatRemaining(0)).toBeNull();
    expect(formatRemaining(-1)).toBeNull();
    expect(formatRemaining(Number.NaN)).toBeNull();
  });
});
