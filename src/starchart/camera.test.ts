import { describe, expect, test } from "vitest";
import { solarSystemBodies } from "./bodies";
import { SOLAR_VIEW_FOV, solarViewHome } from "./camera";
import {
  starchartDataset as dataset,
  starchartLayout as layout,
} from "./data";

const { bodies } = solarSystemBodies(dataset, layout);

const ASPECTS = {
  "16:9 데스크톱": 16 / 9,
  "4:3": 4 / 3,
  정사각: 1,
  "375x812 세로": 375 / 812,
};

/**
 * 천체가 화면 안에 들어오는지, 카메라 기저를 직접 세워서 본다.
 *
 * `solarViewHome`이 쓰는 닫힌 식과 다른 경로로 계산해야 대수 실수를 잡는다 —
 * 여기서는 정석대로 forward·up·right 벡터를 외적으로 만들어 투영한다.
 */
function ndc(
  point: readonly [number, number, number],
  camera: readonly [number, number, number],
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

  // 카메라는 원점을 본다
  const forward = norm(sub([0, 0, 0], camera));
  const right = norm(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);

  const view = sub(point, camera);
  const depth = dot(view, forward);
  const tan = Math.tan(((SOLAR_VIEW_FOV / 2) * Math.PI) / 180);
  return {
    x: dot(view, right) / (depth * tan * aspect),
    y: dot(view, up) / (depth * tan),
  };
}

describe("solarViewHome", () => {
  test("카메라는 황도면 위에서 태양을 내려다본다", () => {
    const [x, y, z] = solarViewHome(bodies, 16 / 9);
    expect(x).toBe(0);
    expect(y).toBeGreaterThan(0);
    expect(z).toBeGreaterThan(0);
  });

  for (const [label, aspect] of Object.entries(ASPECTS)) {
    test(`${label}에서 천체 22개가 라벨까지 프레임 안에 들어온다`, () => {
      const camera = solarViewHome(bodies, aspect);
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
          const { x, y } = ndc(corner, camera, aspect);
          if (Math.abs(x) > 1 || Math.abs(y) > 1) outside.push(body.id);
        }
      }
      expect([...new Set(outside)]).toEqual([]);
    });
  }

  test("세로 화면은 더 멀리서 봐야 한다 — 좁은 폭이 성계를 자른다", () => {
    const distance = (aspect: number) => {
      const [, y, z] = solarViewHome(bodies, aspect);
      return Math.hypot(y, z);
    };
    expect(distance(375 / 812)).toBeGreaterThan(distance(16 / 9));
    expect(distance(1)).toBeGreaterThan(distance(16 / 9));
  });

  test("천체가 하나면 그것만 담을 거리를 돌려준다", () => {
    const [single] = bodies;
    const [, y, z] = solarViewHome([single], 16 / 9);
    const all = solarViewHome(bodies, 16 / 9);
    expect(Math.hypot(y, z)).toBeLessThan(Math.hypot(all[1], all[2]));
    expect(Math.hypot(y, z)).toBeGreaterThan(0);
  });
});
