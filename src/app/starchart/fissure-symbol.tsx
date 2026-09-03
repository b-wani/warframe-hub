"use client";

/**
 * 노드에 얹히는 보이드 균열 심볼 — 인게임처럼 "저 노드에 균열이 열렸다"를
 * 지도에서 바로 읽게 한다(스펙 §6).
 *
 * 라벨과 같은 이유로 DOM(`Html`)이다: 로테이션(리스/메소/…)을 색으로만 알리면
 * 색을 구별하지 못하는 눈과 보조기술에는 아무것도 알리지 않은 것이므로, 등급
 * 이름이 글로도 읽혀야 한다.
 *
 * 심볼도 손잡이다 — 누르면 그 노드가 선택돼 상세가 열린다(마름모가 작아 조준하기
 * 어려운 것은 라벨과 같은 사정이다).
 */
import { Html } from "@react-three/drei";
import type { FissureMarker } from "@/starchart/fissures";
import styles from "./page.module.css";

export function FissureSymbol({
  fissure,
  position,
  onSelect,
}: {
  fissure: FissureMarker;
  /** 부모 그룹 기준 위치 — 노드 마름모 위다. */
  position: [number, number, number];
  onSelect: (id: string) => void;
}) {
  return (
    <Html
      center
      position={position}
      zIndexRange={[4, 0]}
      wrapperClass={styles.labelWrapper}
    >
      <button
        type="button"
        className={styles.fissureSymbol}
        data-fissure-node={fissure.nodeId}
        data-fissure-tier={fissure.tier}
        aria-label={`보이드 균열 ${fissure.tierName} — ${fissure.nodeName}`}
        onClick={(event) => {
          // 라벨과 같다 — 막지 않으면 캔버스까지 올라가 선택이 곧바로 지워진다
          event.stopPropagation();
          onSelect(fissure.nodeId);
        }}
      >
        <span aria-hidden className={styles.fissureGlyph}>
          ◈
        </span>
        {fissure.tierName}
      </button>
    </Html>
  );
}
