import { describe, expect, test } from "vitest";
import { loadRoadmap, RoadmapValidationError } from "./load";

function validSources() {
  return [
    {
      id: "wiki-vors-prize",
      title: "공식 위키 — Vor's Prize",
      url: "https://wiki.warframe.com/w/Vor%27s_Prize",
      collectedAt: "2026-08-03",
      status: "alive",
    },
  ];
}

function validNodes() {
  return [
    {
      id: "vors-prize",
      kind: "quest",
      title: "보의 전리품",
      summary: "튜토리얼 퀘스트.",
      prerequisites: [],
      preparations: [],
      cautions: [],
      spoiler: false,
      sourceIds: ["wiki-vors-prize"],
      basedOnPatch: "Update 39",
    },
    {
      id: "earth-venus-junction",
      kind: "junction",
      title: "지구 → 금성 정크션",
      summary: "금성으로 가는 관문.",
      prerequisites: ["vors-prize"],
      preparations: [
        { name: "아무 모드", source: "지구 미션 드랍", quantity: 1 },
      ],
      cautions: ["과제를 미리 확인할 것"],
      spoiler: false,
      sourceIds: ["wiki-vors-prize"],
      basedOnPatch: "Update 39",
    },
  ];
}

describe("loadRoadmap", () => {
  test("유효한 데이터는 노드와 출처를 그대로 돌려준다", () => {
    const roadmap = loadRoadmap({
      nodes: validNodes(),
      sources: validSources(),
    });
    expect(roadmap.nodes.map((n) => n.id)).toEqual([
      "vors-prize",
      "earth-venus-junction",
    ]);
    expect(roadmap.sources).toHaveLength(1);
  });

  test("스키마 위반(제목 누락)은 어떤 노드가 문제인지 알려주며 실패한다", () => {
    const nodes = validNodes();
    // @ts-expect-error 의도적 스키마 위반
    delete nodes[1].title;
    expect(() => loadRoadmap({ nodes, sources: validSources() })).toThrow(
      RoadmapValidationError,
    );
    expect(() => loadRoadmap({ nodes, sources: validSources() })).toThrow(
      /earth-venus-junction[\s\S]*title|title[\s\S]*earth-venus-junction/,
    );
  });

  test("존재하지 않는 종류(kind)는 실패한다", () => {
    const nodes = validNodes();
    nodes[0].kind = "boss-fight";
    expect(() => loadRoadmap({ nodes, sources: validSources() })).toThrow(
      RoadmapValidationError,
    );
  });

  test("알 수 없는 필드(오타)는 실패한다", () => {
    const nodes: unknown[] = validNodes();
    (nodes[0] as Record<string, unknown>).cauitons = ["오타 필드"];
    expect(() => loadRoadmap({ nodes, sources: validSources() })).toThrow(
      RoadmapValidationError,
    );
  });

  test("존재하지 않는 선행조건 참조가 검출된다", () => {
    const nodes = validNodes();
    nodes[1].prerequisites = ["no-such-node"];
    expect(() => loadRoadmap({ nodes, sources: validSources() })).toThrow(
      /no-such-node/,
    );
  });

  test("순환 의존이 검출된다", () => {
    const nodes = validNodes();
    nodes[0].prerequisites = ["earth-venus-junction"];
    expect(() => loadRoadmap({ nodes, sources: validSources() })).toThrow(
      /순환/,
    );
  });

  test("자기 자신을 선행조건으로 참조하는 순환도 검출된다", () => {
    const nodes = validNodes();
    nodes[0].prerequisites = ["vors-prize"];
    expect(() => loadRoadmap({ nodes, sources: validSources() })).toThrow(
      /순환/,
    );
  });

  test("깨진 출처 참조가 검출된다", () => {
    const nodes = validNodes();
    nodes[0].sourceIds = ["no-such-source"];
    expect(() => loadRoadmap({ nodes, sources: validSources() })).toThrow(
      /no-such-source/,
    );
  });

  test("중복 노드 id가 검출된다", () => {
    const nodes = validNodes();
    nodes[1].id = "vors-prize";
    nodes[1].prerequisites = [];
    expect(() => loadRoadmap({ nodes, sources: validSources() })).toThrow(
      /vors-prize/,
    );
  });

  test("여러 오류가 있으면 한 번에 모두 보고한다", () => {
    const nodes = validNodes();
    nodes[1].prerequisites = ["no-such-node"];
    nodes[1].sourceIds = ["no-such-source"];
    try {
      loadRoadmap({ nodes, sources: validSources() });
      expect.unreachable("검증이 실패해야 한다");
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain("no-such-node");
      expect(message).toContain("no-such-source");
    }
  });
});
