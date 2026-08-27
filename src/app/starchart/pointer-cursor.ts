"use client";

/**
 * 3D에서 고를 수 있는 것 위에 커서를 손가락으로 바꾼다.
 *
 * 캔버스는 DOM 요소 하나라 CSS `:hover`로는 안에 무엇이 있는지 구별할 수 없다 —
 * r3f의 포인터 이벤트로 직접 바꾸는 수밖에 없다. 호버는 어디까지나 데스크톱
 * 보조 수단이고, 호버에만 있는 정보는 없어야 한다(스펙 §8 적응 규칙 2).
 */
import { useEffect } from "react";

export function usePointerCursor() {
  // 언마운트가 포인터 이탈보다 먼저 오면(초점 이동으로 노드가 사라질 때)
  // 손가락 커서가 남는다 — 사라질 때 되돌린다.
  useEffect(() => () => setCursor(""), []);

  return {
    onPointerOver: () => setCursor("pointer"),
    onPointerOut: () => setCursor(""),
  };
}

function setCursor(cursor: string) {
  document.body.style.cursor = cursor;
}
