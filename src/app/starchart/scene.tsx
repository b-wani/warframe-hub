"use client";

/**
 * 성계 뷰와 행성 뷰 — 두 개의 뷰, 하나의 장면(스펙 §2.1).
 *
 * 이 모듈이 three를 끌어들이는 유일한 진입점이다 — 3D 뷰에 들어갈 때만 내려오도록
 * `starchart-view.tsx`가 `next/dynamic({ ssr: false })`로만 불러온다.
 *
 * 완료 집합은 여기 없다 — 폴백 뷰와 같은 집합을 써야 하므로 뷰보다 위에 있다.
 *
 * 데이터는 정제 노드 데이터셋과 좌표 데이터셋의 정적 임포트뿐이다(스펙 §7).
 * 무엇을 어디에 어떻게 그릴지는 표시 모델(`solarSystemBodies`·`nodeClouds`)이
 * 이미 정했다.
 *
 * 실시간 월드스테이트(활성 균열)도 여기서 받는다 — 지도와 진행도는 월드스테이트와
 * 무관하게 온전해야 하므로, 스냅숏이 없으면 균열 심볼과 목록만 비고 나머지는
 * 아무것도 달라지지 않는다(스펙 §6).
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
import {
  starchartDataset,
  starchartLayout,
  starchartNodeNames,
  starchartPlanetGuides,
  starchartProgressGraph as progressGraph,
} from "@/starchart/data";
import {
  activeFissures,
  fissuresByNode,
  type FissureMarker,
} from "@/starchart/fissures";
import { nodeClouds, type NodeCloud } from "@/starchart/node-cloud";
import { nodeDetail } from "@/starchart/node-detail";
import {
  isGroupComplete,
  nodeStates,
  type NodeState,
} from "@/starchart/progress";
import { isBodyComplete, proximaRings } from "@/starchart/proxima";
import {
  TEXTURE_FILES,
  texturePath,
  type TextureFile,
} from "@/starchart/textures";
import { BulkComplete } from "./bulk-complete";
import { CelestialBody } from "./celestial-body";
import { FissureList, type FissureStatus } from "./fissure-list";
import { NodeCloudView } from "./node-cloud-view";
import { NodeDetailPanel } from "./node-detail-panel";
import styles from "./page.module.css";
import { PlanetGuidePanel } from "./planet-guide-panel";
import { useNow } from "./use-now";
import { useWorldState } from "./use-worldstate";

const { bodies } = solarSystemBodies(starchartDataset, starchartLayout);
const bodyById = new Map(bodies.map((body) => [body.id, body]));
const { clouds } = nodeClouds(starchartDataset, starchartLayout, bodies);
/**
 * 행성 id → 그 행성의 프록시마 고리. 조회 하나가 곧 ⚓ 토글의 노출 조건이다 —
 * 프록시마가 없는 행성에는 토글이 없다(스펙 §2.1).
 */
const { rings } = proximaRings(starchartDataset, starchartLayout, bodies);

/** 남은 시간·만료를 다시 세는 간격. 스냅숏 갱신과 별개의 눈금이다. */
const FISSURE_TICK_MS = 15_000;

/** 균열을 놓을 수 있는 천체 — 지도에 없는 그룹의 균열은 표시할 자리가 없다. */
const bodyIds = new Set(bodies.map((body) => body.id));

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
  cloud,
  selected,
  states,
  completeBodies,
  fissures,
  onFocus,
  onSelect,
}: {
  focus: string | null;
  /**
   * 지금 그릴 원반 — 행성의 노드 구름이거나 ⚓ 토글이 켜진 프록시마 고리다.
   * 초점을 놓아도 비행이 끝날 때까지 남는다.
   */
  cloud: NodeCloud | undefined;
  selected: string | null;
  /** 노드 id → 파생 3상태. */
  states: ReadonlyMap<string, NodeState>;
  /** 노드를 전부 클리어한 천체 id — 완료 아이콘이 붙는다. */
  completeBodies: ReadonlySet<string>;
  /** 노드 id → 활성 균열. 월드스테이트가 없으면 비어 있다. */
  fissures: ReadonlyMap<string, FissureMarker>;
  onFocus: (id: string) => void;
  onSelect: (id: string) => void;
}) {
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
          fissures={fissures}
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
  cloud,
  moved,
}: {
  focus: string | null;
  /** 프레임에 담아야 하는 원반 — ⚓ 토글을 켜면 프록시마 고리가 그 대상이다. */
  cloud: NodeCloud | undefined;
  moved: RefObject<boolean>;
}) {
  const controls = useThree((state) => state.controls);
  const { width, height } = useThree((state) => state.size);
  const flown = useRef(false);

  useEffect(() => {
    if (!isCameraControls(controls) || moved.current) return;
    const body = focus ? bodyById.get(focus) : undefined;
    const shot =
      body && cloud
        ? planetViewShot(body, cloud, width / height)
        : solarViewShot(bodies, width / height);
    controls.setLookAt(...shot.position, ...shot.target, flown.current);
    flown.current = true;
  }, [controls, focus, cloud, moved, width, height]);

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

export default function Scene({
  completedIds,
  onToggle,
  onBulkComplete,
}: {
  /** 완료 집합은 뷰보다 위(`starchart-view`)에 있다 — 여기서는 읽기만 한다. */
  completedIds: ReadonlySet<string>;
  /** 개별 체크(§4.3) — 폴백 뷰의 체크리스트와 같은 조작이다. */
  onToggle: (id: string) => void;
  /** 구간 일괄 체크 확정(§4.3) — 폴백 뷰의 같은 조작과 한 자리로 모인다. */
  onBulkComplete: (addedIds: ReadonlySet<string>) => void;
}) {
  const worldState = useWorldState();
  // 균열이 닫히는 것을 지도가 알아야 한다. 스냅숏 갱신(60초)보다 촘촘히 세는
  // 이유는 남은 시간이 분 단위 표기라서다 — 갱신 박자로 세면 "1분 미만"이라고
  // 적어 둔 균열이 한 박자 내내 남는다.
  const now = useNow(FISSURE_TICK_MS);
  const moved = useRef(false);
  const [focus, setFocus] = useState<string | null>(null);
  // 초점을 놓아도 구름은 남는다 — 성계로 돌아가는 비행 도중 노드가 툭 꺼지면
  // 그 순간이 컷이 된다. 멀어지는 만큼 옅어지는 일은 구름 쪽이 한다.
  const [cloudBody, setCloudBody] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  // ⚓ 토글 — 행성의 노드 구름과 프록시마 고리 중 무엇을 보고 있는가(스펙 §2.1).
  // 행성을 옮기면 꺼진다: 프록시마가 없는 행성으로 날아가면 볼 것이 없고,
  // 있는 행성이어도 행성 뷰의 기본은 그 행성의 노드 구름이다.
  const [proxima, setProxima] = useState(false);

  const focusOn = useCallback(
    (id: string | null) => {
      setSelected(null);
      setProxima(false);
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

  // ⚓ 토글도 뷰가 바뀌는 조작이다 — 카메라가 고리까지 다시 날아가고(컷이 아니다)
  // 고른 노드는 놓는다. 지금 화면에 없는 노드의 상세가 남아 있을 자리는 없다.
  const toggleProxima = useCallback(() => {
    setSelected(null);
    moved.current = false;
    setProxima((on) => !on);
  }, []);

  // 목록 탭에서 균열을 고르면 그 행성까지 연속 비행하고 노드를 골라 둔다 —
  // 전환은 언제나 카메라 하나다(스펙 §2.1).
  const goToFissure = useCallback(
    (marker: FissureMarker) => {
      focusOn(marker.bodyId);
      setSelected(marker.nodeId);
    },
    [focusOn],
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
  // 완료 아이콘의 주체는 그룹이 아니라 천체다 — 행성 뷰에서 ⚓ 토글로 닿는
  // 프록시마 노드까지 채워졌을 때만 그 행성이 완료다(스펙 §4.2).
  const completeBodies = useMemo(
    () =>
      new Set(
        bodies
          .filter((body) => isBodyComplete(progressGraph, completedIds, body.id))
          .map((body) => body.id),
      ),
    [completedIds],
  );

  // 활성 균열은 받은 스냅숏에서 파생된다 — 닫힌 균열은 다음 스냅숏을 기다리지
  // 않고 눈금이 한 번 갈 때 빠진다.
  const fissureMarkers = useMemo(
    () =>
      activeFissures(worldState?.fissures ?? null, {
        dataset: starchartDataset,
        names: starchartNodeNames,
        bodies: bodyIds,
        now,
      }),
    [worldState, now],
  );
  const fissures = useMemo(
    () => fissuresByNode(fissureMarkers),
    [fissureMarkers],
  );
  const fissureStatus: FissureStatus =
    worldState === null || worldState.fissures === null
      ? "unavailable"
      : worldState.stale
        ? "stale"
        : "ok";

  const focusedBody = focus ? bodyById.get(focus) : undefined;
  // 초점이 있는 행성의 프록시마 고리. 없으면 ⚓ 토글도 없다.
  const focusedRing = focus ? rings.get(focus) : undefined;
  /** 지금 그릴 원반 — 토글이 켜졌고 고리가 있으면 고리, 아니면 노드 구름이다. */
  const cloudFor = (bodyId: string | null): NodeCloud | undefined => {
    if (!bodyId) return undefined;
    return (proxima ? rings.get(bodyId)?.cloud : undefined) ?? clouds.get(bodyId);
  };
  const selectedDetail = selected
    ? nodeDetail(starchartDataset, selected)
    : undefined;

  /**
   * 행성 뷰 HUD가 말하는 대상 — 행성이거나, ⚓ 토글로 들어온 그 행성의
   * 프록시마다. 완료 표식도 그 대상의 것이다: 행성은 종속 프록시마까지 포함한
   * 천체 완료(§4.2), 프록시마는 그 그룹의 완료다.
   */
  const hud = !focusedBody
    ? undefined
    : proxima && focusedRing
      ? {
          body: focusedBody.id,
          group: focusedRing.group,
          name: focusedRing.name,
          complete: isGroupComplete(
            progressGraph,
            completedIds,
            focusedRing.group,
          ),
        }
      : {
          body: focusedBody.id,
          group: focusedBody.id,
          name: focusedBody.name,
          complete: completeBodies.has(focusedBody.id),
        };

  /** 지금 행성 뷰가 보고 있는 행성의 가이드. 프록시마를 보고 있으면 없다. */
  const guide =
    focusedBody && !(proxima && focusedRing)
      ? starchartPlanetGuides.get(focusedBody.id)
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
            cloud={cloudFor(cloudBody)}
            selected={selected}
            states={states}
            completeBodies={completeBodies}
            fissures={fissures}
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
        <CameraDirector focus={focus} cloud={cloudFor(focus)} moved={moved} />
      </Canvas>

      {/* 균열 목록은 성계 뷰에서도 필요하다 — 어느 행성에 열렸는지부터 읽는다 */}
      <FissureList
        markers={fissureMarkers}
        status={fissureStatus}
        now={now}
        onGo={goToFissure}
      />

      {hud && (
        <div className={styles.viewHud}>
          <button
            type="button"
            className={styles.backButton}
            onClick={() => focusOn(null)}
          >
            ← 성계로
          </button>
          {/* 지금 어디에 와 있는지 — 행성 이름이거나 프록시마 이름이다 */}
          <p
            className={styles.focusName}
            data-focus-body={hud.body}
            data-focus-group={hud.group}
          >
            {hud.name}
            {hud.complete && (
              <span className={styles.focusComplete} role="img" aria-label="완료">
                ✓
              </span>
            )}
          </p>
          {/*
            ⚓ 토글 — 프록시마 그룹이 있는 행성에만 있다(스펙 §2.1). 누르면 노드
            구름 대신 행성 바깥 고리가 뜨고, 다시 누르면 구름으로 돌아온다.
          */}
          {focusedRing && (
            <button
              type="button"
              className={styles.proximaToggle}
              data-proxima-toggle={focusedRing.group}
              aria-pressed={proxima}
              onClick={toggleProxima}
            >
              <span aria-hidden="true">⚓</span> 프록시마
            </button>
          )}
          {/* 행성 전체 완료 — 구간 일괄 체크의 한 형태다(스펙 §4.3) */}
          <BulkComplete
            target={{ kind: "group", id: hud.group }}
            proxima={hud.group !== hud.body}
            completedIds={completedIds}
            onComplete={onBulkComplete}
            className={styles.hudBulk}
          />
          {/*
            행성 가이드 — 행성 뷰에 함께 뜨는 안내와 비노드 목표 체크(스펙 §2.1).
            ⚓ 토글로 프록시마를 보고 있을 때는 뜨지 않는다: 가이드가 말하는 것은
            행성이고, 그때 HUD가 말하는 대상은 프록시마다.
          */}
          {guide && (
            <PlanetGuidePanel
              guide={guide}
              completedIds={completedIds}
              onToggle={onToggle}
              className={styles.hudGuide}
            />
          )}
          {/* 상세는 호버가 아니라 선택으로 열린다(스펙 §2.2·§8-2) */}
          {selectedDetail && (
            <NodeDetailPanel
              detail={selectedDetail}
              state={states.get(selectedDetail.id) ?? "locked"}
              completedIds={completedIds}
              onToggle={onToggle}
              onBulkComplete={onBulkComplete}
            />
          )}
        </div>
      )}
    </>
  );
}
