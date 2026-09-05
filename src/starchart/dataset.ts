/**
 * 정제 노드 데이터셋(`src/data/starchart.json`)의 타입.
 *
 * 데이터셋 자체는 빌드 파이프라인(`scripts/build-starchart-data.mts`)이 검증하며,
 * 여기서는 좌표 데이터셋 쪽이 읽어야 하는 형태만 선언한다.
 */

/** 그룹 유형 4분류 (#26). */
export type GroupType = "planet" | "proxima" | "special" | "relay";

export type StarchartGroup = {
  name: string;
  type: GroupType;
};

export type StarchartNode = {
  name: string;
  /**
   * 영문 표시명. 월드스테이트가 노드를 id 없이 이 이름으로만 알려주므로
   * 대조용으로 인라인한다(스펙 §6) — 데이터셋 안에서 겹치지 않는다는 것은
   * 빌드 파이프라인이 지킨다.
   */
  enName: string;
  group: string;
  nextNodes: string[];
  /** 미션 유형 enum(`MT_*`). 생성 파이프라인이 원본에 없으면 비운다. */
  missionType?: string;
  /** 미션 유형 표시명. */
  missionName?: string;
  /** 팩션 enum(`FC_*`). 팩션이 없는 노드(교차점 등)가 있다. */
  faction?: string;
  /** 팩션 표시명. */
  factionName?: string;
  minEnemyLevel?: number;
  maxEnemyLevel?: number;
};

export type StarchartDataset = {
  groups: Record<string, StarchartGroup>;
  nodes: Record<string, StarchartNode>;
};

/**
 * 좌표를 붙이는 그룹인가. 릴레이는 지도에서 숨기므로(진행도와도 무관) 좌표
 * 대상이 아니다 — 나머지 그룹 유형은 전부 대상이다.
 */
export function isPlacedGroup(group: StarchartGroup): boolean {
  return group.type !== "relay";
}

/** 좌표 대상 그룹 id를 데이터셋 순서대로 돌려준다. */
export function placedGroupIds(dataset: StarchartDataset): string[] {
  return Object.entries(dataset.groups)
    .filter(([, group]) => isPlacedGroup(group))
    .map(([id]) => id);
}

/** 좌표 대상 노드 id를 그룹별로 묶어 데이터셋 순서대로 돌려준다. */
export function placedNodesByGroup(
  dataset: StarchartDataset,
): Map<string, { id: string; nextNodes: string[] }[]> {
  const byGroup = new Map<string, { id: string; nextNodes: string[] }[]>();
  for (const groupId of placedGroupIds(dataset)) byGroup.set(groupId, []);
  for (const [id, node] of Object.entries(dataset.nodes)) {
    byGroup.get(node.group)?.push({ id, nextNodes: node.nextNodes });
  }
  return byGroup;
}

/**
 * 성계 뷰에 천체로 놓이는 그룹인가. 프록시마는 독립 천체가 아니라 해당 행성에
 * 종속 표시하고(스펙 §2.1), 릴레이는 지도에서 숨긴다 — 둘 다 성계 뷰에 없다.
 *
 * `isPlacedGroup`과 조건이 다르다: 프록시마는 좌표는 갖지만(행성 뷰의 바깥 고리)
 * 성계 뷰의 천체는 아니다.
 */
export function isCelestialBodyGroup(group: StarchartGroup): boolean {
  return group.type === "planet" || group.type === "special";
}

/**
 * 진행도에 세는 그룹인가. 릴레이는 지도에서 숨기고 진행도와도 무관하므로(#26)
 * 완료 집합·파생 상태 어디에도 등장하지 않는다 — 나머지 유형은 전부 대상이다.
 *
 * 조건이 `isPlacedGroup`과 같지만 이유가 다르다(좌표를 붙이는가 vs 진행도에
 * 세는가). 그룹 유형이 늘어나면 서로 갈라질 수 있으니 합치지 않는다.
 */
export function isTrackedGroup(group: StarchartGroup): boolean {
  return group.type !== "relay";
}

/**
 * 교차점(Junction)인가. 인게임에서 행성 사이를 잇는 특수 노드이며, 지도에서도
 * 일반 노드와 구별해 표현한다(스펙 §2.2).
 *
 * 비노드 목표가 아니라 정제 노드 데이터셋의 실제 노드다(CONTEXT "비노드 목표") —
 * 완료도 노드 완료로만 추적한다.
 */
export function isJunction(node: StarchartNode): boolean {
  return node.missionType === "MT_JUNCTION";
}

/**
 * 보스 노드(암살 미션)인가. 교차점과 함께 큐레이션 오버레이가 얹히는 주요
 * 노드다(CONTEXT "주요 노드") — 구조화 데이터만으로는 "여기서 무엇을 얻는가"가
 * 드러나지 않는 자리다.
 */
export function isBossNode(node: StarchartNode): boolean {
  return node.missionType === "MT_ASSASSINATION";
}
