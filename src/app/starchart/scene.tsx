"use client";

/**
 * 성계 뷰의 3D 장면.
 *
 * 이 모듈이 three를 끌어들이는 유일한 진입점이다 — 서버 번들에 3D가 들어가지
 * 않도록 `starchart-canvas.tsx`가 `next/dynamic({ ssr: false })`로만 불러온다.
 *
 * 데이터는 정제 노드 데이터셋과 좌표 데이터셋의 정적 임포트뿐이다(스펙 §7).
 * 무엇을 어디에 어떻게 그릴지는 표시 모델(`solarSystemBodies`)이 이미 정했다.
 */
import { CameraControls, useTexture } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { BackSide, SRGBColorSpace, type Texture } from "three";
import {
  STARFIELD_TEXTURE,
  SUN,
  solarSystemBodies,
} from "@/starchart/bodies";
import { starchartDataset, starchartLayout } from "@/starchart/data";
import {
  TEXTURE_FILES,
  texturePath,
  type TextureFile,
} from "@/starchart/textures";
import { CelestialBody } from "./celestial-body";

const { bodies } = solarSystemBodies(starchartDataset, starchartLayout);

const TEXTURE_URLS = Object.fromEntries(
  TEXTURE_FILES.map((file) => [file, texturePath(file)]),
) as Record<TextureFile, string>;

/** 별 배경의 반지름 — 가장 먼 천체(약 133)와 줌아웃 한계 바깥을 감싼다. */
const BACKGROUND_RADIUS = 1600;

/**
 * 쓰는 텍스처를 한 번에 받아 파일명으로 나눠 준다 — 여러 천체가 같은 파일을
 * 돌려쓰므로(가상 천체 텍스처) 파일 단위로 캐시되는 편이 맞다.
 */
function usePlanetTextures(): Record<TextureFile, Texture> {
  const maps = useTexture(TEXTURE_URLS);
  // TextureLoader는 색 공간을 지정하지 않는다 — 색상 맵이므로 sRGB로 읽어야 한다.
  // 재질이 만들어지기 전(렌더 중)에 정해야 첫 프레임부터 색이 맞는다. 같은
  // 텍스처 객체를 재질들이 공유하므로 몇 번을 다시 넣어도 결과는 같다.
  for (const texture of Object.values(maps)) {
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 4;
  }
  return maps;
}

function SolarSystem() {
  const maps = usePlanetTextures();

  return (
    <>
      <mesh>
        <sphereGeometry args={[BACKGROUND_RADIUS, 48, 32]} />
        <meshBasicMaterial
          map={maps[STARFIELD_TEXTURE]}
          side={BackSide}
          toneMapped={false}
        />
      </mesh>

      {/* 태양 — 성계 뷰의 원점이자 유일한 광원 */}
      <mesh>
        <sphereGeometry args={[SUN.radius, 64, 32]} />
        <meshBasicMaterial map={maps[SUN.texture]} toneMapped={false} />
      </mesh>
      {/* decay 0 — 실제 감쇠를 쓰면 바깥 궤도의 천체가 새까맣게 죽는다 */}
      <pointLight position={[0, 0, 0]} intensity={3.2} decay={0} />

      {bodies.map((body) => (
        <CelestialBody key={body.id} body={body} maps={maps} />
      ))}
    </>
  );
}

export default function Scene() {
  return (
    <Canvas
      // 모바일도 같은 3D를 돌린다(스펙 §8) — DPR 상한으로 픽셀 수를 묶는다
      dpr={[1, 2]}
      // 자전·공전이 없는 정적 장면이지만 frameloop는 기본값(연속)을 쓴다 —
      // "demand"는 첫 프레임 요청을 놓쳐 빈 화면이 뜨는 사례가 있었다.
      // 프레임 예산 조정은 별건이다(#51의 품질 조정).
      gl={{ antialias: true }}
      // 성계 전체가 프레임에 들어오는 거리에서 비스듬히 내려다본다 — 종횡비
      // 인지 프레이밍은 별건이다(#51)
      camera={{ position: [0, 174, 207], fov: 50, near: 0.1, far: 6000 }}
    >
      <color attach="background" args={["#04060d"]} />
      <ambientLight intensity={0.14} />
      <Suspense fallback={null}>
        <SolarSystem />
      </Suspense>
      <CameraControls makeDefault minDistance={3} maxDistance={1000} />
    </Canvas>
  );
}
