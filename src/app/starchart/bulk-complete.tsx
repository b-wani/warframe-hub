"use client";

/**
 * 구간 일괄 체크의 조작 하나 — "여기까지 완료"와 "행성 전체 완료"(스펙 §4.3).
 *
 * 두 조작은 대상만 다른 같은 규칙이라 컴포넌트도 하나다. 화면마다 다른 확인
 * 절차를 두면 그게 곧 규칙이 갈리는 자리가 된다.
 *
 * 확인 단계가 여기 있는 이유는 실수 방지 하나다. 그래서 지키는 것도 하나다 —
 * **읽은 개수와 반영되는 집합이 어긋나지 않는다**:
 * - 세는 것도 반영하는 것도 `bulkCompletion`이 돌려준 같은 집합이다.
 * - 확인을 띄운 뒤 완료 집합이 바뀌면 그 확인은 무효가 된다. 다른 곳에서 체크가
 *   일어나면 화면에 남은 개수가 이미 옛말이므로, 조용히 반영하지 않고 다시
 *   확인을 받는다.
 *
 * 자신과 선행이 모두 완료된 대상에는 아무것도 그리지 않는다 — 눌러도 아무 일도
 * 없는 버튼을 두지 않는다. `bulkCompletion`이 비어 있다는 것이 곧 그 조건이다.
 * 확인이 떠 있는 동안 그렇게 되면(다른 곳에서 그 구간을 다 채웠다) 무효 알림
 * 없이 그냥 사라진다 — 다시 확인받을 것이 남아 있지 않고, 화면의 3상태가 이미
 * 왜 사라졌는지를 말한다.
 *
 * 완료 집합은 이 컴포넌트의 것이 아니다 — 받아서 세고, 바꾸는 것은 위로 알린다.
 */
import { useMemo, useState } from "react";
import { starchartProgressGraph } from "@/starchart/data";
import {
  bulkCompletion,
  sameCompletion,
  type BulkTarget,
} from "@/starchart/progress";
import styles from "./page.module.css";

/** 두 형태의 문구. 같은 조작이지만 무엇이 채워지는지는 다르게 말해야 한다. */
const COPY = {
  through: {
    action: "여기까지 완료",
    detail: (count: number) =>
      `이 노드까지 선행 노드를 포함해 ${count}개가 새로 완료됩니다.`,
  },
  group: {
    action: "행성 전체 완료",
    detail: (count: number) =>
      `이 행성과 선행 노드를 포함해 ${count}개가 새로 완료됩니다.`,
  },
  /**
   * 프록시마 고리도 그룹 하나라 규칙은 같다 — 부르는 말만 다르다. 행성 뷰의 ⚓
   * 토글로 들어온 자리에서 "행성 전체 완료"라고 적으면 무엇이 채워지는지가
   * 어긋난다(채워지는 것은 프록시마 노드다).
   */
  proximaGroup: {
    action: "프록시마 전체 완료",
    detail: (count: number) =>
      `이 프록시마와 선행 노드를 포함해 ${count}개가 새로 완료됩니다.`,
  },
} as const;

export function BulkComplete({
  target,
  proxima,
  completedIds,
  onComplete,
  className,
}: {
  target: BulkTarget;
  /** 대상이 프록시마 고리인가 — 조작은 같고 문구만 갈린다. */
  proxima?: boolean;
  completedIds: ReadonlySet<string>;
  /** 확정 — 새로 완료되는 id만 넘긴다. 합집합이라 완료가 지워질 길이 없다. */
  onComplete: (addedIds: ReadonlySet<string>) => void;
  /** 자리마다 다른 옷(HUD·목록). 조작 자체는 어디서나 같다. */
  className?: string;
}) {
  // 대상은 객체가 아니라 그 두 값으로 본다 — 부모가 매 렌더 새로 만드는 객체다
  const { kind, id } = target;
  const targetKey = `${kind}:${id}`;
  // 목록 전체(그룹 29 + 노드 352)를 다시 세는 데 2ms 남짓이라 진행이 바뀔 때마다
  // 통째로 다시 센다 — 파생값을 따로 들고 있다 어긋나는 편보다 낫다
  const added = useMemo(
    () => bulkCompletion(starchartProgressGraph, completedIds, { kind, id }),
    [completedIds, kind, id],
  );

  /**
   * 확인을 띄운 시점의 근거 — 대상과 그때의 완료 집합 사본. 둘 중 하나만 달라도
   * 화면에 뜬 개수는 옛말이다. 사본을 뜨는 것은 호출자가 같은 집합을 제자리에서
   * 고쳐도 비교가 속지 않게 하려는 것이다.
   */
  const [confirming, setConfirming] = useState<{
    target: string;
    basis: ReadonlySet<string>;
  } | null>(null);
  const [invalidated, setInvalidated] = useState(false);

  // 렌더 중에 정리한다 — 옛 개수가 한 프레임이라도 화면에 남으면 그 사이에
  // 눌린 확정은 읽은 것과 다른 집합을 반영한다
  if (confirming !== null && confirming.target !== targetKey) {
    setConfirming(null);
    setInvalidated(false);
  } else if (
    confirming !== null &&
    !sameCompletion(confirming.basis, completedIds)
  ) {
    setConfirming(null);
    setInvalidated(true);
  }

  if (added.size === 0) return null;

  const copy = kind === "group" && proxima ? COPY.proximaGroup : COPY[kind];
  // 렌더 중 setState는 이 렌더를 한 번 더 돌린다 — 버려질 그 한 판이 남은 옛
  // 확인을 그리지 않도록, 근거가 아직 맞는지 여기서 한 번 더 본다
  const open = confirming !== null && confirming.target === targetKey;

  return (
    <div className={className ? `${styles.bulk} ${className}` : styles.bulk}>
      {invalidated && !open && (
        <p className={styles.bulkStale} role="status">
          진행도가 바뀌어 확인을 취소했습니다. 개수를 다시 확인해 주세요.
        </p>
      )}

      {open ? (
        <div className={styles.bulkConfirm} role="group" aria-label={copy.action}>
          {/* 확인 단계가 나타났다는 것과 그 개수를 읽어 주는 자리 — 이 문장을
              듣지 못하면 확인 단계가 없는 것과 같다 */}
          <p className={styles.bulkDetail} role="status">
            {copy.detail(added.size)} 완료를 해제하지는 않습니다.
          </p>
          <div className={styles.bulkActions}>
            {/*
              방금 누른 버튼이 사라진 자리라 초점이 body로 떨어진다 — 확인
              단계로 옮겨 온다. 실수 방지가 이 단계의 이유이므로 초점은
              확정이 아니라 취소에 둔다.
            */}
            <button
              type="button"
              className={styles.ghostButton}
              autoFocus
              onClick={() => setConfirming(null)}
            >
              취소
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => {
                onComplete(added);
                setConfirming(null);
              }}
            >
              {added.size}개 완료
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={styles.bulkButton}
          onClick={() => {
            setConfirming({ target: targetKey, basis: new Set(completedIds) });
            setInvalidated(false);
          }}
        >
          {copy.action}
        </button>
      )}
    </div>
  );
}
