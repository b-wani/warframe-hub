import { describe, expect, test } from "vitest";
import { FORCE_PARAMS, runForceLayout } from "./force-layout";

const ring = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ id: `n${i}`, nextNodes: [] }));

describe("runForceLayout", () => {
  test("#29에서 검증된 파라미터를 그대로 쓴다", () => {
    expect(FORCE_PARAMS).toMatchObject({
      repulsion: 12000,
      linkLength: 90,
      centerPull: 0.003,
    });
  });

  test("시드가 고정이라 재실행해도 같은 결과가 나온다", () => {
    const members = [
      { id: "a", nextNodes: ["b"] },
      { id: "b", nextNodes: ["c"] },
      { id: "c", nextNodes: [] },
      { id: "d", nextNodes: ["a"] },
    ];
    expect(runForceLayout(members)).toEqual(runForceLayout(members));
  });

  test("모든 노드에 정수 좌표를 준다", () => {
    const coords = runForceLayout(ring(12));
    expect(Object.keys(coords)).toHaveLength(12);
    for (const { x, y } of Object.values(coords)) {
      expect(Number.isInteger(x)).toBe(true);
      expect(Number.isInteger(y)).toBe(true);
    }
  });

  test("간선으로 이어진 노드가 이어지지 않은 노드보다 가깝게 모인다", () => {
    const linked = runForceLayout([
      { id: "a", nextNodes: ["b"] },
      { id: "b", nextNodes: [] },
    ]);
    const loose = runForceLayout([
      { id: "a", nextNodes: [] },
      { id: "b", nextNodes: [] },
    ]);
    const gap = (c: Record<string, { x: number; y: number }>) =>
      Math.hypot(c.a.x - c.b.x, c.a.y - c.b.y);
    expect(gap(linked)).toBeLessThan(gap(loose));
  });

  test("데이터셋 밖을 가리키는 간선은 무시한다", () => {
    const coords = runForceLayout([{ id: "a", nextNodes: ["다른-그룹-노드"] }]);
    expect(Object.keys(coords)).toEqual(["a"]);
  });

  test("노드가 없으면 빈 좌표를 준다", () => {
    expect(runForceLayout([])).toEqual({});
  });

  test("서로 겹치는 좌표를 만들지 않는다", () => {
    const coords = runForceLayout(ring(20));
    const seen = new Set(Object.values(coords).map((p) => `${p.x},${p.y}`));
    expect(seen.size).toBe(20);
  });
});
