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
import { Canvas, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useRef, type RefObject } from "react";
import { BackSide, SRGBColorSpace, type Texture } from "three";
import {
  STARFIELD_TEXTURE,
  SUN,
  solarSystemBodies,
} from "@/starchart/bodies";
import { SOLAR_VIEW_FOV, solarViewHome } from "@/starchart/camera";
import { starchartDataset, starchartLayout } from "@/starchart/data";
import {
  TEXTURE_FILES,
  texturePath,
  type TextureFile,
} from "@/starchart/textures";
import { CelestialBody } from "./celestial-body";

const { bodies } = solarSystemBodies(starchartDataset, starchartLayout);

/**
 * 첫 프레임용 카메라 자리. 실제 종횡비는 Canvas 안에서만 알 수 있어
 * `HomeFraming`이 곧 다시 잡는다 — 그 사이 한 프레임이 엉뚱한 곳을 보지 않게
 * 흔한 가로 화면 기준으로 미리 채워 둔다.
 */
const INITIAL_CAMERA = solarViewHome(bodies, 16 / 9);

const TEXTURE_URLS = Object.fromEntries(
  TEXTURE_FILES.map((file) => [file, texturePath(file)]),
) as Record<TextureFile, string>;

/**
 * 줌아웃 한계. 세로로 가장 긴 폰에서도 홈 거리가 900을 넘지 않으므로(스펙 §8-1의
 * 프레이밍 계산) 그보다 넉넉히 둔다 — 한계가 홈 거리보다 가까우면 컨트롤이
 * 프레이밍을 잘라 버린다.
 */
const MAX_DISTANCE = 1600;

/** 별 배경의 반지름 — 줌아웃 한계 바깥을 감싼다. */
const BACKGROUND_RADIUS = 2000;

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

/**
 * 성계 전체가 프레임에 들어오도록 카메라를 홈 포지션에 놓는다(스펙 §8-1).
 *
 * 화면 크기가 바뀌면(폰 회전·창 크기 조절) 다시 잡되, 사용자가 한 번 카메라를
 * 만진 뒤에는 손대지 않는다 — 보고 있던 시점을 리사이즈가 끌고 가면 안 된다.
 *
 * 컨트롤은 ref가 아니라 r3f 스토어에서 가져온다(`makeDefault`가 넣어 준다) —
 * 컨트롤 인스턴스가 준비되는 시점이 이 컴포넌트의 마운트보다 늦을 수 있어서,
 * 준비되면 효과가 다시 돌아야 한다.
 */
function HomeFraming({ moved }: { moved: RefObject<boolean> }) {
  const controls = useThree((state) => state.controls);
  const { width, height } = useThree((state) => state.size);

  useEffect(() => {
    if (!isCameraControls(controls) || moved.current) return;
    const [x, y, z] = solarViewHome(bodies, width / height);
    controls.setLookAt(x, y, z, 0, 0, 0, false);
  }, [controls, moved, width, height]);

  return null;
}

/** 스토어의 컨트롤이 우리가 붙인 CameraControls인가. */
function isCameraControls(
  controls: unknown,
): controls is { setLookAt: CameraControls["setLookAt"] } {
  return (
    typeof (controls as { setLookAt?: unknown } | null)?.setLookAt ===
    "function"
  );
}

export default function Scene() {
  const moved = useRef(false);

  return (
    <Canvas
      // 모바일도 같은 3D를 돌린다(스펙 §8) — DPR 상한으로 픽셀 수를 묶는다
      dpr={[1, 2]}
      // 자전·공전이 없는 정적 장면이지만 frameloop는 기본값(연속)을 쓴다 —
      // "demand"는 첫 프레임 요청을 놓쳐 빈 화면이 뜨는 사례가 있었다.
      // 프레임 예산 조정은 별건이다(#51의 품질 조정).
      gl={{ antialias: true }}
      camera={{
        position: INITIAL_CAMERA,
        fov: SOLAR_VIEW_FOV,
        near: 0.1,
        far: 5000,
      }}
    >
      <color attach="background" args={["#04060d"]} />
      <ambientLight intensity={0.14} />
      <Suspense fallback={null}>
        <SolarSystem />
      </Suspense>
      <CameraControls
        makeDefault
        minDistance={3}
        maxDistance={MAX_DISTANCE}
        onStart={() => {
          moved.current = true;
        }}
      />
      <HomeFraming moved={moved} />
    </Canvas>
  );
}
