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
 * 노드 상태(잠김/미클리어/클리어)의 시각 규칙은 여기 없다 — 파생 3상태는 완료
 * 집합이 있어야 계산되고, 그 시각화는 #43 소관이다.
 */
import type { SolarSystemBody } from "./bodies.ts";
import { placedNodesByGroup, type StarchartDataset } from "./dataset.ts";
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
};

export type NodeCloud = {
  /** 이 구름이 매달린 천체의 id. */
  body: string;
  /** 원반의 중심 — 천체 바로 위다. */
  center: [number, number, number];
  nodes: NodeMarker[];
  /**
   * `nextNodes` 간선을 두 점씩 늘어놓은 목록 — 한 줄이 원소 두 개다.
   * 선 하나짜리 `Line`(segments)에 그대로 넣는 모양이다.
   */
  links: [number, number, number][];
  /**
   * 중심에서 가장 먼 노드까지의 거리. 이 구름이 화면을 채우는 거리의 척도라,
   * 카메라가 얼마나 멀어졌는지 재는 자로 쓴다.
   */
  radius: number;
};

/**
 * 천체마다 노드 구름을 계산한다. 좌표가 빠진 노드는 그리지 않고 `issues`로
 * 알린다 — 게임 패치로 노드가 늘면 화면이 조용히 빠뜨리는 대신 CI에서 드러나야
 * 한다.
 *
 * 구름은 넘겨받은 천체에만 생긴다. 프록시마는 독립 천체가 아니라 행성 뷰의 ⚓
 * 토글로 붙고(#48), 릴레이는 지도에서 숨기므로 둘 다 여기 없다.
 */
export function nodeClouds(
  dataset: StarchartDataset,
  layout: StarchartLayout,
  bodies: SolarSystemBody[],
): { clouds: Map<string, NodeCloud>; issues: string[] } {
  const clouds = new Map<string, NodeCloud>();
  const issues: string[] = [];
  const byGroup = placedNodesByGroup(dataset);

  for (const body of bodies) {
    const members = byGroup.get(body.id) ?? [];
    const center: [number, number, number] = [
      body.position[0],
      body.position[1] + body.shellRadius + CLOUD_LIFT,
      body.position[2],
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
      nodes.push({ id, name: dataset.nodes[id].name, position });
    }

    // 간선에 방향은 없다 — A→B와 B→A가 둘 다 있어도 선은 하나다. 그룹 밖을
    // 가리키는 간선(교차점 → 다음 행성)은 이 구름의 선이 아니다.
    const links: [number, number, number][] = [];
    const drawn = new Set<string>();
    for (const { id, nextNodes } of members) {
      const from = placed.get(id);
      if (!from) continue;
      for (const next of nextNodes) {
        const to = placed.get(next);
        if (!to) continue;
        const key = id < next ? `${id} ${next}` : `${next} ${id}`;
        if (drawn.has(key)) continue;
        drawn.add(key);
        links.push(from, to);
      }
    }

    const radius = nodes.reduce(
      (far, { position }) =>
        Math.max(far, Math.hypot(position[0] - center[0], position[2] - center[2])),
      0,
    );
    clouds.set(body.id, { body: body.id, center, nodes, links, radius });
  }

  return { clouds, issues };
}
