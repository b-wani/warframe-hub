import { describe, expect, test } from "vitest";
import { starchartDataset } from "./data.ts";
import type { GroupType } from "./dataset.ts";

// 스펙 §3·§10-2가 못박은 데이터셋 규모. 정제 파이프라인을 다시 돌렸을 때
// 수치가 말없이 바뀌면 여기서 걸린다 — 354노드가 렌더된다는 수용 기준의 축.
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
