import {
  InstancedMesh,
  MeshBasicMaterial,
  Object3D,
  Raycaster,
  SphereGeometry,
  Vector3,
  type Intersection,
} from "three";
import { describe, expect, test } from "vitest";
import { writeHitMatrices } from "./hit-target";

/** 히트 구체 둘 — 월드 x=0과 x=10에 하나씩. */
const items: { position: [number, number, number] }[] = [
  { position: [0, 0, 0] },
  { position: [10, 0, 0] },
];

function hitMesh(): InstancedMesh {
  return new InstancedMesh(
    new SphereGeometry(1, 8, 6),
    new MeshBasicMaterial(),
    items.length,
  );
}

/** x=`at`에서 아래(−z)로 쏜 광선이 무엇에든 맞는가. */
function hits(mesh: InstancedMesh, at: number): boolean {
  mesh.updateMatrixWorld(true);
  const raycaster = new Raycaster(
    new Vector3(at, 0, 20),
    new Vector3(0, 0, -1),
  );
  const found: Intersection[] = [];
  mesh.raycast(raycaster, found);
  return found.length > 0;
}

describe("writeHitMatrices", () => {
  test("넘긴 반지름만큼의 구체가 그 자리에 선다", () => {
    const mesh = hitMesh();
    writeHitMatrices(mesh, new Object3D(), items, () => 0.5);
    expect(hits(mesh, 10.4)).toBe(true);
    expect(hits(mesh, 10.6)).toBe(false);
  });

  test("물체마다 다른 반지름을 줄 수 있다", () => {
    const mesh = hitMesh();
    writeHitMatrices(mesh, new Object3D(), items, (item) =>
      item.position[0] === 0 ? 2 : 0.5,
    );
    expect(hits(mesh, 1.5)).toBe(true);
    expect(hits(mesh, 10.6)).toBe(false);
  });

  /**
   * 이 파일이 있는 이유. `InstancedMesh.raycast`는 자기 바운딩 구체를 한 번만
   * 계산해 두고 그 바깥의 광선을 인스턴스 검사도 없이 기각한다 — 카메라가
   * 멀어져 히트 구체가 커진 뒤에도 옛 구체가 남아 있으면, 커진 만큼의 가장자리가
   * 통째로 안 눌린다.
   */
  test("커진 뒤에는 커진 만큼 눌린다 — 옛 바운딩 구체가 기각하지 않는다", () => {
    const mesh = hitMesh();
    const scratch = new Object3D();

    writeHitMatrices(mesh, scratch, items, () => 0.2);
    // 첫 레이캐스트가 작은 바운딩 구체를 계산해 둔다
    expect(hits(mesh, 10.9)).toBe(false);

    writeHitMatrices(mesh, scratch, items, () => 1);
    expect(hits(mesh, 10.9)).toBe(true);
  });
});
