/**
 * 커밋된 두 데이터셋을 타입 붙여 내보내는 유일한 지점과, 거기서 한 번만 만드는
 * 앱 공용 파생물.
 *
 * `resolveJsonModule`이 붙여 주는 타입은 JSON 리터럴 그대로여서 우리 도메인
 * 타입과 맞지 않는다 — 단정(assert)이 필요한데, 그걸 임포트하는 곳마다 반복하면
 * 어디서 어떤 모양을 가정하는지 흩어진다. 단정은 여기 한 번만 있다.
 *
 * 데이터셋 자체의 무결성은 빌드 파이프라인(`scripts/build-starchart-*.mts`)과
 * CI 단위 테스트가 지킨다 — 런타임 검증을 여기서 또 하지 않는다.
 */
import starchartJson from "@/data/starchart.json";
import layoutJson from "@/data/starchart-layout.json";
import type { StarchartDataset } from "./dataset.ts";
import type { StarchartLayout } from "./layout.ts";
import { buildProgressGraph, progressNodeIds } from "./progress.ts";

/** 정제 노드 데이터셋 — 앱이 임포트하는 유일한 스타차트 데이터. */
export const starchartDataset = starchartJson as unknown as StarchartDataset;

/** 좌표 데이터셋 — 화면 배치 좌표의 유일한 원본. */
export const starchartLayout = layoutJson as StarchartLayout;

/**
 * 진행도 색인 — 3D 뷰와 폴백 뷰가 같은 그래프에서 3상태를 파생한다. 데이터셋이
 * 빌드 시점에 고정이라 앱마다 한 번 만들어 두면 된다.
 */
export const starchartProgressGraph = buildProgressGraph(starchartDataset);

/** 가져오기가 아는 `Tag`의 기준 — 진행도 대상 노드 전부다(스펙 §5). */
export const knownNodeIds = progressNodeIds(starchartProgressGraph);
