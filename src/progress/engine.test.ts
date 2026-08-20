import { describe, expect, test } from "vitest";
import type { RoadmapNode } from "@/roadmap/schema";
import {
  completeThrough,
  computeProgress,
  resetProgress,
  toggleNode,
} from "./engine";

function node(
  id: string,
  prerequisites: string[] = [],
): RoadmapNode {
  return {
    id,
    kind: "quest",
    title: id,
    summary: id,
    prerequisites,
    preparations: [],
    cautions: [],
    spoiler: false,
    sourceIds: ["src"],
    basedOnPatch: "Update 39",
  };
}

// vors-prize → junction → { once-awake, rhino-parts } 모양의 축소 그래프
const nodes: RoadmapNode[] = [
  node("a"),
  node("b", ["a"]),
  node("c", ["b"]),
  node("d", ["b"]),
];

describe("computeProgress", () => {
  test("빈 상태: 선행 없는 노드만 다음 목표, 완료율 0", () => {
    const progress = computeProgress(nodes, new Set());
    expect(progress.nextGoals.map((n) => n.id)).toEqual(["a"]);
    expect(progress.completedCount).toBe(0);
    expect(progress.totalCount).toBe(4);
    expect(progress.completionRate).toBe(0);
  });

  test("중간 상태: 선행이 모두 충족된 미완료 노드만 다음 목표다", () => {
    const progress = computeProgress(nodes, new Set(["a", "b"]));
    expect(progress.nextGoals.map((n) => n.id)).toEqual(["c", "d"]);
    expect(progress.completedCount).toBe(2);
    expect(progress.completionRate).toBe(0.5);
  });

  test("선행 미충족 노드는 다음 목표에서 제외된다", () => {
    const progress = computeProgress(nodes, new Set(["a"]));
    // c, d는 b가 미완료라 제외
    expect(progress.nextGoals.map((n) => n.id)).toEqual(["b"]);
  });

  test("완료 상태: 다음 목표가 없고 완료율 1", () => {
    const progress = computeProgress(nodes, new Set(["a", "b", "c", "d"]));
    expect(progress.nextGoals).toEqual([]);
    expect(progress.completedCount).toBe(4);
    expect(progress.completionRate).toBe(1);
  });

  test("로드맵에 없는 완료 id는 무시한다 (낡은 저장 데이터)", () => {
    const progress = computeProgress(nodes, new Set(["a", "ghost"]));
    expect(progress.completedCount).toBe(1);
    expect(progress.nextGoals.map((n) => n.id)).toEqual(["b"]);
  });

  test("노드가 없으면 완료율은 0이다 (0으로 나누지 않는다)", () => {
    const progress = computeProgress([], new Set());
    expect(progress.completionRate).toBe(0);
    expect(progress.totalCount).toBe(0);
  });

  test("다음 목표는 로드맵의 노드 순서를 유지한다", () => {
    const progress = computeProgress(nodes, new Set(["a", "b"]));
    expect(progress.nextGoals.map((n) => n.id)).toEqual(["c", "d"]);
  });
});

describe("toggleNode", () => {
  test("미완료 노드를 체크한다", () => {
    const next = toggleNode(new Set(), "a");
    expect(next.has("a")).toBe(true);
  });

  test("완료된 노드를 해제한다", () => {
    const next = toggleNode(new Set(["a"]), "a");
    expect(next.has("a")).toBe(false);
  });

  test("입력 집합을 변경하지 않는다", () => {
    const original = new Set(["a"]);
    toggleNode(original, "b");
    expect([...original]).toEqual(["a"]);
  });
});

describe("resetProgress", () => {
  test("빈 집합을 돌려준다", () => {
    expect(resetProgress().size).toBe(0);
  });
});

describe("completeThrough", () => {
  test("지정 노드와 선행 노드 전체를 완료 처리한다", () => {
    const next = completeThrough(nodes, new Set(), "c");
    expect([...next].sort()).toEqual(["a", "b", "c"]);
  });

  test("선행이 없는 노드는 자기만 완료된다", () => {
    const next = completeThrough(nodes, new Set(), "a");
    expect([...next]).toEqual(["a"]);
  });

  test("이미 완료된 노드는 유지하고, 다른 가지는 건드리지 않는다", () => {
    const next = completeThrough(nodes, new Set(["d"]), "c");
    expect([...next].sort()).toEqual(["a", "b", "c", "d"]);
  });

  test("일괄 체크 후 다음 목표는 지정 노드의 후속으로 갱신된다", () => {
    const next = completeThrough(nodes, new Set(), "b");
    expect(computeProgress(nodes, next).nextGoals.map((n) => n.id)).toEqual([
      "c",
      "d",
    ]);
  });

  test("입력 집합을 변경하지 않는다", () => {
    const original = new Set(["d"]);
    completeThrough(nodes, original, "c");
    expect([...original]).toEqual(["d"]);
  });

  test("로드맵에 없는 노드는 아무것도 바꾸지 않는다", () => {
    const next = completeThrough(nodes, new Set(["a"]), "ghost");
    expect([...next]).toEqual(["a"]);
  });

  test("선행조건 순환이 있어도 멈춘다", () => {
    const cyclic: RoadmapNode[] = [node("x", ["y"]), node("y", ["x"])];
    const next = completeThrough(cyclic, new Set(), "x");
    expect([...next].sort()).toEqual(["x", "y"]);
  });

  test("로드맵에 없는 선행 id는 완료 집합에 넣지 않는다", () => {
    const dangling: RoadmapNode[] = [node("p", ["ghost"])];
    expect([...completeThrough(dangling, new Set(), "p")]).toEqual(["p"]);
  });
});
