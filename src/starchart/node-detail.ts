/**
 * 노드 상세의 표시 모델 — 노드를 골랐을 때 화면이 읽어 주는 것(스펙 §2.2).
 *
 * 정제 노드 데이터셋의 필드를 화면이 그대로 쓸 수 있는 문자열로 옮긴다. 화면은
 * 필드가 비어 있을 수 있다는 것도, 레벨 범위를 어떻게 적는지도 몰라도 된다 —
 * 여기 없는 줄은 화면에도 없는 줄이다(빈칸을 지어내지 않는다).
 *
 * 주요 노드(교차점·보스)에 얹는 큐레이션 오버레이 콘텐츠는 여기 없다 — 자동
 * 생성 데이터셋과 수동 저작 파일은 출처도 검증도 다르고, 둘을 한 모델로 뭉치면
 * 어느 쪽이 없어서 빈 것인지 구별할 수 없다. 오버레이는 자기 로더
 * (`node-overlay.ts`)에서 와 노드 상세 패널에서 이것과 나란히 선다(스펙 §3.3).
 */
import { isJunction, type StarchartDataset } from "./dataset.ts";

/** 노드 상세에 실리는 줄들. 비어 있는 줄은 아예 없다. */
export type NodeDetail = {
  id: string;
  /** 표시명. */
  name: string;
  /** 미션 유형 표시명. */
  mission?: string;
  /** 팩션 표시명. */
  faction?: string;
  /** 적 레벨 범위 — 한 값이면 한 번만 적는다. */
  levelRange?: string;
  /** 교차점은 특수 노드로 구별해 표현한다. */
  junction: boolean;
};

/** 노드 하나의 상세. 데이터셋에 없는 id는 상세도 없다. */
export function nodeDetail(
  dataset: StarchartDataset,
  id: string,
): NodeDetail | undefined {
  const node = dataset.nodes[id];
  if (!node) return undefined;

  return {
    id,
    name: node.name,
    mission: node.missionName,
    faction: node.factionName,
    levelRange: levelRange(node.minEnemyLevel, node.maxEnemyLevel),
    junction: isJunction(node),
  };
}

function levelRange(min?: number, max?: number): string | undefined {
  if (min === undefined || max === undefined) return undefined;
  return min === max ? `${min}` : `${min}–${max}`;
}
