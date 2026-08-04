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
