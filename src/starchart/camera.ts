/**
 * 성계 뷰의 홈 포지션 — 태양계 전체가 프레임에 들어오는 카메라 자리.
 *
 * 스펙 §8의 적응 규칙 1번("종횡비 인지 카메라 프레이밍")이다. 세로로 긴 폰
 * 화면은 가로 화각이 좁아, 데스크톱에서 딱 맞던 거리로는 성계 좌우가 잘린다 —
 * 그래서 거리를 종횡비에서 계산한다.
 *
 * 순수 함수로 두는 이유: 어떤 화면에서 무엇이 잘리는지는 카메라를 띄우지 않고
 * 계산으로 확인할 수 있어야 한다(단위 테스트가 22개 천체를 전부 투영해 본다).
 * 행성으로 날아가는 연속 비행(#42)은 이 자리에서 출발하고, "성계 뷰로 돌아가기"도
 * 여기로 돌아온다.
 */
import type { SolarSystemBody } from "./bodies.ts";

/** 성계 뷰 카메라의 수직 화각(도). 씬의 Canvas가 같은 값을 써야 한다. */
export const SOLAR_VIEW_FOV = 50;

/**
 * 황도면을 내려다보는 각도. 0이면 정면에서 봐서 성계가 선으로 뭉치고, 90°면
 * 수직 위에서 봐서 입체감이 사라진다 — 그 사이에서 눈으로 고른 값이다.
 */
const ELEVATION = (40 * Math.PI) / 180;

/** 프레임 가장자리에 남기는 여유. 라벨 글자 폭까지 이 여유가 흡수한다. */
const MARGIN = 0.9;

/**
 * 천체 전부가 프레임에 들어오는 카메라 위치를 돌려준다. 카메라는 x=0 평면에서
 * 태양(원점)을 내려다보므로, 결과는 곧 거리 하나를 고른 것이다.
 *
 * 카메라를 (0, D·sinE, D·cosE)에 두고 원점을 보면, 황도면(y=0) 위의 점
 * (x, 0, z)는 이렇게 투영된다:
 *
 *     깊이 = D − z·cosE,  화면y = −z·sinE,  화면x = x
 *
 * 두 축이 각각 화각 안에 들어와야 하므로 천체마다 필요한 최소 D가 나오고,
 * 그중 가장 큰 값이 답이다.
 */
export function solarViewHome(
  bodies: SolarSystemBody[],
  aspect: number,
): [number, number, number] {
  const tan = Math.tan(((SOLAR_VIEW_FOV / 2) * Math.PI) / 180) * MARGIN;
  const sin = Math.sin(ELEVATION);
  const cos = Math.cos(ELEVATION);

  let distance = 0;
  for (const body of bodies) {
    const [x, , z] = body.position;
    // 천체는 점이 아니다 — 대기 셸의 가장자리와 아래에 붙는 라벨까지 담아야 한다
    const pad = -body.labelY;
    const vertical = (Math.abs(z) * sin + pad) / tan;
    const horizontal = (Math.abs(x) + pad) / (tan * aspect);
    distance = Math.max(distance, z * cos + Math.max(vertical, horizontal));
  }
  return [0, distance * sin, distance * cos];
}
