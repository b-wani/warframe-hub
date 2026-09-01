/**
 * 폴백 뷰의 표시 모델 — 행성 아코디언 + 노드 체크리스트가 읽는 것(스펙 §8).
 *
 * 3D가 없는 자리에서도 진행도 확인·체크가 성립해야 하므로, 여기 실리는 것은
 * 지도가 보여주던 것 전부여야 한다: 진행도 대상 그룹 전부와 그 그룹의 노드
 * 전부. 하나라도 빠지면 폴백 뷰만 쓰는 사용자에게 영영 닿지 않는 노드가 생긴다.
 *
 * 프록시마는 여기서 독립 항목이다 — 3D에서는 행성에 종속 표시하지만(스펙 §2.1)
 * 그건 한 장면 안의 공간 관계를 쓰는 표현이고, 글 목록에는 그런 관계가 없다.
 * 표시명("지구 프록시마")이 이미 소속을 말한다.
 *
 * 상태는 여기 없다 — 3상태도 완료 여부도 완료 집합에서 파생하는 값이라(§4.2)
 * 화면이 그때그때 계산한다. 이 모델은 무엇이 어떤 순서로 있는지만 안다.
 */
import { isJunction, isTrackedGroup, type StarchartDataset } from "./dataset.ts";

export type FallbackNode = {
  id: string;
  /** 표시명. */
  name: string;
  /** 교차점은 목록에서도 일반 노드와 구별한다(스펙 §2.2). */
  junction: boolean;
};

export type FallbackGroup = {
  id: string;
  /** 그룹 표시명 — 아코디언의 제목이다. */
  name: string;
  nodes: FallbackNode[];
};

/**
 * 진행도 대상 그룹과 그 노드를 데이터셋 순서 그대로 돌려준다. 릴레이 그룹은
 * 진행도와 무관하므로 목록에도 없다(#26).
 */
export function fallbackGroups(dataset: StarchartDataset): FallbackGroup[] {
  const groups = new Map<string, FallbackGroup>();
  for (const [id, group] of Object.entries(dataset.groups)) {
    if (isTrackedGroup(group)) groups.set(id, { id, name: group.name, nodes: [] });
  }

  for (const [id, node] of Object.entries(dataset.nodes)) {
    groups.get(node.group)?.nodes.push({
      id,
      name: node.name,
      junction: isJunction(node),
    });
  }

  return [...groups.values()];
}
