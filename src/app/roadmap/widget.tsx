"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { RoadmapNode } from "@/roadmap/schema";
import { formatRemaining, selectWidgetContext } from "@/worldstate/context";
import type { CycleRegion, WorldState } from "@/worldstate/schema";
import styles from "./page.module.css";

const regionLabels: Record<CycleRegion, string> = {
  earth: "지구",
  cetus: "시터스 / 에이도론 평원",
};

const unknown = "정보 없음";

const tickMs = 30_000;

/**
 * 30초 단위로 흐르는 현재 시각. 서버 렌더링에서는 null이라 남은 시간을
 * 그리지 않는다 (서버/클라이언트 시각 불일치 방지). 스냅숏을 눈금에
 * 맞춰 버려 같은 눈금 안에서는 같은 값이 나오게 한다.
 */
function useClock(): number | null {
  return useSyncExternalStore(
    (onChange) => {
      const timer = setInterval(onChange, tickMs);
      return () => clearInterval(timer);
    },
    () => Math.floor(Date.now() / tickMs) * tickMs,
    () => null,
  );
}

type Live =
  | { status: "loading" }
  | { status: "ready"; state: WorldState }
  | { status: "unavailable" };

/**
 * 트래커의 현재 단계에 종속된 문맥 위젯. 월드스테이트를 못 받아도
 * 로드맵 데이터에서 나오는 준비물 안내는 그대로 남고, 실시간 항목만
 * "정보 없음"으로 폴백한다.
 */
export function ContextWidget({ nextGoals }: { nextGoals: RoadmapNode[] }) {
  const [live, setLive] = useState<Live>({ status: "loading" });
  const now = useClock();
  const { regions, preparations } = selectWidgetContext(nextGoals);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch("/api/worldstate");
        if (!response.ok) throw new Error(String(response.status));
        const state = (await response.json()) as WorldState;
        if (!cancelled) setLive({ status: "ready", state });
      } catch {
        if (!cancelled) setLive({ status: "unavailable" });
      }
    };
    load();
    // 만료된 타이머·주기를 계속 그리지 않도록 주기적으로 다시 받는다
    // (외부 호출은 서버 측 TTL 캐시가 흡수한다)
    const timer = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const state = live.status === "ready" ? live.state : null;
  const remaining = (at: number) =>
    now === null ? null : formatRemaining(at - now);

  const voidTraderText = (): string => {
    if (live.status === "loading" || now === null) return "불러오는 중";
    if (state?.voidTrader == null) return unknown;
    const { character, location, activationAt, expiryAt } = state.voidTrader;
    const untilDeparture = remaining(expiryAt);
    const untilArrival = remaining(activationAt);
    if (untilArrival !== null) {
      return `${character} 도착까지 ${untilArrival} · ${location}`;
    }
    if (untilDeparture !== null) {
      return `${character} 체류 중 — 떠나기까지 ${untilDeparture} · ${location}`;
    }
    return unknown;
  };

  const cycleText = (region: CycleRegion): string => {
    if (live.status === "loading" || now === null) return "불러오는 중";
    const cycle = state?.cycles.find((c) => c.region === region);
    if (cycle === undefined) return unknown;
    const left = remaining(cycle.expiryAt);
    const phase = cycle.isDay ? "낮" : "밤";
    return left === null ? `${phase} (전환 임박)` : `${phase} — 전환까지 ${left}`;
  };

  return (
    <section className={styles.widget} aria-label="현재 단계 문맥 정보">
      <h2>지금 이 단계에 필요한 정보</h2>

      <dl className={styles.widgetList}>
        <dt>보이드 상인</dt>
        <dd>{voidTraderText()}</dd>

        {regions.map((region) => (
          <div key={region}>
            <dt>{regionLabels[region]} 낮밤 주기</dt>
            <dd>{cycleText(region)}</dd>
          </div>
        ))}
      </dl>

      {preparations.length > 0 ? (
        <section aria-label="이번 단계 재료 획득처">
          <h3>이번 단계 재료 획득처</h3>
          <ul>
            {preparations.map((prep) => (
              <li key={`${prep.goalTitle}/${prep.name}`}>
                {prep.name} ×{prep.quantity} — {prep.source} ({prep.goalTitle})
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p>이번 단계에 미리 모아둘 재료는 없다.</p>
      )}

      {state?.stale === true && (
        <p className={styles.meta}>
          외부 월드스테이트에 닿지 못해 마지막으로 받은 정보를 보여준다.
        </p>
      )}
    </section>
  );
}
