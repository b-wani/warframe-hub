import { describe, expect, test } from "vitest";
import { starchartDataset as dataset } from "./data";
import { nodeDetail } from "./node-detail";

describe("nodeDetail", () => {
  test("표시명·미션 유형·팩션·레벨 범위를 함께 준다", () => {
    expect(nodeDetail(dataset, "SolNode27")).toEqual({
      id: "SolNode27",
      name: "E Prime",
      mission: "섬멸",
      faction: "그리니어",
      levelRange: "1–3",
      junction: false,
    });
  });

  test("교차점은 일반 노드와 구별된다", () => {
    const detail = nodeDetail(dataset, "EarthToVenusJunction")!;
    expect(detail.junction).toBe(true);
    expect(detail.name).toBe("금성 교차점");
  });

  test("팩션이 없는 노드는 팩션 줄이 없다 — 빈칸을 지어내지 않는다", () => {
    // 교차점은 상대할 팩션이 없다 (정제 노드 데이터셋에 faction이 비어 있다)
    expect(nodeDetail(dataset, "EarthToVenusJunction")!.faction).toBeUndefined();
  });

  test("레벨 범위가 한 값이면 한 번만 적는다", () => {
    expect(
      nodeDetail(
        { groups: {}, nodes: { N: node({ minEnemyLevel: 8, maxEnemyLevel: 8 }) } },
        "N",
      )!.levelRange,
    ).toBe("8");
  });

  test("레벨이 빠진 노드는 범위 줄이 없다", () => {
    expect(
      nodeDetail({ groups: {}, nodes: { N: node({}) } }, "N")!.levelRange,
    ).toBeUndefined();
  });

  test("미션 유형 표시명이 없으면 미션 줄이 없다 — 언어 키를 노출하지 않는다", () => {
    expect(
      nodeDetail(
        { groups: {}, nodes: { N: node({ missionType: "MT_SURVIVAL" }) } },
        "N",
      )!.mission,
    ).toBeUndefined();
  });

  test("데이터셋에 없는 id는 상세가 없다", () => {
    expect(nodeDetail(dataset, "SolNodeNope")).toBeUndefined();
  });
});

function node(fields: Partial<(typeof dataset)["nodes"][string]>) {
  return { name: "N", group: "G", nextNodes: [], ...fields };
}
