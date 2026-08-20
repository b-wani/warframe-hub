import { describe, expect, test } from "vitest";
import { formatPatchBaseline, patchBaseline } from "./patch";
import type { RoadmapNode } from "./schema";

function node(id: string, basedOnPatch: string): RoadmapNode {
  return {
    id,
    kind: "quest",
    title: id,
    summary: id,
    prerequisites: [],
    preparations: [],
    cautions: [],
    spoiler: false,
    sourceIds: ["s1"],
    basedOnPatch,
  };
}

describe("patchBaseline", () => {
  test("모든 노드가 같은 패치면 그 패치 하나", () => {
    expect(
      patchBaseline([node("a", "Update 43"), node("b", "Update 43")]),
    ).toEqual(["Update 43"]);
  });

  test("섞여 있으면 로드맵 순서대로 중복 없이 모아 준다", () => {
    expect(
      patchBaseline([
        node("a", "Update 43"),
        node("b", "Update 42"),
        node("c", "Update 43"),
      ]),
    ).toEqual(["Update 43", "Update 42"]);
  });

  test("노드가 없으면 빈 목록", () => {
    expect(patchBaseline([])).toEqual([]);
  });
});

describe("formatPatchBaseline", () => {
  test("하나면 그대로", () => {
    expect(formatPatchBaseline(["Update 43"])).toBe("Update 43");
  });

  test("여러 개면 쉼표로 잇는다", () => {
    expect(formatPatchBaseline(["Update 43", "Update 42"])).toBe(
      "Update 43, Update 42",
    );
  });

  test("비어 있으면 알 수 없음", () => {
    expect(formatPatchBaseline([])).toBe("알 수 없음");
  });
});
