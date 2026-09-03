"use client";

/**
 * 흐르는 시각을 화면으로 들여오는 자리.
 *
 * 균열은 시간이 지나면 닫힌다 — 닫힌 균열을 지도에 남기지 않으려면, 그리고 남은
 * 시간을 세려면 "지금"이 상태여야 한다(렌더 중에 `Date.now()`를 읽으면 렌더가
 * 순수하지 않다).
 *
 * 첫 값은 첫 렌더에 한 번 읽는다 — 이 모듈은 브라우저에서만 내려오고(3D 뷰는
 * `ssr: false`), 효과로 미루면 첫 프레임의 남은 시간이 엉뚱하게 적힌다.
 */
import { useEffect, useState } from "react";

export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
