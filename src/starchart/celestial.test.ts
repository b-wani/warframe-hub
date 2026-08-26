import { describe, expect, test } from "vitest";
import starchartJson from "@/data/starchart.json";
import { CELESTIAL_BODIES, buildCelestialPositions } from "./celestial";
import { placedGroupIds, type StarchartDataset } from "./dataset";

const dataset = starchartJson as unknown as StarchartDataset;
const groupIds = placedGroupIds(dataset);
const { positions, issues } = buildCelestialPositions(groupIds);
const radius = (id: string) => Math.hypot(positions[id].x, positions[id].y);
const distance = (a: string, b: string) =>
  Math.hypot(positions[a].x - positions[b].x, positions[a].y - positions[b].y);

describe("천체 배치표", () => {
  test("정제 노드 데이터셋의 좌표 대상 그룹을 빠짐없이 덮는다", () => {
    expect(issues).toEqual([]);
    expect(Object.keys(positions).sort()).toEqual([...groupIds].sort());
  });

  test("릴레이 그룹은 표에 없다 — 지도에서 숨기므로 좌표 대상이 아니다", () => {
    expect(CELESTIAL_BODIES.map((b) => b.id)).not.toContain(
      "RelayStationSanctuary",
    );
  });

  test("종속 천체의 host는 전부 표 안의 행성이다", () => {
    const primaries = new Set(
      CELESTIAL_BODIES.filter((b) => b.kind === "primary").map((b) => b.id),
    );
    for (const body of CELESTIAL_BODIES) {
      if ("host" in body) expect(primaries).toContain(body.host);
    }
  });
});

describe("buildCelestialPositions", () => {
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
    const radii = order.map(radius);
    expect(radii).toEqual([...radii].sort((a, b) => a - b));
  });

  test("위성은 자기 행성 옆에 붙는다", () => {
    expect(distance("Moon", "Earth")).toBeLessThan(distance("Earth", "Mars"));
    expect(distance("Phobos", "Mars")).toBeLessThan(distance("Mars", "Ceres"));
    expect(distance("Europa", "Jupiter")).toBeLessThan(
      distance("Jupiter", "Saturn"),
    );
  });

  test("프록시마는 자기 행성의 바깥쪽에 놓인다", () => {
    for (const [proxima, host] of [
      ["Earth_SPACE", "Earth"],
      ["Venus_SPACE", "Venus"],
      ["Pluto_SPACE", "Pluto"],
    ] as const) {
      expect(radius(proxima)).toBeGreaterThan(radius(host));
      expect(distance(proxima, host)).toBeLessThan(radius(host));
    }
  });

  test("특수 구역과 베일 프록시마는 마지막 행성보다 바깥에 놓인다", () => {
    for (const id of [
      "Void",
      "Fortress",
      "ZarimanRegionName",
      "Duviri",
      "1999MapName",
      "DeepSpace_SPACE",
    ]) {
      expect(radius(id)).toBeGreaterThan(radius("TauRegion"));
    }
  });

  test("좌표는 전부 정수다 — 손으로 고치는 파일이다", () => {
    for (const { x, y } of Object.values(positions)) {
      expect(Number.isInteger(x)).toBe(true);
      expect(Number.isInteger(y)).toBe(true);
    }
  });

  test("같은 자리에 겹치는 천체가 없다", () => {
    const seen = new Set(Object.values(positions).map((p) => `${p.x},${p.y}`));
    expect(seen.size).toBe(Object.keys(positions).length);
  });

  test("표에 없는 그룹이 들어오면 오류로 보고한다", () => {
    const result = buildCelestialPositions(["Mercury", "NewPlanet"]);
    expect(result.issues).toContain(
      '천체 배치표에 없는 그룹: "NewPlanet" (src/starchart/celestial.ts에 추가해야 한다)',
    );
    expect(result.positions).not.toHaveProperty("NewPlanet");
  });

  test("데이터셋에서 사라진 그룹이 표에 남아 있으면 오류로 보고한다", () => {
    const result = buildCelestialPositions(["Mercury"]);
    expect(result.issues.some((i) => i.includes("Venus"))).toBe(true);
  });
});
