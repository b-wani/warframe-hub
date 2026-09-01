import { describe, expect, test } from "vitest";
import { starchartDataset } from "./data.ts";
import { fallbackGroups } from "./fallback.ts";
import type { StarchartDataset } from "./dataset.ts";

const dataset: StarchartDataset = {
  groups: {
    Earth: { name: "지구", type: "planet" },
    Earth_SPACE: { name: "지구 프록시마", type: "proxima" },
    Void: { name: "보이드", type: "special" },
    RelayStationSanctuary: { name: "미션 통제실", type: "relay" },
  },
  nodes: {
    SolNode27: { name: "E Prime", group: "Earth", nextNodes: ["SolNode89"] },
    SolNode89: { name: "Mariana", group: "Earth", nextNodes: [] },
    EarthToVenusJunction: {
      name: "금성 교차점",
      group: "Earth",
      nextNodes: [],
      missionType: "MT_JUNCTION",
    },
    CrewBattleNode500: { name: "Bendar Cluster", group: "Earth_SPACE", nextNodes: [] },
    SolNode1: { name: "Teshub", group: "Void", nextNodes: [] },
    RelayNode: { name: "라루스 릴레이", group: "RelayStationSanctuary", nextNodes: [] },
  },
};

describe("fallbackGroups", () => {
  test("진행도 대상 그룹을 데이터셋 순서로 돌려준다 — 릴레이는 없다", () => {
    expect(fallbackGroups(dataset).map((group) => group.id)).toEqual([
      "Earth",
      "Earth_SPACE",
      "Void",
    ]);
  });

  test("그룹 표시명과 노드 표시명을 그대로 싣는다", () => {
    const [earth] = fallbackGroups(dataset);
    expect(earth.name).toBe("지구");
    expect(earth.nodes.map((node) => node.name)).toEqual([
      "E Prime",
      "Mariana",
      "금성 교차점",
    ]);
  });

  test("교차점은 목록에서도 구별된다", () => {
    const [earth] = fallbackGroups(dataset);
    expect(
      earth.nodes.find((node) => node.id === "EarthToVenusJunction")?.junction,
    ).toBe(true);
    expect(earth.nodes.find((node) => node.id === "SolNode27")?.junction).toBe(
      false,
    );
  });

  test("커밋된 데이터셋의 진행도 대상 노드를 하나도 빠뜨리지 않는다", () => {
    // 폴백 뷰만 쓰는 사용자에게 닿지 않는 노드가 있으면 진행도가 그 노드만큼
    // 영영 잠긴다 — 3D 없이도 완료 집합 전부에 닿아야 한다
    const listed = fallbackGroups(starchartDataset).flatMap((group) =>
      group.nodes.map((node) => node.id),
    );
    const tracked = Object.entries(starchartDataset.nodes)
      .filter(([, node]) => starchartDataset.groups[node.group]?.type !== "relay")
      .map(([id]) => id);
    expect(new Set(listed)).toEqual(new Set(tracked));
  });
});
