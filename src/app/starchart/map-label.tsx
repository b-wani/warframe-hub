"use client";

/**
 * 지도 위의 이름표 — 겸 손잡이.
 *
 * 라벨은 읽으라고만 있는 것이 아니다. 성계 뷰에서 지구는 지름 5px짜리 점이고
 * 행성 뷰의 마름모도 20px 남짓이라, 조준하기 좋은 크기의 표적은 라벨뿐이다.
 * DOM 버튼이라 키보드로도 닿는다는 점도 같이 얻는다.
 *
 * 라벨에 drei `Text`를 쓰지 않는 이유는 표시명에 한글이 섞여 있어서다 —
 * troika의 기본 폰트에 한글 글리프가 없어 두부가 뜬다.
 *
 * 상태 표식(잠김 자물쇠·행성 완료 체크)도 여기 붙는다. 마름모 색과 행성 광채는
 * 3D 쪽 일이지만, 색만으로 알리면 색을 구별하지 못하는 눈과 보조기술에는 아무
 * 것도 알리지 않은 것이다 — 글자로도 읽히는 자리는 이 DOM 라벨뿐이다.
 */
import { Html } from "@react-three/drei";
import type { ReactNode } from "react";
import type { NodeState } from "@/starchart/progress";
import styles from "./page.module.css";

/** 이름표가 가리키는 것. 겹치면 천체가 노드보다 위에 온다. */
type LabelKind = "body" | "node";

/** 이름표가 알리는 상태 — 노드의 파생 3상태, 또는 행성 전체 클리어. */
export type LabelState = NodeState | "complete";

const LOOK: Record<
  LabelKind,
  { className: string; attribute: string; zIndexRange: [number, number] }
> = {
  body: { className: styles.label, attribute: "data-body-id", zIndexRange: [5, 0] },
  node: {
    className: styles.nodeLabel,
    attribute: "data-node-id",
    zIndexRange: [4, 0],
  },
};

/**
 * 이름 뒤에 붙는 표식. 표식이 없는 상태(미클리어·클리어)는 색과 상세 패널이
 * 맡는다 — 인게임도 자물쇠는 잠긴 노드에만 붙인다(스펙 §2.2).
 */
const MARK: Partial<Record<LabelState, { glyph: string; label: string }>> = {
  locked: { glyph: "🔒", label: "잠김" },
  complete: { glyph: "✓", label: "완료" },
};

export function MapLabel({
  id,
  kind,
  position,
  state,
  selected,
  onSelect,
  children,
}: {
  id: string;
  kind: LabelKind;
  /** 부모 그룹 기준 위치. */
  position: [number, number, number];
  state?: LabelState;
  selected?: boolean;
  onSelect: (id: string) => void;
  children: ReactNode;
}) {
  const look = LOOK[kind];
  const mark = state && MARK[state];

  return (
    <Html
      center
      position={position}
      zIndexRange={look.zIndexRange}
      wrapperClass={styles.labelWrapper}
    >
      <button
        type="button"
        className={look.className}
        {...{ [look.attribute]: id }}
        data-state={state}
        data-selected={selected || undefined}
        onClick={(event) => {
          // drei `Html`은 라벨을 r3f의 이벤트 대상 안으로 포털한다 — 막지 않으면
          // 이 클릭이 캔버스까지 올라가고, 3D에서는 아무것도 맞지 않았으므로
          // `onPointerMissed`가 뒤이어 선택을 지운다(라벨은 자기 React 루트를
          // 가져서 우리 핸들러가 먼저 돈다). 손잡이인 이상 여기서 끊어야 한다.
          event.stopPropagation();
          onSelect(id);
        }}
      >
        {children}
        {mark && (
          // 표식은 접근 이름에도 들어간다 — 화면을 못 보면 자물쇠도 못 본다
          <span className={styles.labelMark} role="img" aria-label={mark.label}>
            {mark.glyph}
          </span>
        )}
      </button>
    </Html>
  );
}
