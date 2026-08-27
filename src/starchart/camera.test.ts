import { describe, expect, test } from "vitest";
import { solarSystemBodies } from "./bodies";
import {
  SOLAR_VIEW_FOV,
  planetViewShot,
  solarViewShot,
  type CameraShot,
} from "./camera";
import {
  starchartDataset as dataset,
  starchartLayout as layout,
} from "./data";
import { nodeClouds } from "./node-cloud";

const { bodies } = solarSystemBodies(dataset, layout);
const { clouds } = nodeClouds(dataset, layout, bodies);

const ASPECTS = {
  "16:9 데스크톱": 16 / 9,
  "4:3": 4 / 3,
  정사각: 1,
  "375x812 세로": 375 / 812,
};

const distanceOf = ({ position, target }: CameraShot) =>
  Math.hypot(
    position[0] - target[0],
    position[1] - target[1],
    position[2] - target[2],
  );

/**
 * 점이 화면 안에 들어오는지, 카메라 기저를 직접 세워서 본다.
 *
 * `frameDistance`가 쓰는 닫힌 식과 다른 경로로 계산해야 대수 실수를 잡는다 —
 * 여기서는 정석대로 forward·up·right 벡터를 외적으로 만들어 투영한다.
 */
function ndc(
  point: readonly [number, number, number],
  { position, target }: CameraShot,
  aspect: number,
): { x: number; y: number } {
  const sub = (a: readonly number[], b: readonly number[]) =>
    [a[0] - b[0], a[1] - b[1], a[2] - b[2]] as const;
  const dot = (a: readonly number[], b: readonly number[]) =>
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const norm = (a: readonly number[]) => {
    const length = Math.hypot(a[0], a[1], a[2]);
    return [a[0] / length, a[1] / length, a[2] / length] as const;
  };
  const cross = (a: readonly number[], b: readonly number[]) =>
    [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ] as const;

  const forward = norm(sub(target, position));
  const right = norm(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);

  const view = sub(point, position);
  const depth = dot(view, forward);
  const tan = Math.tan(((SOLAR_VIEW_FOV / 2) * Math.PI) / 180);
  return {
    x: dot(view, right) / (depth * tan * aspect),
    y: dot(view, up) / (depth * tan),
  };
}

const inside = ({ x, y }: { x: number; y: number }) =>
  Math.abs(x) <= 1 && Math.abs(y) <= 1;

describe("solarViewShot", () => {
  test("카메라는 황도면 위에서 태양을 내려다본다", () => {
    const { position, target } = solarViewShot(bodies, 16 / 9);
    expect(target).toEqual([0, 0, 0]);
    expect(position[0]).toBe(0);
    expect(position[1]).toBeGreaterThan(0);
    expect(position[2]).toBeGreaterThan(0);
  });

  for (const [label, aspect] of Object.entries(ASPECTS)) {
    test(`${label}에서 천체 22개가 라벨까지 프레임 안에 들어온다`, () => {
      const shot = solarViewShot(bodies, aspect);
      const outside: string[] = [];
      for (const body of bodies) {
        const [bx, , bz] = body.position;
        // 대기 셸의 가장자리와 아래에 붙는 라벨까지 봐야 한다
        const corners: [number, number, number][] = [
          [bx, body.labelY, bz],
          [bx + body.shellRadius, 0, bz],
          [bx - body.shellRadius, 0, bz],
          [bx, body.shellRadius, bz],
        ];
        for (const corner of corners) {
          if (!inside(ndc(corner, shot, aspect))) outside.push(body.id);
        }
      }
      expect([...new Set(outside)]).toEqual([]);
    });
  }

  test("세로 화면은 더 멀리서 봐야 한다 — 좁은 폭이 성계를 자른다", () => {
    const at = (aspect: number) => distanceOf(solarViewShot(bodies, aspect));
    expect(at(375 / 812)).toBeGreaterThan(at(16 / 9));
    expect(at(1)).toBeGreaterThan(at(16 / 9));
  });

  test("천체가 하나면 그것만 담을 거리를 돌려준다", () => {
    const one = distanceOf(solarViewShot([bodies[0]], 16 / 9));
    expect(one).toBeLessThan(distanceOf(solarViewShot(bodies, 16 / 9)));
    expect(one).toBeGreaterThan(0);
  });
});

describe("planetViewShot", () => {
  test("카메라는 노드 구름의 중심을 본다", () => {
    const earth = clouds.get("Earth")!;
    const body = bodies.find((candidate) => candidate.id === "Earth")!;
    const { position, target } = planetViewShot(body, earth, 16 / 9);
    expect(target).toEqual(earth.center);
    expect(position[0]).toBe(earth.center[0]);
    expect(position[1]).toBeGreaterThan(earth.center[1]);
    expect(position[2]).toBeGreaterThan(earth.center[2]);
  });

  for (const [label, aspect] of Object.entries(ASPECTS)) {
    test(`${label}에서 노드 307개와 행성이 프레임 안에 들어온다`, () => {
      const outside: string[] = [];
      for (const body of bodies) {
        const cloud = clouds.get(body.id)!;
        const shot = planetViewShot(body, cloud, aspect);
        for (const node of cloud.nodes) {
          if (!inside(ndc(node.position, shot, aspect))) outside.push(node.id);
        }
        // 행성이 원반 아래에 남아야 "어느 행성인가"가 보인다
        const [bx, by, bz] = body.position;
        for (const corner of [
          [bx, by + body.labelY, bz],
          [bx + body.shellRadius, by, bz],
          [bx - body.shellRadius, by, bz],
        ] as [number, number, number][]) {
          if (!inside(ndc(corner, shot, aspect))) outside.push(body.id);
        }
      }
      expect([...new Set(outside)]).toEqual([]);
    });
  }

  test("세로 화면은 더 멀리서 봐야 한다", () => {
    const body = bodies.find((candidate) => candidate.id === "Mars")!;
    const cloud = clouds.get("Mars")!;
    const at = (aspect: number) =>
      distanceOf(planetViewShot(body, cloud, aspect));
    expect(at(375 / 812)).toBeGreaterThan(at(16 / 9));
  });

  test("행성 뷰는 성계 뷰보다 훨씬 가깝다 — 그래서 비행이 접근으로 읽힌다", () => {
    const solar = distanceOf(solarViewShot(bodies, 16 / 9));
    for (const body of bodies) {
      const planet = distanceOf(
        planetViewShot(body, clouds.get(body.id)!, 16 / 9),
      );
      expect(planet).toBeLessThan(solar / 4);
    }
  });

  test("어떤 행성에서도 카메라가 지표면 안으로 들어가지 않는다", () => {
    for (const body of bodies) {
      const shot = planetViewShot(body, clouds.get(body.id)!, 16 / 9);
      const gap = Math.hypot(
        shot.position[0] - body.position[0],
        shot.position[1] - body.position[1],
        shot.position[2] - body.position[2],
      );
      expect(gap).toBeGreaterThan(body.shellRadius);
    }
  });
});
