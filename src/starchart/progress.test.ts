import { describe, expect, test } from "vitest";
import starchartJson from "@/data/starchart.json";
import type { StarchartDataset } from "./dataset";
import {
  buildProgressGraph,
  completeGroup,
  completeThrough,
  isGroupComplete,
  nodeState,
  nodeStates,
  resetCompletion,
  toggleCompletion,
} from "./progress";

/**
 * 축소 그래프. 실제 데이터셋의 경계를 하나씩 담았다.
 * - 수성: 진입 노드 → 중간 → 교차점, 교차점이 금성으로 이어진다(그룹 넘는 간선).
 * - 고리: 진입 노드에서 들어오는 순환(C1↔C2) + 데이터셋 밖을 가리키는 간선.
 * - 고립: 밖에서 들어오는 간선이 없는 순환 — 아무도 해제할 수 없다.
 * - 릴레이: 진행도와 무관한 그룹.
 */
const dataset: StarchartDataset = {
  groups: {
    Mercury: { name: "수성", type: "planet" },
    Venus: { name: "금성", type: "planet" },
    Loop: { name: "고리", type: "special" },
    Orphan: { name: "고립", type: "special" },
    RelayStationSanctuary: { name: "미션 통제실", type: "relay" },
  },
  nodes: {
    M1: { name: "M1", group: "Mercury", nextNodes: ["M2"] },
    M2: { name: "M2", group: "Mercury", nextNodes: ["MJ"] },
    MJ: { name: "MJ", group: "Mercury", nextNodes: ["V1"] },
    V1: { name: "V1", group: "Venus", nextNodes: ["V2"] },
    V2: { name: "V2", group: "Venus", nextNodes: [] },
    D1: { name: "D1", group: "Loop", nextNodes: ["C1", "Ghost"] },
    C1: { name: "C1", group: "Loop", nextNodes: ["C2"] },
    C2: { name: "C2", group: "Loop", nextNodes: ["C1"] },
    X1: { name: "X1", group: "Orphan", nextNodes: ["X2"] },
    X2: { name: "X2", group: "Orphan", nextNodes: ["X1"] },
    R1: { name: "R1", group: "RelayStationSanctuary", nextNodes: [] },
  },
};

const graph = buildProgressGraph(dataset);

describe("nodeState", () => {
  test("완료 집합에 있으면 클리어다", () => {
    expect(nodeState(graph, new Set(["M2"]), "M2")).toBe("cleared");
  });

  test("선행 노드가 없는 진입 노드는 완료 집합이 비어도 미클리어다", () => {
    expect(nodeState(graph, new Set(), "M1")).toBe("uncleared");
  });

  test("선행 노드가 하나도 완료되지 않으면 잠김이다", () => {
    expect(nodeState(graph, new Set(), "M2")).toBe("locked");
  });

  test("선행 노드 하나가 완료되면 미클리어로 열린다", () => {
    expect(nodeState(graph, new Set(["M1"]), "M2")).toBe("uncleared");
  });

  test("그룹을 넘는 간선도 해제에 쓰인다 — 교차점이 다음 행성을 연다", () => {
    expect(nodeState(graph, new Set(), "V1")).toBe("locked");
    expect(nodeState(graph, new Set(["MJ"]), "V1")).toBe("uncleared");
  });

  test("순환은 밖에서 들어오는 간선으로 열린다", () => {
    expect(nodeState(graph, new Set(), "C1")).toBe("locked");
    expect(nodeState(graph, new Set(["D1"]), "C1")).toBe("uncleared");
    // C1을 완료해야 C2가 열린다 — 순환이 서로를 자동으로 열지는 않는다
    expect(nodeState(graph, new Set(["D1"]), "C2")).toBe("locked");
    expect(nodeState(graph, new Set(["D1", "C1"]), "C2")).toBe("uncleared");
  });

  test("밖에서 들어오는 간선이 없는 순환은 계속 잠김이다", () => {
    expect(nodeState(graph, new Set(), "X1")).toBe("locked");
    expect(nodeState(graph, new Set(), "X2")).toBe("locked");
  });

  test("데이터셋 밖을 가리키는 간선은 노드를 만들지 않는다", () => {
    expect(nodeState(graph, new Set(["D1"]), "Ghost")).toBe("locked");
    expect(nodeState(graph, new Set(["Ghost"]), "Ghost")).toBe("locked");
  });

  test("데이터셋에 없는 id는 완료 집합에 있어도 잠김이다 (비노드 목표·낡은 데이터)", () => {
    expect(nodeState(graph, new Set(["quest-vors-prize"]), "quest-vors-prize")).toBe(
      "locked",
    );
  });

  test("진행도 대상이 아닌 릴레이 노드는 잠김이다", () => {
    expect(nodeState(graph, new Set(["R1"]), "R1")).toBe("locked");
  });
});

describe("nodeStates", () => {
  test("진행도 대상 노드 전부의 상태를 데이터셋 순서로 돌려준다", () => {
    const states = nodeStates(graph, new Set(["M1", "M2"]));
    expect([...states]).toEqual([
      ["M1", "cleared"],
      ["M2", "cleared"],
      ["MJ", "uncleared"],
      ["V1", "locked"],
      ["V2", "locked"],
      ["D1", "uncleared"],
      ["C1", "locked"],
      ["C2", "locked"],
      ["X1", "locked"],
      ["X2", "locked"],
    ]);
  });

  test("릴레이 노드는 빠진다 — 지도에서 숨기고 진행도와도 무관하다", () => {
    expect(nodeStates(graph, new Set()).has("R1")).toBe(false);
  });
});

describe("isGroupComplete", () => {
  test("그룹의 노드가 전부 완료면 완료다", () => {
    expect(isGroupComplete(graph, new Set(["V1", "V2"]), "Venus")).toBe(true);
  });

  test("하나라도 미완료면 완료가 아니다", () => {
    expect(isGroupComplete(graph, new Set(["V1"]), "Venus")).toBe(false);
  });

  test("빈 완료 집합에서는 어느 그룹도 완료가 아니다", () => {
    expect(isGroupComplete(graph, new Set(), "Venus")).toBe(false);
  });

  test("데이터셋에 없는 그룹은 완료가 아니다", () => {
    expect(isGroupComplete(graph, new Set(["V1", "V2"]), "Pluto")).toBe(false);
  });

  test("릴레이 그룹은 노드를 완료해도 완료가 아니다 — 진행도 대상이 아니다", () => {
    expect(
      isGroupComplete(graph, new Set(["R1"]), "RelayStationSanctuary"),
    ).toBe(false);
  });
});

describe("completeThrough", () => {
  test("지정 노드와 선행 노드 전체를 완료 처리한다 (그룹을 넘어서)", () => {
    expect([...completeThrough(graph, new Set(), "V2")].sort()).toEqual([
      "M1",
      "M2",
      "MJ",
      "V1",
      "V2",
    ]);
  });

  test("이미 완료된 것과 노드가 아닌 완료 항목을 지우지 않는다", () => {
    const before = new Set(["V2", "quest-vors-prize"]);
    const after = completeThrough(graph, before, "M2");
    expect(after.has("V2")).toBe(true);
    expect(after.has("quest-vors-prize")).toBe(true);
  });

  test("어떤 노드로 실행해도 완료가 줄어들지 않는다", () => {
    const before = new Set(["V1", "V2", "quest-vors-prize", "Ghost"]);
    for (const id of [...graph.nodesByGroup.values()].flat()) {
      const after = completeThrough(graph, before, id);
      for (const kept of before) expect(after.has(kept)).toBe(true);
      expect(after.size).toBeGreaterThanOrEqual(before.size);
    }
  });

  test("순환을 거슬러 올라가도 끝난다", () => {
    expect([...completeThrough(graph, new Set(), "C2")].sort()).toEqual([
      "C1",
      "C2",
      "D1",
    ]);
  });

  test("데이터셋에 없는 노드면 완료 집합을 그대로 돌려준다", () => {
    const before = new Set(["M1"]);
    const after = completeThrough(graph, before, "Ghost");
    expect([...after]).toEqual(["M1"]);
    expect(after).not.toBe(before);
  });

  test("릴레이 노드로는 아무 일도 일어나지 않는다", () => {
    expect([...completeThrough(graph, new Set(), "R1")]).toEqual([]);
  });

  test("입력 집합을 바꾸지 않는다", () => {
    const before = new Set(["M1"]);
    completeThrough(graph, before, "V2");
    expect([...before]).toEqual(["M1"]);
  });
});

describe("completeGroup", () => {
  test("그룹의 노드와 그 선행 전체를 완료 처리한다", () => {
    expect([...completeGroup(graph, new Set(), "Venus")].sort()).toEqual([
      "M1",
      "M2",
      "MJ",
      "V1",
      "V2",
    ]);
    expect(isGroupComplete(graph, completeGroup(graph, new Set(), "Venus"), "Venus")).toBe(
      true,
    );
  });

  test("밖에서 열 수 없는 순환도 그룹 완료로는 채운다", () => {
    expect([...completeGroup(graph, new Set(), "Orphan")].sort()).toEqual([
      "X1",
      "X2",
    ]);
  });

  test("데이터셋에 없는 그룹이면 완료 집합을 그대로 돌려준다", () => {
    const before = new Set(["M1"]);
    const after = completeGroup(graph, before, "Pluto");
    expect([...after]).toEqual(["M1"]);
    expect(after).not.toBe(before);
  });

  test("완료를 해제하지 않는다", () => {
    const after = completeGroup(graph, new Set(["V2", "quest-vors-prize"]), "Mercury");
    expect(after.has("V2")).toBe(true);
    expect(after.has("quest-vors-prize")).toBe(true);
  });
});

describe("toggleCompletion / resetCompletion", () => {
  test("완료 여부를 뒤집는다", () => {
    expect([...toggleCompletion(new Set(), "M1")]).toEqual(["M1"]);
    expect([...toggleCompletion(new Set(["M1"]), "M1")]).toEqual([]);
  });

  test("노드가 아닌 완료 항목도 같은 집합에서 토글한다", () => {
    expect([...toggleCompletion(new Set(), "quest-vors-prize")]).toEqual([
      "quest-vors-prize",
    ]);
  });

  test("입력 집합을 바꾸지 않는다", () => {
    const before = new Set(["M1"]);
    toggleCompletion(before, "M2");
    expect([...before]).toEqual(["M1"]);
  });

  test("초기화는 빈 집합이다", () => {
    expect(resetCompletion().size).toBe(0);
  });
});

describe("정제 노드 데이터셋", () => {
  const real = buildProgressGraph(starchartJson as unknown as StarchartDataset);
  const trackedIds = [...real.nodesByGroup.values()].flat();

  test("릴레이 2노드만 빠진 352노드가 진행도 대상이다", () => {
    expect(trackedIds).toHaveLength(352);
    expect(real.nodesByGroup.has("RelayStationSanctuary")).toBe(false);
  });

  test("완료 집합이 비면 진입 노드만 미클리어다", () => {
    const states = nodeStates(real, new Set());
    const uncleared = [...states].filter(([, s]) => s === "uncleared");
    expect(uncleared).toHaveLength(54);
    expect([...states].every(([, s]) => s !== "cleared")).toBe(true);
  });

  test("열린 노드를 계속 클리어하면 전부 도달한다 — 영구 잠김 노드가 없다", () => {
    let completed = new Set<string>();
    for (;;) {
      const opened = [...nodeStates(real, completed)]
        .filter(([, state]) => state === "uncleared")
        .map(([id]) => id);
      if (opened.length === 0) break;
      completed = new Set([...completed, ...opened]);
    }
    expect(completed.size).toBe(352);
  });

  test("가장 깊은 노드도 completeThrough 한 번으로 선행이 전부 채워진다", () => {
    for (const id of trackedIds) {
      const completed = completeThrough(real, new Set(), id);
      expect(nodeState(real, completed, id)).toBe("cleared");
      // 채워진 노드 전부가 잠김이 아니어야 한다 — 선행을 빠뜨리면 여기서 드러난다
      for (const filled of completed) {
        expect(nodeState(real, completed, filled)).toBe("cleared");
      }
      expect(
        [...completed].every((filled) => {
          const preds = real.predecessors.get(filled) ?? [];
          return preds.length === 0 || preds.some((p) => completed.has(p));
        }),
      ).toBe(true);
    }
  });

  test("행성 완료는 그 행성 노드 전부가 완료됐을 때만 참이다", () => {
    const mercury = real.nodesByGroup.get("Mercury")!;
    expect(isGroupComplete(real, new Set(mercury), "Mercury")).toBe(true);
    expect(isGroupComplete(real, new Set(mercury.slice(1)), "Mercury")).toBe(false);
    expect(isGroupComplete(real, completeGroup(real, new Set(), "Mercury"), "Mercury")).toBe(
      true,
    );
  });
});
