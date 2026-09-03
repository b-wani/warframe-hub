"use client";

/**
 * 한 행성의 노드 구름 — 마름모 노드 + `nextNodes` 연결선 + 표시명 라벨.
 *
 * 무엇을 어디에 그릴지는 전부 표시 모델(`nodeClouds`)이 정해서 넘긴다. 이
 * 컴포넌트는 좌표계도, 그래프도 모른다. 노드 3상태도 파생값을 받기만 한다 —
 * 완료 집합에서 어떻게 계산되는지는 진행도 도메인 소관이다(스펙 §4.2).
 *
 * 3상태 시각은 인게임 규칙 그대로다(스펙 §2.2):
 * 잠김 = 검은 마름모 + 자물쇠 + 점선 연결 / 미클리어 = 파란 마름모 + 흰 실선 /
 * 클리어 = 흰 마름모. 교차점은 마름모를 겹쳐 만든 8각 별로 구별한다.
 *
 * 그리는 방법은 스펙 §7이 정한 그대로다 — 노드는 상태별 `Instances` 덩어리(수백
 * 개여도 상태 수만큼의 드로우 콜), 연결선은 실선·점선 `Line` 둘, 라벨은 `Html`.
 * 상태를 인스턴스 색이 아니라 덩어리로 가르는 이유는 자체발광(emissive)이 재질
 * 단위 값이어서다 — 인스턴스 색만으로는 잠긴 노드도 파랗게 빛난다.
 *
 * 활성 균열이 있는 노드에는 로테이션 심볼이 얹힌다(스펙 §6). 심볼도 라벨과 같은
 * 이유로 DOM이다 — 등급을 색으로만 알리면 색을 구별하지 못하는 눈에는 아무것도
 * 알리지 않은 것이라, 로테이션 이름이 글로도 읽혀야 한다.
 *
 * 구름은 초점을 옮겨도 바로 사라지지 않고 카메라가 멀어지는 만큼 옅어진다.
 * 성계 뷰로 돌아가는 연속 비행 도중에 노드가 툭 꺼지면 그 순간이 컷이 된다 —
 * 연속성이 핵심 경험이라(스펙 §2.1) 사라지는 쪽도 비행에 맡긴다.
 */
import { Instance, Instances, Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  useMemo,
  useRef,
  useState,
  type ComponentRef,
  type ReactNode,
} from "react";
import { Vector3, type Group, type MeshStandardMaterial } from "three";
import type { FissureMarker } from "@/starchart/fissures";
import {
  NODE_RADIUS,
  type NodeCloud,
  type NodeMarker,
} from "@/starchart/node-cloud";
import type { NodeState } from "@/starchart/progress";
import { FissureSymbol } from "./fissure-symbol";
import { MapLabel } from "./map-label";
import { usePointerCursor } from "./pointer-cursor";

/** 구름 반지름의 몇 배까지 온전히 보이는가. 행성 뷰의 카메라 거리를 덮는다. */
const FADE_NEAR = 7;

/** 구름 반지름의 몇 배부터 완전히 사라지는가. */
const FADE_FAR = 16;

/**
 * 교차점 마름모는 일반 노드보다 크고, 45° 돌린 마름모를 하나 겹쳐 8각 별
 * 실루엣이 된다 — 어느 각도에서 봐도 일반 노드와 구별된다(스펙 §2.2).
 */
const JUNCTION_RADIUS = NODE_RADIUS * 1.7;

const SELECTED_COLOR = "#ffd166";

/** 이보다 옅어지면 없는 것으로 친다. */
const GONE = 0.01;

/** 3상태의 마름모 색. 자체발광은 재질 단위라 상태마다 덩어리를 따로 만든다. */
const STATE_LOOK: Record<
  NodeState,
  { color: string; emissive: string; emissiveIntensity: number }
> = {
  // 검은 마름모 — 완전한 검정은 배경에 묻혀 형태가 사라진다
  locked: { color: "#252c38", emissive: "#0b1017", emissiveIntensity: 0.8 },
  uncleared: { color: "#4b8fe3", emissive: "#1d4f96", emissiveIntensity: 1.2 },
  cleared: { color: "#f4f8ff", emissive: "#93aecd", emissiveIntensity: 0.7 },
};

const NODE_STATES = ["locked", "uncleared", "cleared"] as const;

/**
 * 파생 상태 지도에서 노드 하나의 상태를 꺼낸다. 지도에 없는 노드는 잠김으로
 * 본다 — 진행도 도메인이 모르는 것을 열어 줄 근거가 화면에는 더더욱 없다.
 */
function stateOf(
  states: ReadonlyMap<string, NodeState>,
  id: string,
): NodeState {
  return states.get(id) ?? "locked";
}

/** 카메라가 구름에서 이만큼 떨어졌을 때의 불투명도. */
function fade(distance: number, radius: number): number {
  const near = radius * FADE_NEAR;
  const far = radius * FADE_FAR;
  if (distance <= near) return 1;
  if (distance >= far) return 0;
  return (far - distance) / (far - near);
}

/**
 * 상태·모양이 같은 노드 한 덩어리. 재질이 덩어리마다 하나이므로 페이드도
 * 덩어리마다 걸어야 한다 — 부모가 프레임마다 만질 수 있게 재질을 넘겨준다.
 */
function NodeInstances({
  nodes,
  state,
  geometry,
  rotation,
  selected,
  onSelect,
  onMaterial,
}: {
  nodes: NodeMarker[];
  state: NodeState;
  geometry: ReactNode;
  /** 덩어리 전체에 같은 각도를 주고 싶을 때. */
  rotation?: [number, number, number];
  selected: string | null;
  /** 없으면 포인터를 받지 않는다 — r3f는 핸들러가 붙은 것만 레이캐스트한다. */
  onSelect?: (id: string) => void;
  onMaterial: (material: MeshStandardMaterial | null) => void;
}) {
  const pointer = usePointerCursor();
  const look = STATE_LOOK[state];

  return (
    <Instances limit={nodes.length} castShadow={false}>
      {geometry}
      {/*
        재질 색은 흰색으로 두고 상태 색은 인스턴스 색으로 넣는다 — 인스턴스 색은
        재질 색에 곱해지므로, 고른 노드 하나만 다른 색으로 덧칠할 수 있다.
      */}
      <meshStandardMaterial
        ref={onMaterial}
        emissive={look.emissive}
        emissiveIntensity={look.emissiveIntensity}
        roughness={0.4}
        metalness={0}
        transparent
      />
      {nodes.map((node) => (
        <Instance
          key={node.id}
          position={node.position}
          rotation={rotation}
          color={node.id === selected ? SELECTED_COLOR : look.color}
          {...(onSelect ? pointer : {})}
          onClick={
            onSelect &&
            ((event) => {
              event.stopPropagation();
              onSelect(node.id);
            })
          }
        />
      ))}
    </Instances>
  );
}

export function NodeCloudView({
  cloud,
  labelled,
  selected,
  states,
  fissures,
  onSelect,
}: {
  cloud: NodeCloud;
  /** 표시명 라벨을 붙일 것인가 — 초점이 이 행성에 있을 때만이다. */
  labelled: boolean;
  selected: string | null;
  /** 노드 id → 파생 3상태. 완료 집합이 바뀌면 이 지도도 함께 바뀐다. */
  states: ReadonlyMap<string, NodeState>;
  /** 노드 id → 활성 균열. 월드스테이트를 못 받으면 비어 있다(스펙 §6). */
  fissures: ReadonlyMap<string, FissureMarker>;
  onSelect: (id: string) => void;
}) {
  const group = useRef<Group>(null);
  const materials = useRef(new Map<string, MeshStandardMaterial>());
  const solid = useRef<ComponentRef<typeof Line>>(null);
  const dashed = useRef<ComponentRef<typeof Line>>(null);
  const center = useMemo(() => new Vector3(...cloud.center), [cloud.center]);
  // 라벨은 DOM이라 3D의 visible을 따라가지 않는다(drei Html은 부모의 visible을
  // 보지 않는다) — 구름이 옅어져 사라졌는지를 따로 알려 줘야 노드만 사라지고
  // 이름표만 허공에 남는 일이 없다. 프레임마다 부르지만 값이 바뀔 때만 그린다.
  const [gone, setGone] = useState(false);

  /** 상태별·모양별 덩어리. 완료 토글 한 번이면 여기가 다시 갈린다. */
  const grouped = useMemo(() => {
    const byKey = new Map<string, NodeMarker[]>();
    for (const node of cloud.nodes) {
      const key = `${node.junction ? "junction" : "node"}:${stateOf(
        states,
        node.id,
      )}`;
      const bucket = byKey.get(key);
      if (bucket) bucket.push(node);
      else byKey.set(key, [node]);
    }
    return byKey;
  }, [cloud.nodes, states]);

  /**
   * 잠긴 노드로 드나드는 선은 점선이다(스펙 §2.2). 아직 갈 수 없는 길이라는 것을
   * 선 하나로도 읽게 하려는 것이라, 한쪽 끝만 잠겨 있어도 점선이다.
   */
  const { solidPoints, dashedPoints } = useMemo(() => {
    const solidPoints: [number, number, number][] = [];
    const dashedPoints: [number, number, number][] = [];
    for (const link of cloud.links) {
      const locked =
        stateOf(states, link.from) === "locked" ||
        stateOf(states, link.to) === "locked";
      (locked ? dashedPoints : solidPoints).push(...link.points);
    }
    return { solidPoints, dashedPoints };
  }, [cloud.links, states]);

  useFrame(({ camera }) => {
    const opacity = fade(camera.position.distanceTo(center), cloud.radius);
    const faded = opacity <= GONE;
    if (group.current) group.current.visible = !faded;
    for (const material of materials.current.values()) {
      material.opacity = opacity;
    }
    if (solid.current) solid.current.material.opacity = opacity * 0.65;
    if (dashed.current) dashed.current.material.opacity = opacity * 0.45;
    if (faded !== gone) setGone(faded);
  });

  return (
    <group ref={group}>
      {solidPoints.length > 0 && (
        <Line
          ref={solid}
          points={solidPoints}
          segments
          color="#e2ecfa"
          lineWidth={1}
          transparent
          depthWrite={false}
        />
      )}
      {dashedPoints.length > 0 && (
        <Line
          ref={dashed}
          points={dashedPoints}
          segments
          dashed
          dashSize={0.1}
          gapSize={0.09}
          color="#5d6b80"
          lineWidth={1}
          transparent
          depthWrite={false}
        />
      )}

      {NODE_STATES.map((state) => {
        const plain = grouped.get(`node:${state}`);
        const junctions = grouped.get(`junction:${state}`);
        return (
          <group key={state}>
            {plain && (
              <NodeInstances
                nodes={plain}
                state={state}
                selected={selected}
                onSelect={onSelect}
                onMaterial={(material) =>
                  keep(materials.current, `node:${state}`, material)
                }
                /* 인게임 노드는 마름모다 — 정팔면체를 그대로 쓴다 */
                geometry={<octahedronGeometry args={[NODE_RADIUS, 0]} />}
              />
            )}
            {junctions && (
              <>
                <NodeInstances
                  nodes={junctions}
                  state={state}
                  selected={selected}
                  onSelect={onSelect}
                  onMaterial={(material) =>
                    keep(materials.current, `junction:${state}`, material)
                  }
                  geometry={<octahedronGeometry args={[JUNCTION_RADIUS, 0]} />}
                />
                {/* 겹치는 마름모는 실루엣일 뿐이다 — 누르는 것은 아래 하나다 */}
                <NodeInstances
                  nodes={junctions}
                  state={state}
                  selected={selected}
                  rotation={[0, Math.PI / 4, 0]}
                  onMaterial={(material) =>
                    keep(materials.current, `star:${state}`, material)
                  }
                  geometry={
                    <octahedronGeometry args={[JUNCTION_RADIUS * 0.78, 0]} />
                  }
                />
              </>
            )}
          </group>
        );
      })}

      {labelled &&
        !gone &&
        cloud.nodes.map((node) => {
          const fissure = fissures.get(node.id);
          if (!fissure) return null;
          return (
            <FissureSymbol
              key={`fissure:${node.id}`}
              fissure={fissure}
              position={[
                node.position[0],
                node.position[1] + NODE_RADIUS * 5,
                node.position[2],
              ]}
              onSelect={onSelect}
            />
          );
        })}

      {labelled &&
        !gone &&
        cloud.nodes.map((node) => (
          <MapLabel
            key={node.id}
            id={node.id}
            kind="node"
            position={[
              node.position[0],
              node.position[1] + NODE_RADIUS * 2.5,
              node.position[2],
            ]}
            state={stateOf(states, node.id)}
            selected={node.id === selected}
            onSelect={onSelect}
          >
            {node.name}
          </MapLabel>
        ))}
    </group>
  );
}

/** 재질 ref 하나를 페이드 대상으로 넣거나 뺀다. */
function keep(
  registry: Map<string, MeshStandardMaterial>,
  key: string,
  material: MeshStandardMaterial | null,
): void {
  if (material) registry.set(key, material);
  else registry.delete(key);
}
