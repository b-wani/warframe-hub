/**
 * 성계 뷰에 놓이는 천체의 초기 배치.
 *
 * 스펙 §2.1이 요구하는 "실제 천문 순서"를 규칙으로 옮긴 표다 — 행성은 태양에서의
 * 궤도 순서대로 반지름이 커지고, 위성은 자기 행성 옆에, 프록시마는 자기 행성
 * 바깥쪽에 붙는다. 궤도 반지름 순서만이 천문학적으로 의미 있는 부분이고 각도는
 * 임의다(실제 행성도 공전한다) — 겹치지 않게 황금각으로 벌려 놓은 출발점이며,
 * 보기 좋은 배치는 좌표 데이터셋을 직접 고쳐서 만든다.
 *
 * 궤도 순서가 없는 특수 구역(보이드·쿠바 요새·자리만·두비리·홀바니아)과 host가
 * 없는 베일 프록시마는 마지막 행성 바깥의 고리에 균등 배치한다 — 놓을 천문학적
 * 자리가 없으므로 손보정 대상이라는 뜻이다.
 *
 * 릴레이 그룹은 지도에서 숨기므로 이 표에 없다.
 */
import type { Point } from "./force-layout.ts";

type CelestialBody =
  /** 태양을 도는 천체 — 표에 적힌 순서가 곧 궤도 순서다. */
  | { id: string; kind: "primary" }
  /** 행성을 도는 위성. */
  | { id: string; kind: "satellite"; host: string }
  /** 행성에 종속된 레일잭 궤도 구역. */
  | { id: string; kind: "proxima"; host: string }
  /** 궤도 순서가 없어 바깥 고리에 두는 천체. */
  | { id: string; kind: "outer" };

export const CELESTIAL_BODIES: CelestialBody[] = [
  { id: "Mercury", kind: "primary" },
  { id: "Venus", kind: "primary" },
  { id: "Venus_SPACE", kind: "proxima", host: "Venus" },
  { id: "Earth", kind: "primary" },
  { id: "Moon", kind: "satellite", host: "Earth" },
  { id: "Earth_SPACE", kind: "proxima", host: "Earth" },
  { id: "Mars", kind: "primary" },
  { id: "Phobos", kind: "satellite", host: "Mars" },
  { id: "SolarMapDeimosName", kind: "satellite", host: "Mars" },
  { id: "Ceres", kind: "primary" },
  { id: "Jupiter", kind: "primary" },
  { id: "Europa", kind: "satellite", host: "Jupiter" },
  { id: "Saturn", kind: "primary" },
  { id: "Saturn_SPACE", kind: "proxima", host: "Saturn" },
  { id: "Uranus", kind: "primary" },
  { id: "Uranus_SPACE", kind: "proxima", host: "Uranus" },
  { id: "Neptune", kind: "primary" },
  { id: "Neptune_SPACE", kind: "proxima", host: "Neptune" },
  { id: "Pluto", kind: "primary" },
  { id: "Pluto_SPACE", kind: "proxima", host: "Pluto" },
  { id: "Eris", kind: "primary" },
  { id: "Sedna", kind: "primary" },
  // 타우 성계 — 태양계 밖이라 가장 바깥 궤도에 둔다
  { id: "TauRegion", kind: "primary" },
  { id: "Void", kind: "outer" },
  { id: "Fortress", kind: "outer" },
  { id: "ZarimanRegionName", kind: "outer" },
  { id: "Duviri", kind: "outer" },
  { id: "1999MapName", kind: "outer" },
  // 베일 프록시마만 host가 없다 — 프록시마는 해당 행성에 종속 표시하지만(스펙
  // §2.1) 베일은 인게임에서도 특정 행성에 붙지 않는 심우주 구역이다
  { id: "DeepSpace_SPACE", kind: "outer" },
];

export const CELESTIAL_PARAMS = {
  /** 첫 궤도의 반지름. */
  orbitBase: 260,
  /** 궤도 하나를 지날 때마다 늘어나는 반지름. */
  orbitStep: 180,
  /** 위성이 자기 행성에서 떨어지는 거리. */
  satelliteRadius: 70,
  /** 프록시마가 자기 행성 바깥으로 밀려나는 거리. */
  proximaOffset: 120,
  /** 바깥 고리가 마지막 궤도에서 떨어지는 거리. */
  outerGap: 240,
} as const;

/** 황금각 — 궤도를 겹치지 않게 벌리는 각도. */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

const round = (p: Point): Point => ({ x: Math.round(p.x), y: Math.round(p.y) });
const polar = (radius: number, angle: number): Point => ({
  x: radius * Math.cos(angle),
  y: radius * Math.sin(angle),
});

/**
 * 좌표 대상 그룹의 천체 위치를 계산한다. 표와 데이터셋이 어긋나면
 * (새 그룹이 생겼거나 사라진 그룹이 표에 남았거나) 좌표 대신 오류로 알린다 —
 * 게임 패치로 그룹이 바뀌면 여기서 드러나야 한다.
 */
export function buildCelestialPositions(groupIds: string[]): {
  positions: Record<string, Point>;
  issues: string[];
} {
  const orbitOf = new Map<string, number>();
  const angleOf = new Map<string, number>();
  const center = new Map<string, Point>();
  const satelliteOrdinal = new Map<string, number>();
  const satellitesSeen = new Map<string, number>();
  let outerCount = 0;

  for (const body of CELESTIAL_BODIES) {
    if (body.kind === "primary") {
      const orbit = orbitOf.size;
      orbitOf.set(body.id, orbit);
      const angle = orbit * GOLDEN_ANGLE;
      angleOf.set(body.id, angle);
      center.set(
        body.id,
        polar(
          CELESTIAL_PARAMS.orbitBase + orbit * CELESTIAL_PARAMS.orbitStep,
          angle,
        ),
      );
    } else if (body.kind === "satellite") {
      const ordinal = satellitesSeen.get(body.host) ?? 0;
      satellitesSeen.set(body.host, ordinal + 1);
      satelliteOrdinal.set(body.id, ordinal);
    } else if (body.kind === "outer") {
      outerCount++;
    }
  }

  const outerRadius =
    CELESTIAL_PARAMS.orbitBase +
    (orbitOf.size - 1) * CELESTIAL_PARAMS.orbitStep +
    CELESTIAL_PARAMS.outerGap;

  const positions: Record<string, Point> = {};
  let outerSlot = 0;
  for (const body of CELESTIAL_BODIES) {
    if (body.kind === "primary") {
      positions[body.id] = round(center.get(body.id)!);
      continue;
    }
    if (body.kind === "outer") {
      positions[body.id] = round(
        polar(outerRadius, (outerSlot++ / outerCount) * Math.PI * 2),
      );
      continue;
    }
    const host = center.get(body.host);
    if (!host) continue; // host 무결성은 아래 issues에서 잡는다
    if (body.kind === "satellite") {
      // 같은 행성의 위성끼리 겹치지 않게 120°씩 벌린다
      const angle =
        angleOf.get(body.host)! +
        (satelliteOrdinal.get(body.id)! * Math.PI * 2) / 3;
      const offset = polar(CELESTIAL_PARAMS.satelliteRadius, angle);
      positions[body.id] = round({ x: host.x + offset.x, y: host.y + offset.y });
    } else {
      // 행성에서 태양 반대 방향으로 밀어낸다 — 행성 바깥 고리
      const offset = polar(
        CELESTIAL_PARAMS.proximaOffset,
        angleOf.get(body.host)!,
      );
      positions[body.id] = round({ x: host.x + offset.x, y: host.y + offset.y });
    }
  }

  const issues: string[] = [];
  for (const body of CELESTIAL_BODIES) {
    if ("host" in body && !center.has(body.host)) {
      issues.push(
        `천체 배치표의 host가 행성이 아니다: "${body.id}" → "${body.host}"`,
      );
    }
  }
  const wanted = new Set(groupIds);
  for (const id of groupIds) {
    if (!(id in positions)) {
      issues.push(
        `천체 배치표에 없는 그룹: "${id}" (src/starchart/celestial.ts에 추가해야 한다)`,
      );
    }
  }
  for (const id of Object.keys(positions)) {
    if (!wanted.has(id)) {
      issues.push(
        `천체 배치표에만 있고 데이터셋에 없는 그룹: "${id}" (src/starchart/celestial.ts에서 지워야 한다)`,
      );
      delete positions[id];
    }
  }
  return { positions, issues };
}
