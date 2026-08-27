/**
 * 두 뷰의 카메라 자리 — 성계 전체를 담는 자리와, 한 행성의 노드 구름을 담는 자리.
 *
 * 스펙 §8의 적응 규칙 1번("종횡비 인지 카메라 프레이밍")이다. 세로로 긴 폰
 * 화면은 가로 화각이 좁아, 데스크톱에서 딱 맞던 거리로는 담아야 할 것이 잘린다 —
 * 그래서 거리를 종횡비에서 계산한다.
 *
 * 두 자리의 시선 방향은 같다(같은 고도각·같은 방위). 성계↔행성 전환은 회전 없는
 * 평행이동+접근이 되고, 그래서 `CameraControls.setLookAt(..., true)`의 보간이
 * 곧 스펙 §2.1의 "연속 비행"이 된다 — 세계가 한 번도 뒤집히지 않는다.
 *
 * 순수 함수로 두는 이유: 어떤 화면에서 무엇이 잘리는지는 카메라를 띄우지 않고
 * 계산으로 확인할 수 있어야 한다(단위 테스트가 천체 22개와 노드 307개를 전부
 * 투영해 본다).
 */
import type { SolarSystemBody } from "./bodies.ts";
import type { NodeCloud } from "./node-cloud.ts";

/** 카메라의 수직 화각(도). 씬의 Canvas가 같은 값을 써야 한다. */
export const SOLAR_VIEW_FOV = 50;

/**
 * 황도면을 내려다보는 각도. 0이면 정면에서 봐서 성계가 선으로 뭉치고, 90°면
 * 수직 위에서 봐서 입체감이 사라진다 — 그 사이에서 눈으로 고른 값이다.
 */
const ELEVATION = (40 * Math.PI) / 180;

/** 프레임 가장자리에 남기는 여유. 라벨 글자 폭까지 이 여유가 흡수한다. */
const MARGIN = 0.9;

/**
 * 노드 라벨이 프레임 가장자리에서 요구하는 여유(월드 단위). 라벨은 화면 픽셀
 * 크기가 고정이라 월드 단위로 환산할 수 없다 — 행성 뷰의 흔한 거리에서 표시명
 * 한 줄이 차지하는 폭을 어림한 값이다.
 */
const NODE_LABEL_PAD = 0.6;

export type CameraShot = {
  /** 카메라 위치. */
  position: [number, number, number];
  /** 카메라가 보는 점. 컨트롤의 궤도 중심이기도 하다. */
  target: [number, number, number];
};

/** 프레임에 담아야 하는 점 — 대상(target) 기준 상대 좌표와 그 주위에 남길 여유. */
type FramePoint = { x: number; y: number; z: number; pad: number };

/**
 * 넘긴 점이 전부 프레임에 들어오는 최소 거리.
 *
 * 카메라를 대상에서 (0, D·sinE, D·cosE)만큼 떨어뜨리고 대상을 보면, 대상 기준
 * (x, y, z)에 있는 점은 이렇게 투영된다:
 *
 *     깊이 = D − (y·sinE + z·cosE),  화면y = y·cosE − z·sinE,  화면x = x
 *
 * 두 축이 각각 화각 안에 들어와야 하므로 점마다 필요한 최소 D가 나오고, 그중
 * 가장 큰 값이 답이다.
 */
function frameDistance(points: FramePoint[], aspect: number): number {
  const tan = Math.tan(((SOLAR_VIEW_FOV / 2) * Math.PI) / 180) * MARGIN;
  const sin = Math.sin(ELEVATION);
  const cos = Math.cos(ELEVATION);

  let distance = 0;
  for (const point of points) {
    const toward = point.y * sin + point.z * cos;
    const screenY = point.y * cos - point.z * sin;
    const vertical = (Math.abs(screenY) + point.pad) / tan;
    const horizontal = (Math.abs(point.x) + point.pad) / (tan * aspect);
    distance = Math.max(distance, toward + Math.max(vertical, horizontal));
  }
  return distance;
}

function shotAt(
  target: readonly [number, number, number],
  distance: number,
): CameraShot {
  return {
    position: [
      target[0],
      target[1] + distance * Math.sin(ELEVATION),
      target[2] + distance * Math.cos(ELEVATION),
    ],
    target: [target[0], target[1], target[2]],
  };
}

/**
 * 천체 전부가 프레임에 들어오는 성계 뷰의 자리. 카메라는 x=0 평면에서 태양
 * (원점)을 내려다보므로, 결과는 곧 거리 하나를 고른 것이다.
 */
export function solarViewShot(
  bodies: SolarSystemBody[],
  aspect: number,
): CameraShot {
  return shotAt(
    [0, 0, 0],
    frameDistance(
      // 천체는 점이 아니다 — 대기 셸의 가장자리와 아래에 붙는 라벨까지 담아야 한다
      bodies.map((body) => ({
        x: body.position[0],
        y: body.position[1],
        z: body.position[2],
        pad: -body.labelY,
      })),
      aspect,
    ),
  );
}

/**
 * 한 행성의 노드 구름을 담는 행성 뷰의 자리. 카메라는 구름 원반의 중심을 보고,
 * 그 아래 행성까지 프레임에 남긴다 — 행성 뷰에서도 "어느 행성에 와 있는가"가
 * 보여야 세계가 끊기지 않는다.
 */
export function planetViewShot(
  body: SolarSystemBody,
  cloud: NodeCloud,
  aspect: number,
): CameraShot {
  const [cx, cy, cz] = cloud.center;
  const points: FramePoint[] = cloud.nodes.map((node) => ({
    x: node.position[0] - cx,
    y: node.position[1] - cy,
    z: node.position[2] - cz,
    pad: NODE_LABEL_PAD,
  }));
  const [bx, by, bz] = body.position;
  points.push({ x: bx - cx, y: by - cy, z: bz - cz, pad: body.shellRadius });
  points.push({
    x: bx - cx,
    y: by + body.labelY - cy,
    z: bz - cz,
    pad: 0,
  });
  return shotAt(cloud.center, frameDistance(points, aspect));
}
