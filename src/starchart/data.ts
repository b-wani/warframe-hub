/**
 * 커밋된 두 데이터셋을 타입 붙여 내보내는 유일한 지점.
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

/** 정제 노드 데이터셋 — 앱이 임포트하는 유일한 스타차트 데이터. */
export const starchartDataset = starchartJson as unknown as StarchartDataset;

/** 좌표 데이터셋 — 화면 배치 좌표의 유일한 원본. */
export const starchartLayout = layoutJson as StarchartLayout;
