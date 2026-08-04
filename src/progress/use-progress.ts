"use client";

import { useSyncExternalStore } from "react";
import { PROGRESS_STORAGE_KEY, loadProgress, saveProgress } from "./storage";

// 서버 렌더링에서는 항상 "진행 없음"으로 그리고, 하이드레이션 후
// localStorage 스냅숏으로 갈아탄다 (하이드레이션 불일치 방지).
const emptyProgress: ReadonlySet<string> = new Set();

const listeners = new Set<() => void>();
let cache: { raw: string | null; ids: ReadonlySet<string> } | null = null;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // 다른 탭에서의 변경도 반영한다
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function getSnapshot(): ReadonlySet<string> {
  const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
  if (cache === null || cache.raw !== raw) {
    cache = { raw, ids: loadProgress(localStorage) };
  }
  return cache.ids;
}

function setProgress(next: ReadonlySet<string>): void {
  saveProgress(localStorage, next);
  for (const listener of listeners) {
    listener();
  }
}

/** localStorage에 저장되는 완료 노드 집합과 그 갱신 함수. */
export function useProgress(): [
  ReadonlySet<string>,
  (next: ReadonlySet<string>) => void,
] {
  const completedIds = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => emptyProgress,
  );
  return [completedIds, setProgress];
}
