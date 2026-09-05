/**
 * 손가락으로 누를 수 있는 크기 — 3D 안의 것에 히트 영역을 얼마나 줄지 정한다
 * (스펙 §8의 적응 규칙 3번 "탭 타깃 최소 44px").
 *
 * 3D의 물체는 화면에서 몇 px인지가 고정이 아니다 — 같은 마름모도 카메라가
 * 멀어지면 작아지고, 화면이 낮으면 더 작아진다. 그래서 히트 영역은 월드 크기가
 * 아니라 **화면 크기**로 정해야 한다: 44px을 채우는 월드 반지름을 거리와 화면
 * 높이에서 거꾸로 계산한다.
 *
 * 다만 무한정 키울 수는 없다. 노드 구름은 큐레이션한 배치라 두 노드가 화면에서
 * 23px밖에 안 떨어진 곳도 있고(가장 촘촘한 천왕성), 거기서 44px짜리 히트 영역을
 * 주면 앞의 노드가 뒤의 노드 중심을 덮어 뒤의 노드는 아예 못 누르게 된다. 44px을
 * 채우다가 이웃을 못 누르게 만드는 것은 규칙을 지킨 것이 아니다 — 그래서 이웃
 * 간격의 절반이 상한이다. 44px은 배치가 허락하는 곳에서 채워진다.
 *
 * 아래로도 한 칸 막아 둔다: 히트 영역이 보이는 마름모보다 작으면 "보이는데 안
 * 눌리는" 자리가 생긴다. 상한이 시각 크기보다 작으면 시각 크기를 쓴다.
 */
import { SOLAR_VIEW_FOV } from "./camera.ts";

/** 스펙 §8-3이 요구하는 탭 타깃의 최소 지름(CSS px). */
export const MIN_TAP_PX = 44;

/**
 * 카메라에서 `distance`만큼 떨어진 곳에서 화면 1px이 차지하는 월드 길이.
 *
 * 원근 투영의 세로 화각이 그 거리에서 담는 월드 높이를 화면 높이로 나눈 값이다.
 * 가로가 아니라 세로를 기준으로 삼는 이유는 three의 `fov`가 수직 화각이어서다 —
 * 가로는 종횡비에 따라 달라지지만 이 값은 달라지지 않는다.
 */
export function worldPerPixel(distance: number, viewportHeight: number): number {
  const visible =
    2 * distance * Math.tan(((SOLAR_VIEW_FOV / 2) * Math.PI) / 180);
  return visible / viewportHeight;
}

/**
 * 히트 구체 하나의 월드 반지름.
 *
 * `spacing`은 이 물체와 가장 가까운 이웃 사이의 거리다 — 상한이 여기서 나온다.
 * 이웃이 없으면 `Infinity`를 넘기면 된다(상한 없음).
 */
export function tapRadius({
  distance,
  viewportHeight,
  spacing,
  visualRadius,
}: {
  /** 카메라에서 물체까지의 거리. */
  distance: number;
  /** 화면 높이(CSS px). */
  viewportHeight: number;
  /** 가장 가까운 이웃까지의 거리. */
  spacing: number;
  /** 눈에 보이는 크기 — 히트 영역은 여기서 더 작아지지 않는다. */
  visualRadius: number;
}): number {
  const wanted = (MIN_TAP_PX / 2) * worldPerPixel(distance, viewportHeight);
  return Math.max(visualRadius, Math.min(wanted, spacing / 2));
}

/**
 * 각 점에서 가장 가까운 이웃까지의 거리 — 그대로 `tapRadius`의 `spacing`이 된다.
 *
 * 지도의 것들(천체도, 노드 구름도)은 전부 황도면 위에 눕는 평면 배치라 거리도
 * 평면(xz)에서 잰다. 이웃이 없는 점은 상한이 없다는 뜻으로 `Infinity`다.
 *
 * 개수가 수십 개뿐이라(구름 하나가 최대 21노드, 천체 22개) 짝을 전부 훑는다.
 */
export function nearestSpacings(
  points: readonly (readonly [number, number, number])[],
): number[] {
  const spacings = points.map(() => Infinity);
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const gap = Math.hypot(
        points[i][0] - points[j][0],
        points[i][2] - points[j][2],
      );
      spacings[i] = Math.min(spacings[i], gap);
      spacings[j] = Math.min(spacings[j], gap);
    }
  }
  return spacings;
}
