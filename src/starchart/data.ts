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
import nodeOverlaysJson from "@/data/node-overlays.json";
import planetGuidesJson from "@/data/planet-guides.json";
import starchartJson from "@/data/starchart.json";
import layoutJson from "@/data/starchart-layout.json";
import type { StarchartDataset } from "./dataset.ts";
import { nodeNamesByEn } from "./fissures.ts";
import type { StarchartLayout } from "./layout.ts";
import { nodeOverlays, patchBaseline } from "./node-overlay.ts";
import { planetGuides } from "./planet-guide.ts";
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

/**
 * 영문 표시명 색인 — 월드스테이트의 균열을 노드에 붙이는 기준(스펙 §6).
 * 데이터셋이 빌드 시점에 고정이라 앱마다 한 번 만들어 두면 된다.
 */
export const starchartNodeNames = nodeNamesByEn(starchartDataset);

/** 가져오기가 아는 `Tag`의 기준 — 진행도 대상 노드 전부다(스펙 §5). */
export const knownNodeIds = progressNodeIds(starchartProgressGraph);

/**
 * 행성 가이드 — 행성 뷰와 폴백 뷰가 같은 저작물을 읽는다. 잘못된 가이드는 여기서
 * 조용히 빠지고(`issues`) CI 단위 테스트가 잡는다.
 */
export const starchartPlanetGuides = planetGuides(
  starchartDataset,
  planetGuidesJson,
).guides;

/**
 * 큐레이션 오버레이 — 주요 노드의 노드 상세가 구조화 데이터 위에 얹어 읽는
 * 수동 저작 콘텐츠(스펙 §3.3). 잘못된 오버레이는 여기서 조용히 빠지고
 * (`issues`) CI 단위 테스트가 잡는다.
 */
export const starchartNodeOverlays = nodeOverlays(
  starchartDataset,
  nodeOverlaysJson,
).overlays;

/** 콘텐츠 기준 패치 — 페이지가 노출하는 오버레이의 기준 패치를 모은 것. */
export const starchartPatchBaseline = patchBaseline(starchartNodeOverlays);
