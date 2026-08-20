import type { RoadmapNode } from "@/roadmap/schema";

export type Progress = {
  /** 로드맵에 실존하는 완료 노드 수 */
  completedCount: number;
  totalCount: number;
  /** 0~1. 노드가 없으면 0 */
  completionRate: number;
  /** 선행조건이 모두 충족된 미완료 노드, 로드맵 순서 유지 */
  nextGoals: RoadmapNode[];
};

/** 체크된 노드 집합 + 로드맵 그래프 → 다음 목표와 완료율을 계산한다. */
export function computeProgress(
  nodes: RoadmapNode[],
  completedIds: ReadonlySet<string>,
): Progress {
  const nodeIds = new Set(nodes.map((n) => n.id));
  const completedCount = [...completedIds].filter((id) =>
    nodeIds.has(id),
  ).length;

  const nextGoals = nodes.filter(
    (node) =>
      !completedIds.has(node.id) &&
      node.prerequisites.every((prereq) => completedIds.has(prereq)),
  );

  return {
    completedCount,
    totalCount: nodes.length,
    completionRate: nodes.length === 0 ? 0 : completedCount / nodes.length,
    nextGoals,
  };
}

/** 노드 완료 여부를 뒤집은 새 집합을 돌려준다. 입력은 변경하지 않는다. */
export function toggleNode(
  completedIds: ReadonlySet<string>,
  nodeId: string,
): Set<string> {
  const next = new Set(completedIds);
  if (next.has(nodeId)) {
    next.delete(nodeId);
  } else {
    next.add(nodeId);
  }
  return next;
}

/** 진행 초기화: 빈 완료 집합. */
export function resetProgress(): Set<string> {
  return new Set();
}

/**
 * "여기까지 완료" — 지정 노드와 그 선행 노드 전체를 완료 처리한 새 집합.
 * 복귀 유저가 자기 위치에서 시작할 수 있게 하는 구간 일괄 체크의 연산이다.
 * 완료를 해제하지는 않으며, 지정 노드가 로드맵에 없으면 그대로 돌려준다.
 */
export function completeThrough(
  nodes: RoadmapNode[],
  completedIds: ReadonlySet<string>,
  nodeId: string,
): Set<string> {
  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  const next = new Set(completedIds);
  if (!nodesById.has(nodeId)) {
    return next;
  }

  // 선행조건을 거슬러 올라가며 방문한다. visited가 순환도 막는다.
  const visited = new Set<string>();
  const stack = [nodeId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (visited.has(id)) continue;
    visited.add(id);
    // 참조 무결성은 loadRoadmap이 보장하지만, 낡은 선행 id는 무시한다
    const node = nodesById.get(id);
    if (!node) continue;
    next.add(id);
    stack.push(...node.prerequisites);
  }

  return next;
}
