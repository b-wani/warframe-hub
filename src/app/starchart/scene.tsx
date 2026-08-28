"use client";

/**
 * 성계 뷰와 행성 뷰 — 두 개의 뷰, 하나의 장면(스펙 §2.1).
 *
 * 이 모듈이 three를 끌어들이는 유일한 진입점이다 — 서버 번들에 3D가 들어가지
 * 않도록 `starchart-canvas.tsx`가 `next/dynamic({ ssr: false })`로만 불러온다.
 *
 * 데이터는 정제 노드 데이터셋과 좌표 데이터셋의 정적 임포트뿐이다(스펙 §7).
 * 무엇을 어디에 어떻게 그릴지는 표시 모델(`solarSystemBodies`·`nodeClouds`)이
 * 이미 정했다.
 *
 * 뷰를 바꾸는 것은 장면 교체가 아니라 카메라 이동 하나다 — 행성을 고르면
 * `CameraControls`가 그 행성까지 보간해서 날아가고(변형 A 채택, #32), 돌아올
 * 때도 같은 비행이다. 컷도 모프도 없다.
 */
import { Bvh, CameraControls, useTexture } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { BackSide, SRGBColorSpace, type Texture } from "three";
import { STARFIELD_TEXTURE, SUN, solarSystemBodies } from "@/starchart/bodies";
import {
  SOLAR_VIEW_FOV,
  planetViewShot,
  solarViewShot,
} from "@/starchart/camera";
import { starchartDataset, starchartLayout } from "@/starchart/data";
import { nodeClouds } from "@/starchart/node-cloud";
import { nodeDetail } from "@/starchart/node-detail";
import {
  buildProgressGraph,
  isGroupComplete,
  nodeStates,
  type NodeState,
} from "@/starchart/progress";
import {
  TEXTURE_FILES,
  texturePath,
  type TextureFile,
} from "@/starchart/textures";
import { CelestialBody } from "./celestial-body";
import { NodeCloudView } from "./node-cloud-view";
import { NodeDetailPanel } from "./node-detail-panel";
import styles from "./page.module.css";
import { useStarchartProgress } from "./use-progress";

const { bodies } = solarSystemBodies(starchartDataset, starchartLayout);
const bodyById = new Map(bodies.map((body) => [body.id, body]));
const { clouds } = nodeClouds(starchartDataset, starchartLayout, bodies);
const progressGraph = buildProgressGraph(starchartDataset);

/**
 * 첫 프레임용 카메라 자리. 실제 종횡비는 Canvas 안에서만 알 수 있어
 * `CameraDirector`가 곧 다시 잡는다 — 그 사이 한 프레임이 엉뚱한 곳을 보지 않게
 * 흔한 가로 화면 기준으로 미리 채워 둔다.
 */
const INITIAL_CAMERA = solarViewShot(bodies, 16 / 9).position;

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

/** 카메라 보간의 감쇠 시간(초) — 뷰 전환 비행이 여기서 시네마틱해진다. */
const SMOOTH_TIME = 0.5;

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

function SolarSystem({
  focus,
  cloudBody,
  selected,
  states,
  completeBodies,
  onFocus,
  onSelect,
}: {
  focus: string | null;
  /** 노드 구름을 붙여 둘 천체 — 초점을 놓아도 비행이 끝날 때까지 남는다. */
  cloudBody: string | null;
  selected: string | null;
  /** 노드 id → 파생 3상태. */
  states: ReadonlyMap<string, NodeState>;
  /** 노드를 전부 클리어한 천체 id — 완료 아이콘이 붙는다. */
  completeBodies: ReadonlySet<string>;
  onFocus: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  const maps = usePlanetTextures();
  const cloud = cloudBody ? clouds.get(cloudBody) : undefined;

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

      {/*
        천체를 고르려면 지표면 구체를 레이캐스트해야 하는데, 구체 하나가 4096
        삼각형이라 포인터가 움직일 때마다 22개를 훑으면 그게 곧 프레임이다 —
        BVH로 가속한다(스펙 §7). 텍스처가 오기 전에는 이 트리가 없으므로 Bvh는
        Suspense 안쪽, 즉 여기에 있어야 한다.
      */}
      <Bvh firstHitOnly>
        {bodies.map((body) => (
          <CelestialBody
            key={body.id}
            body={body}
            maps={maps}
            complete={completeBodies.has(body.id)}
            onSelect={onFocus}
          />
        ))}
      </Bvh>

      {cloud && (
        <NodeCloudView
          cloud={cloud}
          labelled={focus === cloud.body}
          selected={selected}
          states={states}
          onSelect={onSelect}
        />
      )}
    </>
  );
}

/**
 * 카메라를 뷰에 맞춰 놓는다 — 성계 전체를 담는 자리, 또는 고른 행성의 노드
 * 구름을 담는 자리(스펙 §8-1).
 *
 * 첫 프레이밍만 즉시고 그 뒤는 전부 보간이다. 그래서 뷰 전환이 곧 연속 비행이
 * 된다 — 이 컴포넌트 말고 전환을 담당하는 곳은 없다.
 *
 * 화면 크기가 바뀌면(폰 회전·창 크기 조절) 다시 잡되, 사용자가 카메라를 만진
 * 뒤에는 손대지 않는다 — 보고 있던 시점을 리사이즈가 끌고 가면 안 된다.
 *
 * 컨트롤은 ref가 아니라 r3f 스토어에서 가져온다(`makeDefault`가 넣어 준다) —
 * 컨트롤 인스턴스가 준비되는 시점이 이 컴포넌트의 마운트보다 늦을 수 있어서,
 * 준비되면 효과가 다시 돌아야 한다.
 */
function CameraDirector({
  focus,
  moved,
}: {
  focus: string | null;
  moved: RefObject<boolean>;
}) {
  const controls = useThree((state) => state.controls);
  const { width, height } = useThree((state) => state.size);
  const flown = useRef(false);

  useEffect(() => {
    if (!isCameraControls(controls) || moved.current) return;
    const body = focus ? bodyById.get(focus) : undefined;
    const cloud = focus ? clouds.get(focus) : undefined;
    const shot =
      body && cloud
        ? planetViewShot(body, cloud, width / height)
        : solarViewShot(bodies, width / height);
    controls.setLookAt(...shot.position, ...shot.target, flown.current);
    flown.current = true;
  }, [controls, focus, moved, width, height]);

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
  const { completedIds, toggle } = useStarchartProgress();
  const [focus, setFocus] = useState<string | null>(null);
  // 초점을 놓아도 구름은 남는다 — 성계로 돌아가는 비행 도중 노드가 툭 꺼지면
  // 그 순간이 컷이 된다. 멀어지는 만큼 옅어지는 일은 구름 쪽이 한다.
  const [cloudBody, setCloudBody] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const focusOn = useCallback(
    (id: string | null) => {
      setSelected(null);
      if (id === focus) return;
      // 뷰가 바뀔 때만 "사용자가 만졌다"를 잊는다 — 새 뷰의 첫 프레이밍은 우리
      // 몫이지만(행성을 누르는 그 클릭의 pointerdown이 이미 컨트롤을 깨워 놨다),
      // 뷰가 그대로면 사용자가 잡아 둔 시점을 리사이즈가 도로 뺏어서는 안 된다.
      moved.current = false;
      setFocus(id);
      if (id) setCloudBody(id);
    },
    [focus],
  );

  // ESC로 성계 뷰까지 한 단계씩 물러난다 — 마우스가 없어도 빠져나올 길이 있어야 한다
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (selected) setSelected(null);
      else focusOn(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusOn, selected]);

  // 완료 집합 하나에서 지도 전체가 다시 파생된다 — 토글 한 번이면 노드 색도
  // 연결선도 행성의 완료 아이콘도 같은 렌더에서 함께 바뀐다(스펙 §4.2).
  const states = useMemo(
    () => nodeStates(progressGraph, completedIds),
    [completedIds],
  );
  const completeBodies = useMemo(
    () =>
      new Set(
        bodies
          .filter((body) =>
            isGroupComplete(progressGraph, completedIds, body.id),
          )
          .map((body) => body.id),
      ),
    [completedIds],
  );

  const focusedBody = focus ? bodyById.get(focus) : undefined;
  const selectedDetail = selected
    ? nodeDetail(starchartDataset, selected)
    : undefined;

  return (
    <>
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
        // 빈 곳을 누르면 노드 선택만 놓는다 — 뷰에서 나가는 것은 명시적 조작이다
        onPointerMissed={() => setSelected(null)}
      >
        <color attach="background" args={["#04060d"]} />
        <ambientLight intensity={0.14} />
        <Suspense fallback={null}>
          <SolarSystem
            focus={focus}
            cloudBody={cloudBody}
            selected={selected}
            states={states}
            completeBodies={completeBodies}
            onFocus={focusOn}
            onSelect={setSelected}
          />
        </Suspense>
        <CameraControls
          makeDefault
          minDistance={3}
          maxDistance={MAX_DISTANCE}
          // 기본값(0.25)은 뷰 전환이 툭 끝나 컷처럼 읽힌다 — 채택안(#32)이 쓴
          // 값으로 늘려 비행이 시네마틱하게 보이게 한다
          smoothTime={SMOOTH_TIME}
          onStart={() => {
            moved.current = true;
          }}
        />
        <CameraDirector focus={focus} moved={moved} />
      </Canvas>

      {focusedBody && (
        <div className={styles.viewHud}>
          <button
            type="button"
            className={styles.backButton}
            onClick={() => focusOn(null)}
          >
            ← 성계로
          </button>
          <p className={styles.focusName} data-focus-body={focusedBody.id}>
            {focusedBody.name}
            {completeBodies.has(focusedBody.id) && (
              <span className={styles.focusComplete} role="img" aria-label="완료">
                ✓
              </span>
            )}
          </p>
          {/* 상세는 호버가 아니라 선택으로 열린다(스펙 §2.2·§8-2) */}
          {selectedDetail && (
            <NodeDetailPanel
              detail={selectedDetail}
              state={states.get(selectedDetail.id) ?? "locked"}
              onToggle={toggle}
            />
          )}
        </div>
      )}
    </>
  );
}
