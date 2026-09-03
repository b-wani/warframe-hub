"use client";

/**
 * 활성 균열 목록 탭 — 지금 열린 균열을 한눈에 보고, 골라서 그 노드로 날아가는
 * 자리(스펙 §6).
 *
 * 지도의 심볼은 "저 노드에 균열이 있다"만 말한다. 어느 행성에 무엇이 열렸는지는
 * 성계 전체를 돌아보지 않고도 읽혀야 하므로 목록이 따로 있고, 항목을 고르면
 * 연속 비행으로 그 노드까지 데려다준다(전환은 언제나 카메라 하나다 — §2.1).
 *
 * 기본은 접힌 상태다. 지도가 주인공인 화면에서 HUD가 자리를 넓게 차지하면
 * 안 되고, 접힌 버튼도 활성 균열이 몇 개인지는 이미 말해 준다.
 *
 * 월드스테이트를 못 받은 것과 균열이 0건인 것은 다른 사실이라 다르게 말한다 —
 * 어느 쪽이든 지도와 진행도는 그대로다.
 */
import { useState } from "react";
import { remainingText, type FissureMarker } from "@/starchart/fissures";
import styles from "./page.module.css";

/** 균열 정보를 어떤 상태로 쥐고 있는가. */
export type FissureStatus =
  /** 방금 받은 값 */
  | "ok"
  /** 마지막 성공 스냅숏으로 대체된 값 */
  | "stale"
  /** 월드스테이트(또는 균열 섹션)를 못 받았다 */
  | "unavailable";

export function FissureList({
  markers,
  status,
  now,
  onGo,
}: {
  /** 로테이션 순서로 이미 정렬돼 있다 — 여기서 순서를 새로 정하지 않는다. */
  markers: readonly FissureMarker[];
  status: FissureStatus;
  /** 남은 시간을 세는 기준 시각(epoch ms). */
  now: number;
  /** 항목을 고른 것 = 그 노드로 날아가 달라는 뜻이다. */
  onGo: (marker: FissureMarker) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={styles.fissureHud}>
      <button
        type="button"
        className={styles.toolButton}
        aria-expanded={open}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
      >
        보이드 균열{markers.length > 0 && ` ${markers.length}`}
      </button>

      {open && (
        <div className={styles.fissurePanel}>
          {status === "unavailable" ? (
            <p className={styles.fissureNotice}>
              월드스테이트를 받지 못해 균열을 표시할 수 없습니다. 지도와 진행도는
              그대로입니다.
            </p>
          ) : (
            <>
              {status === "stale" && (
                <p className={styles.fissureNotice}>
                  마지막으로 받은 정보입니다 — 이미 닫힌 균열이 섞여 있을 수
                  있습니다.
                </p>
              )}
              {markers.length === 0 ? (
                <p className={styles.fissureNotice}>
                  지금 활성 균열이 없습니다.
                </p>
              ) : (
                <ul className={styles.fissureItems}>
                  {markers.map((marker) => (
                    <li key={`${marker.nodeId}:${marker.tier}:${marker.hard}`}>
                      <button
                        type="button"
                        className={styles.fissureItem}
                        data-fissure-node={marker.nodeId}
                        data-fissure-tier={marker.tier}
                        onClick={() => onGo(marker)}
                      >
                        <span className={styles.fissureTier}>
                          {marker.tierName}
                        </span>
                        <span className={styles.fissureNode}>
                          {marker.nodeName}
                          <span className={styles.fissureBody}>
                            {marker.bodyName}
                            {/* 같은 노드·같은 등급으로 나란히 열리므로 구별한다 */}
                            {marker.hard && " · 스틸패스"}
                          </span>
                        </span>
                        <span className={styles.fissureRemaining}>
                          {remainingText(marker.expiryAt - now)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
