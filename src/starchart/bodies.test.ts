import { describe, expect, test } from "vitest";
import { STARFIELD_TEXTURE, SUN, solarSystemBodies } from "./bodies";
import {
  starchartDataset as dataset,
  starchartLayout as layout,
} from "./data";
import { TEXTURE_FILES } from "./textures";

const { bodies, issues } = solarSystemBodies(dataset, layout);
const byId = new Map(bodies.map((body) => [body.id, body]));
const orbitRadius = (id: string) => {
  const [x, , z] = byId.get(id)!.position;
  return Math.hypot(x, z);
};
const distance = (a: string, b: string) => {
  const [ax, , az] = byId.get(a)!.position;
  const [bx, , bz] = byId.get(b)!.position;
  return Math.hypot(ax - bx, az - bz);
};

describe("solarSystemBodies", () => {
  test("성계 뷰에 행성/위성 17 + 특수 구역 5가 놓인다", () => {
    expect(issues).toEqual([]);
    const types = bodies.map((body) => dataset.groups[body.id].type);
    expect(types.filter((t) => t === "planet")).toHaveLength(17);
    expect(types.filter((t) => t === "special")).toHaveLength(5);
    expect(bodies).toHaveLength(22);
  });

  test("릴레이는 지도에서 숨긴다", () => {
    expect(byId.has("RelayStationSanctuary")).toBe(false);
  });

  test("프록시마는 독립 천체가 아니다 — 해당 행성에 종속 표시한다", () => {
    for (const id of Object.keys(dataset.groups)) {
      if (dataset.groups[id].type === "proxima") expect(byId.has(id)).toBe(false);
    }
  });

  test("표시명은 정제 노드 데이터셋의 것을 그대로 쓴다", () => {
    expect(byId.get("Earth")!.name).toBe("지구");
    expect(byId.get("Fortress")!.name).toBe("쿠바 요새");
  });

  test("천체는 태양을 원점으로 한 황도면 위에 놓인다", () => {
    for (const body of bodies) expect(body.position[1]).toBe(0);
    expect(orbitRadius("Mercury")).toBeGreaterThan(0);
  });

  test("행성은 실제 천문 순서대로 태양에서 멀어진다", () => {
    const order = [
      "Mercury",
      "Venus",
      "Earth",
      "Mars",
      "Ceres",
      "Jupiter",
      "Saturn",
      "Uranus",
      "Neptune",
      "Pluto",
      "Eris",
      "Sedna",
      "TauRegion",
    ];
    const radii = order.map(orbitRadius);
    expect(radii).toEqual([...radii].sort((a, b) => a - b));
  });

  test("위성은 자기 행성 옆에 붙는다", () => {
    expect(distance("Moon", "Earth")).toBeLessThan(distance("Earth", "Mars"));
    expect(distance("Europa", "Jupiter")).toBeLessThan(
      distance("Jupiter", "Saturn"),
    );
  });

  test("천체끼리 겹치지 않는다 — 대기 셸까지 포함해서", () => {
    const overlapping: string[] = [];
    for (const a of bodies) {
      for (const b of bodies) {
        if (a.id >= b.id) continue;
        const gap = distance(a.id, b.id) - (a.shellRadius + b.shellRadius);
        if (gap <= 0) overlapping.push(`${a.id}↔${b.id}`);
      }
    }
    expect(overlapping).toEqual([]);
  });

  test("간격은 가장 가까운 다른 천체까지의 거리다", () => {
    for (const body of bodies) {
      const closest = Math.min(
        ...bodies
          .filter((other) => other.id !== body.id)
          .map((other) => distance(body.id, other.id)),
      );
      expect(body.spacing).toBeCloseTo(closest);
    }
    // 히트 영역의 상한으로 쓰이므로 늘 유한한 양수여야 한다. 위성을 곁에 둔
    // 행성은 이 값의 절반이 자기 셸보다도 좁은데, 히트 영역이 시각 크기 아래로
    // 내려가지 않게 막는 것은 `tapRadius` 쪽 일이다.
    for (const body of bodies) {
      expect(body.spacing).toBeGreaterThan(0);
      expect(Number.isFinite(body.spacing)).toBe(true);
    }
  });

  test("링은 해당 행성에만 있다 — v1은 토성뿐", () => {
    expect(bodies.filter((body) => body.ring).map((body) => body.id)).toEqual([
      "Saturn",
    ]);
    const saturn = byId.get("Saturn")!;
    expect(saturn.ring!.inner).toBeGreaterThan(saturn.radius);
    expect(saturn.ring!.outer).toBeGreaterThan(saturn.ring!.inner);
  });

  test("모든 천체가 텍스처 구체 + 대기 셸 + tint를 갖는다", () => {
    for (const body of bodies) {
      expect(TEXTURE_FILES).toContain(body.texture);
      expect(body.tint).toMatch(/^#[0-9a-f]{6}$/);
      expect(body.atmosphere).toMatch(/^#[0-9a-f]{6}$/);
      expect(body.shellRadius).toBeGreaterThan(body.radius);
    }
  });

  test("태양과 별 배경도 카탈로그의 텍스처를 쓴다", () => {
    expect(TEXTURE_FILES).toContain(SUN.texture);
    expect(TEXTURE_FILES).toContain(STARFIELD_TEXTURE);
    expect(SUN.radius).toBeGreaterThan(0);
  });

  test("좌표가 빠진 천체는 문제로 보고한다", () => {
    const { bodies: partial, issues: reported } = solarSystemBodies(dataset, {
      ...layout,
      groups: Object.fromEntries(
        Object.entries(layout.groups).filter(([id]) => id !== "Earth"),
      ),
    });
    expect(partial.map((b) => b.id)).not.toContain("Earth");
    expect(reported).toEqual([expect.stringContaining("Earth")]);
  });

  test("비주얼 표에 없는 그룹이 생기면 문제로 보고한다", () => {
    const { issues: reported } = solarSystemBodies(
      {
        ...dataset,
        groups: {
          ...dataset.groups,
          NewPlanet: { name: "새 행성", type: "planet" },
        },
      },
      { ...layout, groups: { ...layout.groups, NewPlanet: { x: 9000, y: 0 } } },
    );
    expect(reported).toEqual([expect.stringContaining("NewPlanet")]);
  });
});
