import { describe, expect, test } from "vitest";
import { solarSystemBodies } from "./bodies";
import {
  starchartDataset as dataset,
  starchartLayout as layout,
} from "./data";
import {
  NODE_RADIUS,
  NODE_SCALE,
  nodeCloud,
  nodeClouds,
} from "./node-cloud";

const { bodies } = solarSystemBodies(dataset, layout);
const byId = new Map(bodies.map((body) => [body.id, body]));
const { clouds, issues } = nodeClouds(dataset, layout, bodies);

const cloudOf = (id: string) => clouds.get(id)!;
const allNodes = [...clouds.values()].flatMap((cloud) => cloud.nodes);

describe("nodeClouds", () => {
  test("성계 뷰의 천체 22개가 저마다 노드 구름을 갖는다", () => {
    expect(issues).toEqual([]);
    expect(clouds.size).toBe(bodies.length);
    for (const body of bodies) {
      expect(cloudOf(body.id).nodes.length).toBeGreaterThan(0);
    }
  });

  test("천체 그룹의 노드를 하나도 빠뜨리지 않는다", () => {
    const expected = Object.entries(dataset.nodes).filter(([, node]) =>
      byId.has(node.group),
    );
    expect(allNodes).toHaveLength(expected.length);
    expect(new Set(allNodes.map((node) => node.id))).toEqual(
      new Set(expected.map(([id]) => id)),
    );
  });

  test("프록시마와 릴레이는 구름이 없다 — 성계 뷰의 천체가 아니다", () => {
    expect(clouds.has("Earth_SPACE")).toBe(false);
    expect(clouds.has("RelayStationSanctuary")).toBe(false);
  });

  test("표시명은 정제 노드 데이터셋의 것을 그대로 쓴다", () => {
    const nodes = new Map(allNodes.map((node) => [node.id, node]));
    expect(nodes.get("SolNode27")!.name).toBe("E Prime");
    expect(nodes.get("EarthToVenusJunction")!.name).toBe("금성 교차점");
  });

  test("구름은 천체 위에 뜬 수평 원반이다", () => {
    for (const body of bodies) {
      const cloud = cloudOf(body.id);
      expect(cloud.center[0]).toBe(body.position[0]);
      expect(cloud.center[2]).toBe(body.position[2]);
      expect(cloud.center[1]).toBeGreaterThan(
        body.position[1] + body.shellRadius,
      );
      for (const node of cloud.nodes) {
        expect(node.position[1]).toBe(cloud.center[1]);
      }
    }
  });

  test("어떤 노드도 자기 행성 안에 파묻히지 않는다", () => {
    const buried: string[] = [];
    for (const body of bodies) {
      for (const node of cloudOf(body.id).nodes) {
        const distance = Math.hypot(
          node.position[0] - body.position[0],
          node.position[1] - body.position[1],
          node.position[2] - body.position[2],
        );
        if (distance <= body.shellRadius + NODE_RADIUS) buried.push(node.id);
      }
    }
    expect(buried).toEqual([]);
  });

  test("반지름은 중심에서 가장 먼 노드까지의 거리다", () => {
    for (const cloud of clouds.values()) {
      const far = Math.max(
        ...cloud.nodes.map(({ position }) =>
          Math.hypot(
            position[0] - cloud.center[0],
            position[2] - cloud.center[2],
          ),
        ),
      );
      expect(cloud.radius).toBeCloseTo(far);
      expect(cloud.radius).toBeGreaterThan(0);
    }
  });

  test("최소 간격은 가장 가까운 두 노드 사이의 거리다", () => {
    for (const cloud of clouds.values()) {
      let closest = Infinity;
      for (let i = 0; i < cloud.nodes.length; i++) {
        for (let j = i + 1; j < cloud.nodes.length; j++) {
          const a = cloud.nodes[i].position;
          const b = cloud.nodes[j].position;
          closest = Math.min(closest, Math.hypot(a[0] - b[0], a[2] - b[2]));
        }
      }
      expect(cloud.minSpacing).toBeCloseTo(closest);
    }
  });

  test("이웃이 없으면 간격도 없다 — 히트 영역에 상한이 없다는 뜻이다", () => {
    const empty = nodeCloud(dataset, layout, {
      body: bodies[0],
      group: "없는그룹",
    }).cloud;
    expect(empty.nodes).toEqual([]);
    expect(empty.minSpacing).toBe(Infinity);
  });

  test("좌표 데이터셋의 상대 배치를 배율만 바꿔 옮긴다", () => {
    const cloud = cloudOf("Earth");
    for (const node of cloud.nodes) {
      const point = layout.nodes[node.id];
      expect(node.position[0] - cloud.center[0]).toBeCloseTo(
        point.x * NODE_SCALE,
      );
      expect(node.position[2] - cloud.center[2]).toBeCloseTo(
        point.y * NODE_SCALE,
      );
    }
  });

  test("노드끼리 겹치지 않는다", () => {
    const overlapping: string[] = [];
    for (const cloud of clouds.values()) {
      for (const a of cloud.nodes) {
        for (const b of cloud.nodes) {
          if (a.id >= b.id) continue;
          const gap =
            Math.hypot(
              a.position[0] - b.position[0],
              a.position[2] - b.position[2],
            ) -
            NODE_RADIUS * 2;
          if (gap <= 0) overlapping.push(`${a.id}↔${b.id}`);
        }
      }
    }
    expect(overlapping).toEqual([]);
  });

  test("연결선은 자기 두 끝 노드를 안다 — 상태에 따라 실선·점선이 갈린다", () => {
    for (const cloud of clouds.values()) {
      const byId = new Map(cloud.nodes.map((node) => [node.id, node]));
      for (const link of cloud.links) {
        expect(byId.get(link.from)!.position).toEqual(link.points[0]);
        expect(byId.get(link.to)!.position).toEqual(link.points[1]);
      }
    }
    // 지구의 첫 미션 E Prime → Mariana 는 데이터셋에 있는 연결이다
    const pairs = new Set(
      cloudOf("Earth").links.map((link) =>
        [link.from, link.to].sort().join("|"),
      ),
    );
    expect(pairs.has("SolNode27|SolNode89")).toBe(true);
  });

  test("같은 간선을 두 번 긋지 않는다 — 방향은 선에 없다", () => {
    for (const cloud of clouds.values()) {
      const drawn = new Set<string>();
      for (const link of cloud.links) {
        const key = [link.from, link.to].sort().join("|");
        expect(drawn.has(key)).toBe(false);
        drawn.add(key);
      }
    }
  });

  test("그룹 밖을 가리키는 간선은 긋지 않는다", () => {
    // 지구의 교차점은 금성·화성 노드를 가리킨다 — 지구 구름의 선이 아니다
    const junction = dataset.nodes["EarthToVenusJunction"];
    expect(
      junction.nextNodes.some((id) => dataset.nodes[id].group !== "Earth"),
    ).toBe(true);
    const inside = new Set(cloudOf("Earth").nodes.map((node) => node.id));
    for (const link of cloudOf("Earth").links) {
      expect(inside.has(link.from)).toBe(true);
      expect(inside.has(link.to)).toBe(true);
    }
  });

  test("교차점은 표시 모델이 구별해 알려 준다 — 화면이 미션 유형을 몰라도 된다", () => {
    const earth = cloudOf("Earth");
    const junctions = earth.nodes.filter((node) => node.junction);
    expect(junctions.map((node) => node.id).sort()).toEqual([
      "EarthToMarsJunction",
      "EarthToVenusJunction",
    ]);
    expect(earth.nodes.find((node) => node.id === "SolNode27")!.junction).toBe(
      false,
    );
    // 데이터셋의 교차점 13개는 모두 어느 구름에선가 교차점으로 뜬다
    expect(allNodes.filter((node) => node.junction)).toHaveLength(
      Object.values(dataset.nodes).filter(
        (node) => node.missionType === "MT_JUNCTION",
      ).length,
    );
  });

  test("좌표가 빠진 노드는 문제로 보고한다", () => {
    const { clouds: partial, issues: reported } = nodeClouds(
      dataset,
      {
        ...layout,
        nodes: Object.fromEntries(
          Object.entries(layout.nodes).filter(([id]) => id !== "SolNode27"),
        ),
      },
      bodies,
    );
    expect(partial.get("Earth")!.nodes.map((node) => node.id)).not.toContain(
      "SolNode27",
    );
    expect(reported).toEqual([expect.stringContaining("SolNode27")]);
  });
});
