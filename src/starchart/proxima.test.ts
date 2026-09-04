import { describe, expect, test } from "vitest";
import { WORLD_SCALE, solarSystemBodies } from "./bodies";
import {
  starchartDataset as dataset,
  starchartLayout as layout,
  starchartProgressGraph as graph,
} from "./data";
import { NODE_SCALE } from "./node-cloud";
import { bodyGroups, isBodyComplete, proximaRings } from "./proxima";

const { bodies } = solarSystemBodies(dataset, layout);
const byId = new Map(bodies.map((body) => [body.id, body]));
const { rings, issues } = proximaRings(dataset, layout, bodies);

describe("proximaRings", () => {
  test("host가 있는 프록시마 그룹이 저마다 자기 행성에 붙는다", () => {
    expect(issues).toEqual([]);
    expect([...rings.keys()].sort()).toEqual([
      "Earth",
      "Neptune",
      "Pluto",
      "Saturn",
      "Uranus",
      "Venus",
    ]);
    expect(rings.get("Earth")!.group).toBe("Earth_SPACE");
    expect(rings.get("Earth")!.name).toBe("지구 프록시마");
  });

  test("베일 프록시마는 붙을 행성이 없어 어느 행성 뷰에도 없다", () => {
    // 인게임에서도 특정 행성에 붙지 않는 심우주 구역이다(celestial.ts) —
    // 3D 지도에는 자리가 없고 폴백 뷰의 독립 항목으로만 닿는다
    const groups = [...rings.values()].map((ring) => ring.group);
    expect(groups).not.toContain("DeepSpace_SPACE");
  });

  test("프록시마 그룹의 노드를 하나도 빠뜨리지 않는다", () => {
    for (const ring of rings.values()) {
      const expected = Object.entries(dataset.nodes)
        .filter(([, node]) => node.group === ring.group)
        .map(([id]) => id);
      expect(ring.cloud.nodes.map((node) => node.id).sort()).toEqual(
        expected.sort(),
      );
    }
  });

  test("고리는 행성 바깥이다 — 행성 자신의 노드 구름보다 멀리 선다", () => {
    for (const [bodyId, ring] of rings) {
      const body = byId.get(bodyId)!;
      const gap = Math.hypot(
        ring.cloud.center[0] - body.position[0],
        ring.cloud.center[2] - body.position[2],
      );
      expect(gap).toBeGreaterThan(body.shellRadius);
      // 노드가 행성 안에 파묻히지 않는다
      for (const node of ring.cloud.nodes) {
        const distance = Math.hypot(
          node.position[0] - body.position[0],
          node.position[1] - body.position[1],
          node.position[2] - body.position[2],
        );
        expect(distance).toBeGreaterThan(body.shellRadius);
      }
    }
  });

  test("고리의 자리도 좌표 데이터셋이 정한다 — 배율 하나와 평행이동 하나다", () => {
    const ring = rings.get("Earth")!;
    expect(ring.cloud.center[0]).toBeCloseTo(
      layout.groups.Earth_SPACE.x * WORLD_SCALE,
    );
    expect(ring.cloud.center[2]).toBeCloseTo(
      layout.groups.Earth_SPACE.y * WORLD_SCALE,
    );
    // 원반 높이는 행성 뷰의 노드 구름과 같다 — 토글이 시선을 위아래로 흔들지 않는다
    const body = byId.get("Earth")!;
    expect(ring.cloud.center[1]).toBeGreaterThan(
      body.position[1] + body.shellRadius,
    );
    for (const node of ring.cloud.nodes) {
      const point = layout.nodes[node.id];
      expect(node.position[0] - ring.cloud.center[0]).toBeCloseTo(
        point.x * NODE_SCALE,
      );
      expect(node.position[2] - ring.cloud.center[2]).toBeCloseTo(
        point.y * NODE_SCALE,
      );
      expect(node.position[1]).toBe(ring.cloud.center[1]);
    }
  });

  test("연결선은 프록시마 그룹 안의 간선만이다", () => {
    const ring = rings.get("Earth")!;
    const inside = new Set(ring.cloud.nodes.map((node) => node.id));
    for (const link of ring.cloud.links) {
      expect(inside.has(link.from)).toBe(true);
      expect(inside.has(link.to)).toBe(true);
    }
    // 지구 프록시마의 마지막 노드는 토성 프록시마를 가리킨다 — 이 고리의 선이 아니다
    expect(dataset.nodes.CrewBattleNode522.nextNodes).toContain(
      "CrewBattleNode533",
    );
    const pairs = new Set(
      ring.cloud.links.map((link) => [link.from, link.to].sort().join("|")),
    );
    expect(pairs.has("CrewBattleNode502|CrewBattleNode509")).toBe(true);
    expect(pairs.has("CrewBattleNode522|CrewBattleNode533")).toBe(false);
  });

  test("좌표가 빠진 프록시마 그룹은 문제로 보고한다", () => {
    const { rings: partial, issues: reported } = proximaRings(
      dataset,
      {
        ...layout,
        groups: Object.fromEntries(
          Object.entries(layout.groups).filter(([id]) => id !== "Earth_SPACE"),
        ),
      },
      bodies,
    );
    expect(partial.has("Earth")).toBe(false);
    expect(reported).toEqual([expect.stringContaining("Earth_SPACE")]);
  });
});

describe("bodyGroups", () => {
  test("천체 하나에 매달린 진행도 그룹은 행성과 종속 프록시마다", () => {
    expect(bodyGroups("Earth")).toEqual(["Earth", "Earth_SPACE"]);
    // 프록시마가 없는 행성은 자기 하나뿐이다
    expect(bodyGroups("Mars")).toEqual(["Mars"]);
  });
});

describe("isBodyComplete", () => {
  const nodesOf = (groupId: string) =>
    Object.entries(dataset.nodes)
      .filter(([, node]) => node.group === groupId)
      .map(([id]) => id);
  const earth = nodesOf("Earth");
  const earthProxima = nodesOf("Earth_SPACE");

  test("종속 프록시마가 남아 있으면 행성은 완료가 아니다", () => {
    expect(isBodyComplete(graph, new Set(earth), "Earth")).toBe(false);
    expect(
      isBodyComplete(graph, new Set([...earth, ...earthProxima]), "Earth"),
    ).toBe(true);
  });

  test("프록시마가 없는 행성은 자기 노드만으로 완료된다", () => {
    expect(isBodyComplete(graph, new Set(nodesOf("Mars")), "Mars")).toBe(true);
    expect(isBodyComplete(graph, new Set(), "Mars")).toBe(false);
  });
});
