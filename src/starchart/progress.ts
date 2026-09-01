/**
 * 스타차트 진행도 도메인 (스펙 §4).
 *
 * 유일한 원본 사실은 **완료 집합** 하나다 — 성계 노드 id와 비노드 목표 슬러그가
 * 한 집합에 공존한다. 노드 3상태(잠김/미클리어/클리어)와 행성 완료 여부는 전부
 * 여기서 계산하는 파생값이며 저장하지 않는다.
 *
 * 해제 규칙은 `nextNodes` 간선을 뒤집어 얻는다: 어떤 노드는 선행 노드가 없거나
 * (진입 노드) 선행 노드 하나 이상이 완료됐을 때 열린다. 순환·데이터셋 밖을
 * 가리키는 간선·낡은 완료 id가 있어도 던지지 않는다.
 */
import { isTrackedGroup, type StarchartDataset } from "./dataset";

/** 성계 노드의 3상태. 저장하지 않는 파생값이다 (CONTEXT "노드 상태"). */
export type NodeState = "locked" | "uncleared" | "cleared";

/**
 * 파생 계산에 필요한 만큼만 데이터셋을 뒤집어 놓은 색인. 데이터셋마다 한 번
 * 만들어 두고 재사용한다 — 진행도 대상이 아닌 노드는 애초에 들어오지 않는다.
 */
export type StarchartProgressGraph = {
  /** 노드 id → 선행 노드 id. 진입 노드는 빈 배열이다. */
  readonly predecessors: ReadonlyMap<string, readonly string[]>;
  /** 그룹 id → 그 그룹의 진행도 대상 노드 id. */
  readonly nodesByGroup: ReadonlyMap<string, readonly string[]>;
};

/** 정제 노드 데이터셋에서 진행도 색인을 만든다. 릴레이 그룹은 제외한다. */
export function buildProgressGraph(
  dataset: StarchartDataset,
): StarchartProgressGraph {
  const nodesByGroup = new Map<string, string[]>();
  for (const [groupId, group] of Object.entries(dataset.groups)) {
    if (isTrackedGroup(group)) nodesByGroup.set(groupId, []);
  }

  const predecessors = new Map<string, string[]>();
  for (const [id, node] of Object.entries(dataset.nodes)) {
    const members = nodesByGroup.get(node.group);
    if (members === undefined) continue; // 릴레이 노드와 그룹 없는 노드
    members.push(id);
    predecessors.set(id, []);
  }
  for (const [id, node] of Object.entries(dataset.nodes)) {
    if (!predecessors.has(id)) continue;
    for (const next of node.nextNodes) {
      // 데이터셋 밖이나 진행도 대상 밖을 가리키는 간선은 노드를 만들지 않는다
      predecessors.get(next)?.push(id);
    }
  }

  return { predecessors, nodesByGroup };
}

/**
 * 노드 3상태. 데이터셋에 없는 id(비노드 목표·낡은 저장 데이터·릴레이 노드)는
 * 잠김으로 본다 — 그래프가 모르는 것을 열어줄 근거가 없다.
 */
export function nodeState(
  graph: StarchartProgressGraph,
  completedIds: ReadonlySet<string>,
  nodeId: string,
): NodeState {
  const predecessors = graph.predecessors.get(nodeId);
  if (predecessors === undefined) return "locked";
  if (completedIds.has(nodeId)) return "cleared";
  if (predecessors.length === 0) return "uncleared";
  return predecessors.some((id) => completedIds.has(id))
    ? "uncleared"
    : "locked";
}

/** 진행도 대상 노드 전부의 상태. 순서는 데이터셋 순서다. */
export function nodeStates(
  graph: StarchartProgressGraph,
  completedIds: ReadonlySet<string>,
): Map<string, NodeState> {
  const states = new Map<string, NodeState>();
  for (const id of graph.predecessors.keys()) {
    states.set(id, nodeState(graph, completedIds, id));
  }
  return states;
}

/**
 * 행성(그룹) 완료 여부 — 파생값이다. 그룹의 노드가 전부 완료됐을 때만 참이며,
 * 데이터셋에 없는 그룹·진행도 대상 노드가 없는 그룹은 완료가 아니다.
 */
export function isGroupComplete(
  graph: StarchartProgressGraph,
  completedIds: ReadonlySet<string>,
  groupId: string,
): boolean {
  const members = graph.nodesByGroup.get(groupId);
  if (members === undefined || members.length === 0) return false;
  return members.every((id) => completedIds.has(id));
}

/**
 * "여기까지 완료" — 지정 노드와 그 선행 노드 전체를 완료 처리한 새 집합.
 * 간선을 거슬러 올라가므로 그룹을 넘어(교차점) 채워진다. 완료를 해제하는 일은
 * 없고, 지정 노드가 진행도 대상이 아니면 완료 집합을 그대로 돌려준다.
 */
export function completeThrough(
  graph: StarchartProgressGraph,
  completedIds: ReadonlySet<string>,
  nodeId: string,
): Set<string> {
  const next = new Set(completedIds);
  if (!graph.predecessors.has(nodeId)) return next;

  // visited가 순환을 막는다 — 이미 완료된 노드도 선행은 계속 거슬러 올라간다
  const visited = new Set<string>();
  const stack = [nodeId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (visited.has(id)) continue;
    visited.add(id);
    next.add(id);
    stack.push(...(graph.predecessors.get(id) ?? []));
  }
  return next;
}

/**
 * "행성 전체 완료" — 구간 일괄 체크의 한 형태다. 그룹의 노드 전부를
 * `completeThrough`로 채우므로 다른 그룹의 선행 노드도 함께 완료된다.
 */
export function completeGroup(
  graph: StarchartProgressGraph,
  completedIds: ReadonlySet<string>,
  groupId: string,
): Set<string> {
  let next = new Set(completedIds);
  for (const id of graph.nodesByGroup.get(groupId) ?? []) {
    next = completeThrough(graph, next, id);
  }
  return next;
}

/** 개별 체크 — 완료 여부를 뒤집은 새 집합. 노드가 아닌 목표도 같은 집합이다. */
export function toggleCompletion(
  completedIds: ReadonlySet<string>,
  id: string,
): Set<string> {
  const next = new Set(completedIds);
  if (!next.delete(id)) next.add(id);
  return next;
}

/** 진행도 전체 초기화 — 빈 완료 집합. */
export function resetCompletion(): Set<string> {
  return new Set();
}

/**
 * 진행도 가져오기의 합집합 병합(스펙 §5) — 들어온 id를 더하기만 한다. 완료를
 * 지우는 일이 없으므로 몇 번을 다시 실행해도 무해하다.
 */
export function mergeCompletion(
  completedIds: ReadonlySet<string>,
  ids: Iterable<string>,
): Set<string> {
  const next = new Set(completedIds);
  for (const id of ids) next.add(id);
  return next;
}

/** 진행도 대상 노드 id 전부 — 가져오기가 아는 `Tag`를 가리는 기준이다. */
export function progressNodeIds(
  graph: StarchartProgressGraph,
): Set<string> {
  return new Set(graph.predecessors.keys());
}
