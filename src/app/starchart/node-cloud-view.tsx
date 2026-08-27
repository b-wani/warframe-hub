"use client";

/**
 * 한 행성의 노드 구름 — 마름모 노드 + `nextNodes` 연결선 + 표시명 라벨.
 *
 * 무엇을 어디에 그릴지는 전부 표시 모델(`nodeClouds`)이 정해서 넘긴다. 이
 * 컴포넌트는 좌표계도, 그래프도 모른다.
 *
 * 그리는 방법은 스펙 §7이 정한 그대로다 — 노드는 `Instances` 한 덩어리(수백
 * 개여도 드로우 콜 하나), 연결선은 `Line` 하나(segments), 라벨은 `Html`.
 *
 * 구름은 초점을 옮겨도 바로 사라지지 않고 카메라가 멀어지는 만큼 옅어진다.
 * 성계 뷰로 돌아가는 연속 비행 도중에 노드가 툭 꺼지면 그 순간이 컷이 된다 —
 * 연속성이 핵심 경험이라(스펙 §2.1) 사라지는 쪽도 비행에 맡긴다.
 *
 * 3상태 시각(잠김/미클리어/클리어)은 여기 없다 — #43 소관이다.
 */
import { Instance, Instances, Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState, type ComponentRef } from "react";
import { Vector3, type Group, type MeshStandardMaterial } from "three";
import { NODE_RADIUS, type NodeCloud } from "@/starchart/node-cloud";
import { MapLabel } from "./map-label";
import { usePointerCursor } from "./pointer-cursor";

/** 구름 반지름의 몇 배까지 온전히 보이는가. 행성 뷰의 카메라 거리를 덮는다. */
const FADE_NEAR = 7;

/** 구름 반지름의 몇 배부터 완전히 사라지는가. */
const FADE_FAR = 16;

const NODE_COLOR = "#cfe0f5";
const SELECTED_COLOR = "#ffd166";

/** 이보다 옅어지면 없는 것으로 친다. */
const GONE = 0.01;

/** 카메라가 구름에서 이만큼 떨어졌을 때의 불투명도. */
function fade(distance: number, radius: number): number {
  const near = radius * FADE_NEAR;
  const far = radius * FADE_FAR;
  if (distance <= near) return 1;
  if (distance >= far) return 0;
  return (far - distance) / (far - near);
}

export function NodeCloudView({
  cloud,
  labelled,
  selected,
  onSelect,
}: {
  cloud: NodeCloud;
  /** 표시명 라벨을 붙일 것인가 — 초점이 이 행성에 있을 때만이다. */
  labelled: boolean;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const group = useRef<Group>(null);
  const nodes = useRef<MeshStandardMaterial>(null);
  const links = useRef<ComponentRef<typeof Line>>(null);
  const center = useMemo(() => new Vector3(...cloud.center), [cloud.center]);
  const pointer = usePointerCursor();
  // 라벨은 DOM이라 3D의 visible을 따라가지 않는다(drei Html은 부모의 visible을
  // 보지 않는다) — 구름이 옅어져 사라졌는지를 따로 알려 줘야 노드만 사라지고
  // 이름표만 허공에 남는 일이 없다. 프레임마다 부르지만 값이 바뀔 때만 그린다.
  const [gone, setGone] = useState(false);

  useFrame(({ camera }) => {
    const opacity = fade(camera.position.distanceTo(center), cloud.radius);
    const faded = opacity <= GONE;
    if (group.current) group.current.visible = !faded;
    if (nodes.current) nodes.current.opacity = opacity;
    if (links.current) links.current.material.opacity = opacity * 0.55;
    if (faded !== gone) setGone(faded);
  });

  return (
    <group ref={group}>
      {cloud.links.length > 0 && (
        <Line
          ref={links}
          points={cloud.links}
          segments
          color="#7f9dc4"
          lineWidth={1}
          transparent
          depthWrite={false}
        />
      )}

      <Instances limit={cloud.nodes.length} castShadow={false}>
        {/* 인게임 노드는 마름모다 — 정팔면체를 그대로 쓴다 */}
        <octahedronGeometry args={[NODE_RADIUS, 0]} />
        <meshStandardMaterial
          ref={nodes}
          emissive="#33507a"
          emissiveIntensity={1}
          roughness={0.4}
          metalness={0}
          transparent
        />
        {cloud.nodes.map((node) => (
          <Instance
            key={node.id}
            position={node.position}
            color={node.id === selected ? SELECTED_COLOR : NODE_COLOR}
            {...pointer}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(node.id);
            }}
          />
        ))}
      </Instances>

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
            selected={node.id === selected}
            onSelect={onSelect}
          >
            {node.name}
          </MapLabel>
        ))}
    </group>
  );
}
