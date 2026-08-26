"use client";

/**
 * 성계 뷰의 천체 하나 — 텍스처 구체 + 프레넬 대기 셸 (+ 해당 행성만 링).
 *
 * 무엇을 어떻게 그릴지는 전부 표시 모델(`solarSystemBodies`)이 정해서 넘긴다.
 * 이 컴포넌트는 그룹 유형도, 좌표계도, 행성별 무드 색도 모른다.
 */
import { Html } from "@react-three/drei";
import { useMemo } from "react";
import { DoubleSide, RingGeometry, Vector3, type Texture } from "three";
import type { SolarSystemBody } from "@/starchart/bodies";
import type { TextureFile } from "@/starchart/textures";
import { AtmosphereShell } from "./atmosphere";
import styles from "./page.module.css";

/**
 * 링 텍스처는 반지름 방향으로 늘어선 가로 스트립인데 `RingGeometry`의 기본 UV는
 * 방사형이 아니다 — 잘 알려진 함정이라 UV를 반지름 비율로 다시 쓴다(#31의 (d)).
 */
function useRingGeometry(inner: number, outer: number): RingGeometry {
  return useMemo(() => {
    const geometry = new RingGeometry(inner, outer, 128, 1);
    const position = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    const vertex = new Vector3();
    for (let i = 0; i < position.count; i++) {
      vertex.fromBufferAttribute(position, i);
      const radial = (vertex.length() - inner) / (outer - inner);
      uv.setXY(i, radial, 0.5);
    }
    uv.needsUpdate = true;
    return geometry;
  }, [inner, outer]);
}

function Ring({
  ring,
  map,
  tint,
}: {
  ring: NonNullable<SolarSystemBody["ring"]>;
  map: Texture;
  tint: string;
}) {
  const geometry = useRingGeometry(ring.inner, ring.outer);
  // 황도면에 눕히고 자전축 기울기만큼 살짝 기울인다
  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2 + 0.24, 0, 0]}>
      <meshBasicMaterial
        map={map}
        color={tint}
        side={DoubleSide}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

export function CelestialBody({
  body,
  maps,
}: {
  body: SolarSystemBody;
  maps: Record<TextureFile, Texture>;
}) {
  return (
    <group position={body.position}>
      <mesh>
        <sphereGeometry args={[body.radius, 64, 32]} />
        <meshStandardMaterial
          map={maps[body.texture]}
          color={body.tint}
          roughness={0.85}
          metalness={0}
        />
      </mesh>
      <AtmosphereShell
        surfaceRadius={body.radius}
        shellRadius={body.shellRadius}
        color={body.atmosphere}
      />
      {body.ring && (
        <Ring ring={body.ring} map={maps[body.ring.texture]} tint={body.tint} />
      )}
      <Html
        center
        position={[0, -(body.shellRadius + 0.6), 0]}
        zIndexRange={[5, 0]}
        wrapperClass={styles.labelWrapper}
      >
        <span className={styles.label} data-body-id={body.id}>
          {body.name}
        </span>
      </Html>
    </group>
  );
}
