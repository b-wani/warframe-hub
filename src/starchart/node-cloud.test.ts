import { describe, expect, test } from "vitest";
import { solarSystemBodies } from "./bodies";
import {
  starchartDataset as dataset,
  starchartLayout as layout,
} from "./data";
import { NODE_RADIUS, NODE_SCALE, nodeClouds } from "./node-cloud";

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

  test("연결선은 nextNodes 간선을 두 점씩 늘어놓은 것이다", () => {
    for (const cloud of clouds.values()) {
      expect(cloud.links.length % 2).toBe(0);
      const positions = new Set(
        cloud.nodes.map(({ position }) => position.join()),
      );
      for (const point of cloud.links) {
        expect(positions.has(point.join())).toBe(true);
      }
    }
    // 지구의 첫 미션 E Prime → Mariana 는 데이터셋에 있는 연결이다
    const earth = cloudOf("Earth");
    const at = (id: string) =>
      earth.nodes.find((node) => node.id === id)!.position.join();
    const pairs = new Set<string>();
    for (let i = 0; i < earth.links.length; i += 2) {
      pairs.add(
        [earth.links[i].join(), earth.links[i + 1].join()].sort().join("|"),
      );
    }
    expect(pairs.has([at("SolNode27"), at("SolNode89")].sort().join("|"))).toBe(
      true,
    );
  });

  test("같은 간선을 두 번 긋지 않는다 — 방향은 선에 없다", () => {
    for (const cloud of clouds.values()) {
      const drawn = new Set<string>();
      for (let i = 0; i < cloud.links.length; i += 2) {
        const key = [cloud.links[i].join(), cloud.links[i + 1].join()]
          .sort()
          .join("|");
        expect(drawn.has(key)).toBe(false);
        drawn.add(key);
      }
    }
  });

  test("그룹 밖을 가리키는 간선은 긋지 않는다", () => {
    // 지구의 교차점은 금성·화성 노드를 가리킨다 — 지구 구름의 선이 아니다
    const junction = dataset.nodes["EarthToVenusJunction"];
    expect(junction.nextNodes.some((id) => dataset.nodes[id].group !== "Earth"))
      .toBe(true);
    const inside = new Set(
      cloudOf("Earth").nodes.map(({ position }) => position.join()),
    );
    for (const point of cloudOf("Earth").links) {
      expect(inside.has(point.join())).toBe(true);
    }
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
