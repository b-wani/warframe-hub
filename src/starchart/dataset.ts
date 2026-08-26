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
  group: string;
  nextNodes: string[];
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
 * 진행도에 세는 그룹인가. 릴레이는 지도에서 숨기고 진행도와도 무관하므로(#26)
 * 완료 집합·파생 상태 어디에도 등장하지 않는다 — 나머지 유형은 전부 대상이다.
 *
 * 조건이 `isPlacedGroup`과 같지만 이유가 다르다(좌표를 붙이는가 vs 진행도에
 * 세는가). 그룹 유형이 늘어나면 서로 갈라질 수 있으니 합치지 않는다.
 */
export function isTrackedGroup(group: StarchartGroup): boolean {
  return group.type !== "relay";
}
