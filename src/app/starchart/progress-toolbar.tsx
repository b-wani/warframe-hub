"use client";

/**
 * 진행도 조작의 상시 입구 (스펙 §5).
 *
 * 가져오기는 온보딩 배너가 닫힌 뒤에도 언제든 다시 할 수 있어야 하므로 툴바
 * 버튼으로 상시 노출한다. 그 옆의 설정 메뉴에 있는 전체 초기화가 유일한
 * 탈출구다 — 가져오기에는 전용 되돌리기가 없다(합집합이라 필요가 없다).
 *
 * 초기화는 지우는 조작이라 숫자 확인을 거친다. 확인 문구가 "완료 N개가
 * 삭제됩니다"인 이유는 구간 일괄 체크와 같다 — 몇 개가 바뀌는지 읽은 것과 실제로
 * 바뀌는 것이 어긋나면 안 된다.
 */
import { useState } from "react";
import styles from "./page.module.css";

export function ProgressToolbar({
  completedCount,
  onImport,
  onReset,
}: {
  completedCount: number;
  onImport: () => void;
  /** 확인을 통과했을 때만 불린다. */
  onReset: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const reset = () => {
    setMenuOpen(false);
    if (completedCount === 0) return;
    if (!window.confirm(`완료 ${completedCount}개가 삭제됩니다. 계속할까요?`)) {
      return;
    }
    onReset();
  };

  return (
    <div className={styles.toolbar}>
      <button type="button" className={styles.toolButton} onClick={onImport}>
        진행도 가져오기
      </button>

      <div className={styles.toolMenu}>
        <button
          type="button"
          className={styles.toolButton}
          aria-label="진행도 설정"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          ⚙
        </button>
        {menuOpen && (
          <div className={styles.toolMenuBody}>
            <button
              type="button"
              className={styles.dangerButton}
              onClick={reset}
              disabled={completedCount === 0}
            >
              진행도 전체 초기화
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
