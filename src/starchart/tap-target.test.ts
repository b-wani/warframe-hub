import { describe, expect, test } from "vitest";
import { solarSystemBodies } from "./bodies";
import { SOLAR_VIEW_FOV, planetViewShot } from "./camera";
import {
  starchartDataset as dataset,
  starchartLayout as layout,
} from "./data";
import { NODE_RADIUS, nodeClouds, type NodeCloud } from "./node-cloud";
import {
  MIN_TAP_PX,
  nearestSpacings,
  tapRadius,
  worldPerPixel,
} from "./tap-target";
import { proximaRings } from "./proxima";

const { bodies } = solarSystemBodies(dataset, layout);
const { clouds } = nodeClouds(dataset, layout, bodies);
const { rings } = proximaRings(dataset, layout, bodies);

/** 스펙 §8-4가 말하는 좁은 폭의 양 끝과, 그보다도 낮은 화면. */
const PHONES = {
  "360x640": { width: 360, height: 640 },
  "390x844": { width: 390, height: 844 },
  "430x932": { width: 430, height: 932 },
};

/** 행성 뷰의 기본 프레이밍에서 카메라가 구름 중심에서 떨어진 거리. */
function planetViewDistance(
  bodyId: string,
  cloud: NodeCloud,
  width: number,
  height: number,
): number {
  const body = bodies.find((candidate) => candidate.id === bodyId)!;
  const { position, target } = planetViewShot(body, cloud, width / height);
  return Math.hypot(
    position[0] - target[0],
    position[1] - target[1],
    position[2] - target[2],
  );
}

describe("worldPerPixel", () => {
  test("화각 안에 들어오는 월드 길이를 화면 픽셀로 나눈 값이다", () => {
    const height = 800;
    const distance = 10;
    const visible =
      2 * distance * Math.tan(((SOLAR_VIEW_FOV / 2) * Math.PI) / 180);
    expect(worldPerPixel(distance, height)).toBeCloseTo(visible / height, 10);
  });

  test("멀수록 크고, 화면이 촘촘할수록 작다", () => {
    expect(worldPerPixel(20, 800)).toBeCloseTo(2 * worldPerPixel(10, 800), 10);
    expect(worldPerPixel(10, 1600)).toBeCloseTo(
      worldPerPixel(10, 800) / 2,
      10,
    );
  });
});

describe("tapRadius", () => {
  const spacious = { distance: 10, viewportHeight: 800, spacing: 100 };

  test("자리가 넉넉하면 화면에서 44px을 차지한다", () => {
    const radius = tapRadius({ ...spacious, visualRadius: NODE_RADIUS });
    expect(radius / worldPerPixel(10, 800)).toBeCloseTo(MIN_TAP_PX / 2, 6);
  });

  test("이웃의 중심까지 삼키지는 않는다 — 간격의 절반이 상한이다", () => {
    const radius = tapRadius({
      ...spacious,
      spacing: 0.4,
      visualRadius: NODE_RADIUS,
    });
    expect(radius).toBeCloseTo(0.2, 10);
  });

  test("상한이 마름모보다 작아도 보이는 것만큼은 눌린다", () => {
    // 시각 크기보다 작은 히트 영역은 "눌리는 것처럼 보이는데 안 눌린다"가 된다
    const radius = tapRadius({
      ...spacious,
      spacing: 0.1,
      visualRadius: NODE_RADIUS,
    });
    expect(radius).toBe(NODE_RADIUS);
  });

  test("어떤 경우에도 시각 크기보다 작아지지 않는다", () => {
    for (const spacing of [0.01, 0.2, 0.5, 1, 4]) {
      for (const distance of [5, 20, 60]) {
        expect(
          tapRadius({
            distance,
            viewportHeight: 640,
            spacing,
            visualRadius: NODE_RADIUS,
          }),
        ).toBeGreaterThanOrEqual(NODE_RADIUS);
      }
    }
  });
});

describe("노드 구름의 실제 배치", () => {
  const all: [string, NodeCloud][] = [
    ...clouds.entries(),
    ...[...rings.values()].map(
      (ring) => [ring.cloud.body, ring.cloud] as [string, NodeCloud],
    ),
  ];

  /** 행성 뷰 기본 프레이밍에서 노드 하나의 히트 지름(화면 px). */
  function tapDiameterPx(
    bodyId: string,
    cloud: NodeCloud,
    node: NodeCloud["nodes"][number],
    width: number,
    height: number,
  ): number {
    const distance = planetViewDistance(bodyId, cloud, width, height);
    const radius = tapRadius({
      distance,
      viewportHeight: height,
      spacing: node.spacing,
      visualRadius: NODE_RADIUS,
    });
    return (2 * radius) / worldPerPixel(distance, height);
  }

  for (const [label, { width, height }] of Object.entries(PHONES)) {
    test(`${label}에서 노드 히트 영역이 마름모보다 크다`, () => {
      const tight: string[] = [];
      for (const [bodyId, cloud] of all) {
        for (const node of cloud.nodes) {
          const visualPx =
            (2 * NODE_RADIUS) /
            worldPerPixel(
              planetViewDistance(bodyId, cloud, width, height),
              height,
            );
          if (tapDiameterPx(bodyId, cloud, node, width, height) <= visualPx) {
            tight.push(node.id);
          }
        }
      }
      expect(tight).toEqual([]);
    });

    test(`${label}에서 노드 히트 영역이 화면 20px을 넘는다`, () => {
      // 44px은 배치가 허락하는 곳에서만 채워진다(가장 촘촘한 두 노드는 화면에서
      // 23px 떨어져 있어 44px을 줄 자리가 애초에 없다) — 그래도 어느 노드든
      // 마름모(8~19px)보다는 확실히 커야 한다.
      const worst = Math.min(
        ...all.flatMap(([bodyId, cloud]) =>
          cloud.nodes.map((node) =>
            tapDiameterPx(bodyId, cloud, node, width, height),
          ),
        ),
      );
      expect(worst).toBeGreaterThan(20);
    });

    test(`${label}에서 노드 절반 이상이 44px을 그대로 받는다`, () => {
      const nodes = all.flatMap(([bodyId, cloud]) =>
        cloud.nodes.map((node) =>
          tapDiameterPx(bodyId, cloud, node, width, height),
        ),
      );
      const full = nodes.filter((px) => px > MIN_TAP_PX - 0.001);
      expect(full.length / nodes.length).toBeGreaterThan(0.5);
    });
  }

  test("성긴 구름에서는 44px을 그대로 채운다", () => {
    const duviri = clouds.get("Duviri")!;
    const { height, width } = PHONES["390x844"];
    for (const node of duviri.nodes) {
      expect(tapDiameterPx("Duviri", duviri, node, width, height)).toBeCloseTo(
        MIN_TAP_PX,
        6,
      );
    }
  });
});

describe("nearestSpacings", () => {
  test("각 점에서 가장 가까운 이웃까지의 거리를 돌려준다 — 높이는 보지 않는다", () => {
    expect(
      nearestSpacings([
        [0, 0, 0],
        [3, 99, 0],
        [3, 0, 4],
      ]),
    ).toEqual([3, 3, 4]);
  });

  test("이웃이 없으면 상한도 없다", () => {
    expect(nearestSpacings([[1, 2, 3]])).toEqual([Infinity]);
    expect(nearestSpacings([])).toEqual([]);
  });
});
