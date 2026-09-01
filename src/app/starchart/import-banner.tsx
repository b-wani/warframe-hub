"use client";

/**
 * 온보딩 배너 (스펙 §5) — 완료 집합이 비어 있는 사용자에게만 한 번 말을 건다.
 *
 * 진행도가 하나라도 있으면 이미 쓰는 법을 아는 사람이고, 닫았다면 필요 없다고
 * 말한 사람이다. 어느 쪽이든 지도 위에 다시 끼어들지 않는다 — 가져오기는 툴바
 * 버튼으로 언제든 열린다.
 */
import styles from "./page.module.css";

export function ImportOnboardingBanner({
  onStart,
  onDismiss,
}: {
  onStart: () => void;
  onDismiss: () => void;
}) {
  return (
    <aside className={styles.banner}>
      <p className={styles.bannerText}>
        이미 게임을 하고 계신가요? 프로필을 붙여넣으면 클리어한 노드를 한 번에
        표시합니다.
      </p>
      <div className={styles.bannerActions}>
        <button type="button" className={styles.primaryButton} onClick={onStart}>
          진행도 가져오기
        </button>
        <button type="button" className={styles.ghostButton} onClick={onDismiss}>
          닫기
        </button>
      </div>
    </aside>
  );
}
