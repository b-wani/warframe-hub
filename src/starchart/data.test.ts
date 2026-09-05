import { describe, expect, test } from "vitest";
import { solarSystemBodies } from "./bodies.ts";
import { starchartDataset, starchartLayout } from "./data.ts";
import type { GroupType } from "./dataset.ts";
import { fallbackGroups } from "./fallback.ts";
import { nodeClouds } from "./node-cloud.ts";
import { proximaRings } from "./proxima.ts";

// 스펙 §3·§10-2가 못박은 데이터셋 규모. 정제 파이프라인을 다시 돌렸을 때
// 수치가 말없이 바뀌면 여기서 걸린다 — "354노드가 렌더된다"는 수용 기준의 축.
describe("정제 노드 데이터셋 규모", () => {
  test("노드 354 · 그룹 30", () => {
    expect(Object.keys(starchartDataset.nodes)).toHaveLength(354);
    expect(Object.keys(starchartDataset.groups)).toHaveLength(30);
  });

  test("그룹 유형 4분류가 스펙대로 갈린다", () => {
    const byType: Partial<Record<GroupType, number>> = {};
    for (const group of Object.values(starchartDataset.groups)) {
      byType[group.type] = (byType[group.type] ?? 0) + 1;
    }
    expect(byType).toEqual({ planet: 17, special: 5, proxima: 7, relay: 1 });
  });
});

/*
 * 354노드가 전부 같은 자리에 뜨는 것은 아니다 — 스펙이 릴레이를 숨기고(§2.1),
 * 베일 프록시마는 붙을 행성이 없어 3D 지도에 자리가 없다(`proxima.ts`). 그래서
 * "354 렌더"는 세 갈래로 갈리며, 그 갈림이 여기 숫자로 적혀 있다. 노드 하나가
 * 어느 갈래에도 안 들어가 조용히 사라지는 것이 이 테스트가 막는 사고다.
 */
describe("354노드가 닿는 자리", () => {
  const { bodies } = solarSystemBodies(starchartDataset, starchartLayout);
  const { clouds } = nodeClouds(starchartDataset, starchartLayout, bodies);
  const { rings } = proximaRings(starchartDataset, starchartLayout, bodies);

  const cloudNodes = [...clouds.values()].flatMap((cloud) => cloud.nodes);
  const ringNodes = [...rings.values()].flatMap((ring) => ring.cloud.nodes);
  const listNodes = fallbackGroups(starchartDataset).flatMap(
    (group) => group.nodes,
  );

  test("릴레이 2노드를 뺀 352가 진행도·폴백 뷰의 대상이다", () => {
    expect(listNodes).toHaveLength(352);
  });

  test("3D 지도는 342 — 노드 구름 307 + 프록시마 고리 35", () => {
    expect(cloudNodes).toHaveLength(307);
    expect(ringNodes).toHaveLength(35);
  });

  test("3D에 자리가 없는 베일 프록시마 10노드도 폴백 뷰로는 닿는다", () => {
    const mapped = new Set([...cloudNodes, ...ringNodes].map((n) => n.id));
    const listOnly = listNodes.filter((node) => !mapped.has(node.id));
    expect(listOnly).toHaveLength(10);
    for (const node of listOnly) {
      expect(starchartDataset.nodes[node.id].group).toBe("DeepSpace_SPACE");
    }
  });
});
