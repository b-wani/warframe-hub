/**
 * 그룹(행성) 안의 노드 구름 초기 배치를 만드는 force-directed 간이 시뮬레이션.
 *
 * 파라미터는 프로토타입 브랜치 `prototype/starchart-layout-workflow`에서 눈으로
 * 검증한 값(#29)을 그대로 옮긴 것이다 — 반발 12000 · 간선 스프링 90px ·
 * 중심 인력 0.003. 초기 배치가 각도 기반 고정 시드라 난수가 없고, 같은 입력이면
 * 항상 같은 좌표가 나온다.
 *
 * 좌표계는 그룹 로컬 — 원점(0,0)이 그룹 중심이다. 프로토타입은 900×620 캔버스의
 * 중심을 썼는데, 모든 힘이 평행이동에 불변이라 중심을 원점으로 옮긴 것 말고는
 * 계산이 같다.
 */

export type Point = { x: number; y: number };

export type LayoutMember = {
  id: string;
  nextNodes: string[];
};

export const FORCE_PARAMS = {
  /** 노드끼리 밀어내는 힘의 세기 (거리 제곱에 반비례). */
  repulsion: 12000,
  /** 간선이 수렴하려는 목표 길이(px). */
  linkLength: 90,
  /** 간선 스프링이 한 번에 당기는 비율. */
  linkStrength: 0.05,
  /** 매 반복 중심(원점)으로 끌어당기는 비율. */
  centerPull: 0.003,
  /** 반복 횟수 — 반발력은 이 횟수에 걸쳐 선형으로 식는다. */
  iterations: 300,
  /** 고정 시드: 노드를 이 반지름의 타원 위에 균등 각도로 늘어놓고 시작한다. */
  seedRadiusX: 200,
  seedRadiusY: 180,
} as const;

/**
 * 노드 구름의 초기 배치를 계산한다. 그룹 밖을 가리키는 간선은 무시한다
 * (다른 그룹으로 넘어가는 연결은 그룹 안 배치에 영향을 주지 않는다).
 */
export function runForceLayout(members: LayoutMember[]): Record<string, Point> {
  const { repulsion, linkLength, linkStrength, centerPull, iterations } =
    FORCE_PARAMS;
  const indexOf = new Map(members.map((m, i) => [m.id, i]));
  const pos: Point[] = members.map((_, i) => ({
    x: FORCE_PARAMS.seedRadiusX * Math.cos((i / members.length) * Math.PI * 2),
    y: FORCE_PARAMS.seedRadiusY * Math.sin((i / members.length) * Math.PI * 2),
  }));

  const links: [number, number][] = [];
  for (const member of members) {
    const from = indexOf.get(member.id)!;
    for (const next of member.nextNodes) {
      const to = indexOf.get(next);
      if (to !== undefined) links.push([from, to]);
    }
  }

  for (let it = 0; it < iterations; it++) {
    const cooling = 1 - it / iterations;
    for (let i = 0; i < pos.length; i++) {
      for (let j = i + 1; j < pos.length; j++) {
        const dx = pos[j].x - pos[i].x;
        const dy = pos[j].y - pos[i].y;
        // 완전히 겹친 두 점이 0으로 나눠지지 않도록 최소 거리²를 둔다
        const d2 = Math.max(dx * dx + dy * dy, 25);
        const d = Math.sqrt(d2);
        const f = (repulsion / d2) * cooling;
        pos[i].x -= (dx / d) * f;
        pos[i].y -= (dy / d) * f;
        pos[j].x += (dx / d) * f;
        pos[j].y += (dy / d) * f;
      }
    }
    for (const [a, b] of links) {
      const dx = pos[b].x - pos[a].x;
      const dy = pos[b].y - pos[a].y;
      const d = Math.max(Math.hypot(dx, dy), 1);
      const f = ((d - linkLength) / d) * linkStrength;
      pos[a].x += dx * f;
      pos[a].y += dy * f;
      pos[b].x -= dx * f;
      pos[b].y -= dy * f;
    }
    for (const p of pos) {
      p.x -= p.x * centerPull;
      p.y -= p.y * centerPull;
    }
  }

  const out: Record<string, Point> = {};
  members.forEach((member, i) => {
    out[member.id] = { x: Math.round(pos[i].x), y: Math.round(pos[i].y) };
  });
  return out;
}
