import { describe, expect, test } from "vitest";
import type { VoidFissure } from "@/worldstate/schema";
import { starchartDataset as dataset, starchartNodeNames } from "./data";
import {
  activeFissures,
  fissuresByNode,
  nodeNamesByEn,
  remainingText,
} from "./fissures";

const now = Date.parse("2026-08-20T10:30:00.000Z");

/** 지도에 놓을 수 있는 천체 — 실제로는 성계 뷰의 22개다. */
const bodies = new Set(["Earth", "Venus", "Void"]);

function fissure(fields: Partial<VoidFissure> = {}): VoidFissure {
  const nodeName = fields.nodeName ?? "E Prime";
  return {
    nodeKey: `${nodeName} (행성)`,
    nodeName,
    tier: "Lith",
    activationAt: now - 60_000,
    expiryAt: now + 60_000,
    hard: false,
    ...fields,
  };
}

const context = { dataset, names: starchartNodeNames, bodies, now };

describe("activeFissures", () => {
  test("영문 표시명을 노드 id로 해석해 지도에 놓을 자리를 준다", () => {
    expect(activeFissures([fissure()], context)).toEqual([
      {
        nodeId: "SolNode27",
        nodeName: "E Prime",
        bodyId: "Earth",
        bodyName: "지구",
        tier: "Lith",
        tierName: "리스",
        expiryAt: now + 60_000,
        hard: false,
      },
    ]);
  });

  test("로테이션 순서로, 같은 등급이면 먼저 닫히는 것부터 세운다", () => {
    const markers = activeFissures(
      [
        fissure({ nodeName: "Cambria", tier: "Axi" }),
        fissure({ nodeName: "Mariana", tier: "Lith", expiryAt: now + 90_000 }),
        fissure({ nodeName: "E Prime", tier: "Lith", expiryAt: now + 30_000 }),
      ],
      context,
    );

    expect(markers.map((marker) => marker.nodeName)).toEqual([
      "E Prime",
      "Mariana",
      "Cambria",
    ]);
  });

  test("이미 닫힌 균열은 지나간 일이다", () => {
    expect(
      activeFissures([fissure({ expiryAt: now - 1 })], context),
    ).toEqual([]);
  });

  test("아직 열리지 않은 균열은 활성이 아니다", () => {
    expect(
      activeFissures([fissure({ activationAt: now + 1 })], context),
    ).toEqual([]);
  });

  test("이름 자체가 괄호로 끝나는 노드도 알아본다", () => {
    // 외부가 행성 괄호 없이 원문만 보내는 경우 — 뗀 이름만 보면 놓친다
    const markers = activeFissures(
      [
        fissure({
          nodeKey: "THE INDEX: ENDURANCE (LOW RISK)",
          nodeName: "THE INDEX: ENDURANCE",
        }),
      ],
      { ...context, bodies: new Set([...bodies, "Neptune"]) },
    );

    expect(markers.map((marker) => marker.nodeId)).toEqual(["SolNode761"]);
  });

  test("스틸패스 균열은 일반 균열과 구별해 남긴다", () => {
    const markers = activeFissures(
      [fissure({ hard: true }), fissure({ expiryAt: now + 30_000 })],
      context,
    );

    // 같은 노드·같은 등급으로 나란히 열린다 — 둘 다 남아야 목록에서 구별된다
    expect(markers.map((marker) => marker.hard)).toEqual([false, true]);
  });

  test("알아볼 수 없는 노드 이름은 버리고 나머지는 살린다", () => {
    const markers = activeFissures(
      [fissure({ nodeName: "Nowhere" }), fissure()],
      context,
    );

    expect(markers.map((marker) => marker.nodeId)).toEqual(["SolNode27"]);
  });

  test("지도에 없는 천체의 균열은 놓을 자리가 없다 — 프록시마가 그렇다", () => {
    // 프록시마 노드는 아직 지도에 없다(#48) — 날아갈 천체가 없으니 목록에도 없다
    expect(
      activeFissures([fissure({ nodeName: "Ogal Cluster" })], context),
    ).toEqual([]);
  });

  test("섹션을 못 받았으면 균열 표시만 빠진다", () => {
    expect(activeFissures(null, context)).toEqual([]);
  });
});

describe("fissuresByNode", () => {
  test("노드마다 하나씩, 목록에서 먼저 오는 균열을 남긴다", () => {
    const markers = activeFissures(
      [
        fissure({ tier: "Axi", expiryAt: now + 30_000 }),
        fissure({ tier: "Lith", expiryAt: now + 90_000 }),
      ],
      context,
    );

    // 마름모 하나에 심볼도 하나다 — 목록과 지도가 다른 등급을 말하지 않도록
    // 순서를 새로 정하지 않고 목록의 첫 항목을 그대로 쓴다
    const byNode = fissuresByNode(markers);
    expect(byNode.size).toBe(1);
    expect(byNode.get("SolNode27")?.tier).toBe("Lith");
  });
});

describe("nodeNamesByEn", () => {
  test("정제 노드 데이터셋의 영문 표시명 전부를 색인한다", () => {
    const names = nodeNamesByEn(dataset);
    expect(names.size).toBe(Object.keys(dataset.nodes).length);
    expect(names.get("E Prime")).toBe("SolNode27");
  });
});

describe("remainingText", () => {
  test("시간·분으로 읽히게 적는다", () => {
    expect(remainingText(32 * 60_000)).toBe("32분");
    expect(remainingText(65 * 60_000)).toBe("1시간 5분");
    expect(remainingText(120 * 60_000)).toBe("2시간");
  });

  test("1분이 안 남았으면 임박한 것으로 적는다", () => {
    expect(remainingText(30_000)).toBe("1분 미만");
  });

  test("이미 지난 시간은 닫힌 것이다", () => {
    expect(remainingText(0)).toBe("닫힘");
    expect(remainingText(-1)).toBe("닫힘");
  });
});
