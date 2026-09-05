"use client";

/**
 * 성계 뷰의 천체 하나 — 텍스처 구체 + 프레넬 대기 셸 (+ 해당 행성만 링).
 *
 * 무엇을 어떻게 그릴지는 전부 표시 모델(`solarSystemBodies`)이 정해서 넘긴다.
 * 이 컴포넌트는 그룹 유형도, 좌표계도, 행성별 무드 색도 모른다.
 */
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
  DoubleSide,
  RingGeometry,
  Vector3,
  type Mesh,
  type Texture,
} from "three";
import type { SolarSystemBody } from "@/starchart/bodies";
import { tapRadius } from "@/starchart/tap-target";
import type { TextureFile } from "@/starchart/textures";
import { AtmosphereShell } from "./atmosphere";
import { MapLabel } from "./map-label";
import { usePointerCursor } from "./pointer-cursor";

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

/**
 * 천체를 누르는 자리 — 지표면보다 큰, 눈에 보이지 않는 구체(스펙 §8-3).
 *
 * 성계 뷰의 행성은 화면에서 지름 5~20px이라 손가락으로 겨냥할 크기가 아니다.
 * 그래서 누르는 것은 지표면이 아니라 그것을 감싼 구체이고, 구체는 화면에서
 * 44px을 채우도록 프레임마다 크기를 다시 잡는다(계산은 `tap-target.ts`).
 * 행성 뷰까지 날아가면 지표면 자체가 화면을 채우므로 구체도 셸 크기로 줄어든다.
 *
 * 그리지는 않는다(`colorWrite`·`depthWrite` 둘 다 끈다) — 레이캐스트는 `visible`을
 * 보지 않으므로 이것만으로 "안 보이지만 눌리는" 자리가 된다.
 */
function BodyHitTarget({
  body,
  onSelect,
}: {
  body: SolarSystemBody;
  onSelect: (id: string) => void;
}) {
  const mesh = useRef<Mesh>(null);
  const pointer = usePointerCursor();
  const center = useMemo(() => new Vector3(...body.position), [body.position]);

  useFrame(({ camera, size }) => {
    if (!mesh.current) return;
    mesh.current.scale.setScalar(
      tapRadius({
        distance: camera.position.distanceTo(center),
        viewportHeight: size.height,
        spacing: body.spacing,
        visualRadius: body.shellRadius,
      }),
    );
  });

  return (
    <mesh
      ref={mesh}
      {...pointer}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(body.id);
      }}
    >
      <sphereGeometry args={[1, 12, 8]} />
      <meshBasicMaterial colorWrite={false} depthWrite={false} />
    </mesh>
  );
}

export function CelestialBody({
  body,
  maps,
  complete,
  onSelect,
}: {
  body: SolarSystemBody;
  maps: Record<TextureFile, Texture>;
  /** 이 행성의 노드를 전부 클리어했는가 — 파생값이다(스펙 §4.2). */
  complete: boolean;
  /** 이 천체를 고르면 카메라가 여기까지 날아간다(스펙 §2.1). */
  onSelect: (id: string) => void;
}) {
  return (
    <group position={body.position}>
      {/*
        포인터를 받는 것은 히트 구체 하나뿐이다 — 지표면·대기 셸·링까지 받게 하면
        r3f가 매 포인터 이동마다 그것들도 전부 레이캐스트한다(지표면 구체 하나가
        4096 삼각형이다).
      */}
      <BodyHitTarget body={body} onSelect={onSelect} />
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
      {/* 행성 전체 클리어는 이름표의 완료 아이콘으로 알린다(스펙 §2.1) */}
      <MapLabel
        id={body.id}
        kind="body"
        position={[0, body.labelY, 0]}
        state={complete ? "complete" : undefined}
        onSelect={onSelect}
      >
        {body.name}
      </MapLabel>
    </group>
  );
}
