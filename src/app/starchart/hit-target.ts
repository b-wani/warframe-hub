"use client";

/**
 * 안 보이지만 눌리는 자리 — 노드와 천체가 함께 쓰는 규약(스펙 §8-3의 탭 타깃).
 *
 * 지도의 것들은 화면에서 5~20px이라 손가락으로 겨냥할 크기가 아니다. 그래서
 * 누르는 것은 보이는 것 자체가 아니라 그것을 감싼 구체이고, 구체는 화면에서
 * 44px을 채우도록 프레임마다 크기를 다시 잡는다(계산은 `tap-target.ts`).
 *
 * 구체를 그리지 않는 방법이 `HIT_MATERIAL`이다. `visible={false}`로 숨기지 않는
 * 이유는 그 반대가 필요해서다 — 레이캐스트는 `visible`을 보지 않으므로 숨겨도
 * 눌리기는 한다. 여기서 원하는 것은 "눌리되 아무것도 그리지 않는" 쪽이라 색과
 * 깊이 쓰기만 끈다.
 */
import type { InstancedMesh, Object3D } from "three";

/** 그리지 않는 재질 — 자리만 차지하고 화면에는 아무 흔적도 남기지 않는다. */
export const HIT_MATERIAL = { colorWrite: false, depthWrite: false } as const;

/**
 * 히트 구체 여럿의 자리와 크기를 다시 쓴다. 반지름이 물체마다 다를 수 있어
 * (교차점 마름모가 일반 노드보다 크다) 크기는 물체별로 물어본다.
 *
 * `scratch`는 부르는 쪽이 넘긴다 — 프레임마다 도는 길이라 `Object3D`를 새로
 * 만들지 않는다.
 *
 * 마지막 한 줄이 이 함수의 핵심이다: `InstancedMesh.raycast`는 자기 바운딩
 * 구체를 **한 번만** 계산해 두고 그 바깥으로 나가는 광선을 통째로 기각한다.
 * 히트 구체가 커진 뒤에도 옛 구체가 남아 있으면 커진 만큼의 가장자리가 눌리지
 * 않는다 — 규칙 3이 노리는 바로 그 자리다. 지워 두면 다음 레이캐스트가 다시
 * 계산한다.
 */
export function writeHitMatrices<
  T extends { position: [number, number, number] },
>(
  mesh: InstancedMesh,
  scratch: Object3D,
  items: readonly T[],
  radiusOf: (item: T) => number,
): void {
  items.forEach((item, index) => {
    scratch.position.set(...item.position);
    scratch.scale.setScalar(radiusOf(item));
    scratch.updateMatrix();
    mesh.setMatrixAt(index, scratch.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.boundingSphere = null;
}
