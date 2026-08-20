import type { RoadmapNode } from "./schema";

/**
 * 콘텐츠가 기준으로 삼은 게임 업데이트 버전 목록. 로드맵 순서를 유지한
 * 중복 없는 목록이며, 보통 항목 하나다 (노드들이 같은 패치에서 검증됐을 때).
 * 여러 개가 나오면 콘텐츠가 서로 다른 패치를 기준으로 섞여 있다는 뜻이다.
 */
export function patchBaseline(nodes: RoadmapNode[]): string[] {
  return [...new Set(nodes.map((node) => node.basedOnPatch))];
}

/** 기준 패치 목록을 페이지에 그대로 쓸 문구로 만든다. */
export function formatPatchBaseline(patches: string[]): string {
  return patches.length === 0 ? "알 수 없음" : patches.join(", ");
}
