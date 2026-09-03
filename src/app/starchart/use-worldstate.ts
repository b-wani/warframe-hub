"use client";

/**
 * 월드스테이트 스냅숏을 화면으로 가져오는 자리 (스펙 §6).
 *
 * 외부 API에 직접 닿지 않는다 — 캐싱·폴백·섹션 단위 독립 실패는 모두 서버
 * 라우트(`/api/worldstate`)의 어댑터가 맡고, 여기서는 그 결과를 받아 두었다가
 * TTL마다 다시 물어본다.
 *
 * 못 받으면 스냅숏이 없는 것으로 둔다 — 지도와 진행도는 월드스테이트와 무관하게
 * 온전해야 하므로, 실패는 실시간 항목이 빠지는 것 말고 어떤 결과도 내지 않는다.
 * 그래서 이 훅은 오류를 밖으로 내보내지 않고 던지지도 않는다.
 *
 * 받은 JSON을 다시 검증하지는 않는다 — 외부 스키마를 아는 유일한 지점은
 * 어댑터이고(CONTEXT "월드스테이트 어댑터"), 이 응답은 그 어댑터가 만든 것이다.
 */
import { useEffect, useState } from "react";
import { WORLDSTATE_TTL_MS } from "@/worldstate/fetch";
import type { WorldState } from "@/worldstate/schema";

/** 위젯이 월드스테이트에 닿는 유일한 경로. */
export const WORLDSTATE_ENDPOINT = "/api/worldstate";

/**
 * 다시 물어보는 간격. 서버의 TTL과 같게 둔다 — 더 자주 물어도 같은 캐시가
 * 돌아오고, 더 드물게 물으면 균열이 닫힌 뒤에도 지도에 남는다.
 */
export const WORLDSTATE_POLL_MS = WORLDSTATE_TTL_MS;

export function useWorldState(pollMs = WORLDSTATE_POLL_MS): WorldState | null {
  const [state, setState] = useState<WorldState | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        const response = await fetch(WORLDSTATE_ENDPOINT, {
          signal: controller.signal,
        });
        if (!response.ok) return;
        setState((await response.json()) as WorldState);
      } catch {
        // 실시간 항목만 잃는다 — 지금 쥔 스냅숏이 있으면 그대로 둔다
      }
    };

    void load();
    const timer = setInterval(load, pollMs);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [pollMs]);

  return state;
}
