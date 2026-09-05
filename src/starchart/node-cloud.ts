/**
 * 행성 뷰가 그리는 노드 구름의 표시 모델.
 *
 * 화면이 알아야 하는 것 — 어떤 노드를 월드 어디에 놓고 어떤 노드끼리 선으로
 * 이을지 — 를 한 번에 계산해서 넘긴다. 씬 컴포넌트는 좌표계도, `nextNodes`
 * 그래프도, 릴레이·프록시마 제외 규칙도 몰라도 된다.
 *
 * 구름은 천체마다 하나이고, **자기 천체 바로 위에 뜬 원반**이다. 좌표 데이터셋의
 * 노드 좌표는 그룹 중심을 원점으로 한 상대 위치이므로(CONTEXT.md), 배율 하나와
 * 평행이동 하나만 얹으면 큐레이션한 배치가 그대로 월드로 옮겨진다 — 노드를
 * 개별로 밀어내는 보정은 하지 않는다. 원반을 천체 위로 띄우는 이유는 중심에
 * 가까운 노드(가장 가까운 것이 그룹 중심에서 9px)가 행성 안에 파묻히기
 * 때문이다.
 *
 * 노드 상태(잠김/미클리어/클리어)는 여기 없다 — 완료 집합이 있어야 계산되는
 * 파생값이라 화면이 프레임마다 쥔다. 대신 상태가 붙을 자리는 여기서 만들어 둔다:
 * 연결선이 자기 두 끝 노드를 알고 있어야 화면이 실선·점선을 가를 수 있다.
 */
import type { SolarSystemBody } from "./bodies.ts";
import {
  isJunction,
  placedNodesByGroup,
  type StarchartDataset,
} from "./dataset.ts";
import type { StarchartLayout } from "./layout.ts";

/**
 * 좌표 데이터셋의 노드 픽셀을 3D 월드 단위로 옮기는 배율.
 *
 * 천체 좌표(`WORLD_SCALE`)와 다른 값이다 — 천체는 태양계 전체를 담아야 해서
 * 크게, 노드 구름은 행성 하나를 채워야 해서 작게 잡는다. 이 값에서 가장 큰
 * 구름(화성, 반지름 298px)이 월드 6단위가 된다.
 */
export const NODE_SCALE = 0.02;

/** 노드 마름모의 월드 단위 반지름. */
export const NODE_RADIUS = 0.16;

/** 원반이 대기 셸 위로 더 떠오르는 거리. */
const CLOUD_LIFT = 1.2;

export type NodeMarker = {
  id: string;
  /** 표시명 — 정제 노드 데이터셋의 것을 그대로 쓴다. */
  name: string;
  /** 태양을 원점으로 한 월드 좌표. */
  position: [number, number, number];
  /** 교차점인가 — 특수 노드로 구별해 그린다(스펙 §2.2). */
  junction: boolean;
};

/** 노드 둘을 잇는 선 하나. */
export type NodeLink = {
  from: string;
  to: string;
  /** 두 끝의 월드 좌표 — 그리는 쪽이 그대로 쓴다. */
  points: [[number, number, number], [number, number, number]];
};

export type NodeCloud = {
  /** 이 구름이 매달린 천체의 id. */
  body: string;
  /** 원반의 중심 — 천체 바로 위다. */
  center: [number, number, number];
  nodes: NodeMarker[];
  /**
   * `nextNodes` 간선. 끝 노드의 id를 함께 들고 있어서 화면이 상태에 따라
   * 실선·점선으로 나눠 그릴 수 있다.
   */
  links: NodeLink[];
  /**
   * 중심에서 가장 먼 노드까지의 거리. 이 구름이 화면을 채우는 거리의 척도라,
   * 카메라가 얼마나 멀어졌는지 재는 자로 쓴다.
   */
  radius: number;
  /**
   * 가장 가까운 두 노드 사이의 거리. 탭 히트 영역을 얼마나 키울 수 있는지가
   * 여기서 나온다 — 이웃의 중심까지 삼키면 그 이웃을 못 누른다(`tap-target.ts`).
   * 노드가 하나뿐이면 `Infinity`, 즉 상한이 없다.
   */
  minSpacing: number;
};

/**
 * 그룹 하나의 노드를 원반 하나로 옮긴다. 어느 그룹을 어느 천체 위 어디에 놓을지는
 * 부르는 쪽이 정한다 — 행성 뷰의 노드 구름은 천체 바로 위에(`offset` 없이),
 * 프록시마 고리는 같은 높이의 옆자리에 선다(`proxima.ts`).
 *
 * 좌표가 빠진 노드는 그리지 않고 `issues`로 알린다 — 게임 패치로 노드가 늘면
 * 화면이 조용히 빠뜨리는 대신 CI에서 드러나야 한다.
 */
export function nodeCloud(
  dataset: StarchartDataset,
  layout: StarchartLayout,
  {
    body,
    group = body.id,
    offset = [0, 0],
  }: {
    /** 원반이 매달리는 천체 — 높이도 이 천체가 정한다. */
    body: SolarSystemBody;
    /** 원반에 실을 그룹. 기본값은 천체 자신의 그룹이다. */
    group?: string;
    /** 천체에서 황도면 위로 얼마나 비켜 놓는가(월드 단위 x·z). */
    offset?: readonly [number, number];
  },
): { cloud: NodeCloud; issues: string[] } {
  const issues: string[] = [];
  const members = placedNodesByGroup(dataset).get(group) ?? [];
  const center: [number, number, number] = [
    body.position[0] + offset[0],
    body.position[1] + body.shellRadius + CLOUD_LIFT,
    body.position[2] + offset[1],
  ];

  const placed = new Map<string, [number, number, number]>();
  const nodes: NodeMarker[] = [];
  for (const { id } of members) {
    const point = layout.nodes[id];
    if (!point) {
      issues.push(
        `노드 "${id}"의 좌표가 없다 (좌표 데이터셋을 다시 생성해야 한다)`,
      );
      continue;
    }
    const position: [number, number, number] = [
      center[0] + point.x * NODE_SCALE,
      center[1],
      center[2] + point.y * NODE_SCALE,
    ];
    placed.set(id, position);
    nodes.push({
      id,
      name: dataset.nodes[id].name,
      position,
      junction: isJunction(dataset.nodes[id]),
    });
  }

  // 간선에 방향은 없다 — A→B와 B→A가 둘 다 있어도 선은 하나다. 그룹 밖을
  // 가리키는 간선(교차점 → 다음 행성)은 이 구름의 선이 아니다.
  const links: NodeLink[] = [];
  const drawn = new Set<string>();
  for (const { id, nextNodes } of members) {
    const start = placed.get(id);
    if (!start) continue;
    for (const next of nextNodes) {
      const end = placed.get(next);
      if (!end) continue;
      const key = id < next ? `${id} ${next}` : `${next} ${id}`;
      if (drawn.has(key)) continue;
      drawn.add(key);
      links.push({ from: id, to: next, points: [start, end] });
    }
  }

  const radius = nodes.reduce(
    (far, { position }) =>
      Math.max(far, Math.hypot(position[0] - center[0], position[2] - center[2])),
    0,
  );
  // 노드는 전부 같은 높이의 원반 위에 있으므로 간격도 평면에서 잰다
  let minSpacing = Infinity;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i].position;
      const b = nodes[j].position;
      minSpacing = Math.min(minSpacing, Math.hypot(a[0] - b[0], a[2] - b[2]));
    }
  }

  return {
    cloud: { body: body.id, center, nodes, links, radius, minSpacing },
    issues,
  };
}

/**
 * 천체마다 노드 구름을 계산한다.
 *
 * 구름은 넘겨받은 천체에만 생긴다. 프록시마는 독립 천체가 아니라 행성 뷰의 ⚓
 * 토글로 붙고(`proxima.ts`), 릴레이는 지도에서 숨기므로 둘 다 여기 없다.
 */
export function nodeClouds(
  dataset: StarchartDataset,
  layout: StarchartLayout,
  bodies: SolarSystemBody[],
): { clouds: Map<string, NodeCloud>; issues: string[] } {
  const clouds = new Map<string, NodeCloud>();
  const issues: string[] = [];

  for (const body of bodies) {
    const built = nodeCloud(dataset, layout, { body });
    clouds.set(body.id, built.cloud);
    issues.push(...built.issues);
  }

  return { clouds, issues };
}
