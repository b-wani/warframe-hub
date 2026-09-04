/**
 * 보이드 균열 오버레이의 표시 모델 — 활성 균열을 지도의 노드에 붙이는 자리
 * (스펙 §6).
 *
 * 월드스테이트가 알려주는 것은 노드의 **영문 표시명**이다(외부 응답에 SolNode
 * id가 없다). 그래서 여기서 하는 일은 이름을 노드 id로 해석하는 것 하나다 —
 * 정제 노드 데이터셋이 영문 표시명을 인라인으로 들고 있고(`enName`), 그 이름이
 * 겹치지 않는다는 것은 빌드 파이프라인이 지킨다.
 *
 * 대조는 외부가 준 원문과 행성 괄호를 뗀 이름을 차례로 시도한다 — 이름 자체가
 * 괄호로 끝나는 노드가 있어서 한쪽만 보면 조용히 놓친다.
 *
 * 해석하지 못한 균열은 조용히 빠진다. 지도에 놓을 자리가 없으면 표시할 방법이
 * 없고, 균열을 못 알아본 것이 지도·진행도를 망칠 이유는 없기 때문이다 — 월드
 * 스테이트를 통째로 못 받은 것도 여기서는 "활성 균열 0건"과 같은 결과다
 * (실시간 항목만 빠지고 나머지는 온전하다).
 *
 * 프록시마 노드의 균열(보이드 폭풍)도 그래서 빠진다 — 프록시마 노드는 이제
 * 행성 뷰의 ⚓ 토글로 지도에 뜨지만(#48), 여기서 남기는 기준은 여전히 "성계 뷰의
 * 천체"다. 고리에 심볼을 얹고 목록에서 그 고리까지 날아가는 것은 별건이다.
 */
import type { FissureTier, VoidFissure } from "@/worldstate/schema";
import { fissureTierSchema } from "@/worldstate/schema";
import type { StarchartDataset } from "./dataset.ts";

/**
 * 로테이션의 한국어 표기 — 인게임 한국어 클라이언트와 같은 표기를 원칙으로
 * 한다(CONTEXT "표시명").
 */
export const FISSURE_TIER_NAME: Record<FissureTier, string> = {
  Lith: "리스",
  Meso: "메소",
  Neo: "니오",
  Axi: "액시",
  Requiem: "레퀴엠",
  Omnia: "옴니아",
};

/** 로테이션의 정렬 순서 — 등급 순서는 스키마의 열거 순서가 원본이다. */
const TIER_ORDER = new Map(
  fissureTierSchema.options.map((tier, index) => [tier, index]),
);

/** 지도에 놓을 수 있게 해석된 균열 하나. */
export type FissureMarker = {
  /** 심볼을 얹을 노드. */
  nodeId: string;
  /** 노드 표시명. */
  nodeName: string;
  /** 목록에서 이 항목을 골랐을 때 날아갈 천체. */
  bodyId: string;
  bodyName: string;
  tier: FissureTier;
  /** 로테이션의 한국어 표기 — 색만으로 등급을 알리지 않기 위해서다. */
  tierName: string;
  expiryAt: number;
  /**
   * 스틸패스 균열인가. 진행도에는 스틸패스 축이 없지만(CONTEXT "진행도 가져오기")
   * 같은 노드·같은 등급으로 일반 균열과 나란히 열리므로, 목록에서 두 줄이 구별
   * 되지 않으면 같은 것이 두 번 뜬 것으로 읽힌다.
   */
  hard: boolean;
};

/** 균열 해석에 필요한 사실들. */
export type FissureContext = {
  dataset: StarchartDataset;
  /** 영문 표시명 → 노드 id 색인. */
  names: ReadonlyMap<string, string>;
  /** 지도에 있는 천체 id — 여기 없는 그룹의 노드는 놓을 자리가 없다. */
  bodies: ReadonlySet<string>;
  /** 지금 시각(epoch ms) — 이미 닫힌 균열을 걸러내는 기준이다. */
  now: number;
};

/**
 * 활성 균열을 지도가 쓸 수 있는 표시 모델로 옮긴다. 로테이션 순서로, 같은
 * 등급이면 먼저 닫히는 것부터 세운다 — 목록 탭이 이 순서를 그대로 쓴다.
 *
 * "활성"은 이미 열렸고 아직 닫히지 않은 것이다 — 시작 시각이 아직 오지 않은
 * 균열을 지금 열린 것처럼 세우지 않는다.
 */
export function activeFissures(
  fissures: readonly VoidFissure[] | null,
  { dataset, names, bodies, now }: FissureContext,
): FissureMarker[] {
  if (fissures === null) return [];

  const markers: FissureMarker[] = [];
  for (const fissure of fissures) {
    if (fissure.expiryAt <= now || fissure.activationAt > now) continue;
    const nodeId =
      names.get(fissure.nodeKey) ?? names.get(fissure.nodeName);
    if (nodeId === undefined) continue;
    const node = dataset.nodes[nodeId];
    if (!bodies.has(node.group)) continue;
    markers.push({
      nodeId,
      nodeName: node.name,
      bodyId: node.group,
      bodyName: dataset.groups[node.group].name,
      tier: fissure.tier,
      tierName: FISSURE_TIER_NAME[fissure.tier],
      expiryAt: fissure.expiryAt,
      hard: fissure.hard,
    });
  }

  return markers.sort(
    (a, b) =>
      TIER_ORDER.get(a.tier)! - TIER_ORDER.get(b.tier)! ||
      a.expiryAt - b.expiryAt ||
      a.nodeName.localeCompare(b.nodeName),
  );
}

/**
 * 노드마다 균열 하나 — 마름모에 심볼을 얹는 쪽이 쓴다. 한 노드에 둘 이상이
 * 뜨면 목록에서 먼저 오는 것을 남긴다(순서를 새로 정하지 않는다).
 */
export function fissuresByNode(
  markers: readonly FissureMarker[],
): Map<string, FissureMarker> {
  const byNode = new Map<string, FissureMarker>();
  for (const marker of markers) {
    if (!byNode.has(marker.nodeId)) byNode.set(marker.nodeId, marker);
  }
  return byNode;
}

/**
 * 남은 시간의 짧은 표기. 균열은 몇 분에서 두 시간 사이라 초는 세지 않는다 —
 * "곧 닫힌다"와 "아직 여유가 있다"만 읽히면 된다.
 */
export function remainingText(ms: number): string {
  if (ms <= 0) return "닫힘";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "1분 미만";
  if (minutes < 60) return `${minutes}분`;
  const rest = minutes % 60;
  const hours = Math.floor(minutes / 60);
  return rest === 0 ? `${hours}시간` : `${hours}시간 ${rest}분`;
}

/**
 * 영문 표시명 → 노드 id 색인. 이름이 겹치지 않는다는 것은 빌드 파이프라인이
 * 지키므로(`scripts/build-starchart-data.mts`) 여기서 다시 검사하지 않는다.
 */
export function nodeNamesByEn(
  dataset: StarchartDataset,
): Map<string, string> {
  return new Map(
    Object.entries(dataset.nodes).map(([id, node]) => [node.enName, id]),
  );
}
