"use client";

/**
 * 고른 노드의 상세 — 표시명·미션 유형·팩션·레벨 범위와 개별 완료 토글
 * (스펙 §2.2·§4.3).
 *
 * 3D가 아니라 DOM이다. 정보 노출은 선택(탭/클릭) 기준이고 호버에만 기대는 정보가
 * 있어서는 안 되므로(스펙 §2.2·§8-2), 노드를 고르면 이 패널이 이미 열려 있다 —
 * 툴팁이 아니다. DOM이라 키보드로 토글에 닿고, 상태를 색이 아니라 글로도 읽는다.
 *
 * 노드 상태는 파생값이라 받기만 한다 — 완료 여부도 따로 받지 않는다. 완료 집합에
 * 있다는 것과 클리어라는 것은 같은 사실이고(§4.2), 둘을 따로 넘기면 어긋날 자리가
 * 생긴다.
 */
import type { NodeDetail } from "@/starchart/node-detail";
import type { NodeState } from "@/starchart/progress";
import styles from "./page.module.css";

/** 3상태의 사용자 노출 표기 — 색만으로 상태를 알리지 않기 위한 것이기도 하다. */
const STATE_NAME: Record<NodeState, string> = {
  locked: "잠김",
  uncleared: "미클리어",
  cleared: "클리어",
};

export function NodeDetailPanel({
  detail,
  state,
  onToggle,
}: {
  detail: NodeDetail;
  state: NodeState;
  /** 개별 체크. 잠긴 노드에도 열려 있다 — 진행도는 사용자가 아는 사실이다. */
  onToggle: (id: string) => void;
}) {
  return (
    <section
      className={styles.detail}
      data-selected-node={detail.id}
      data-node-state={state}
    >
      <header className={styles.detailHead}>
        <h2 className={styles.detailName}>{detail.name}</h2>
        {detail.junction && <span className={styles.junctionTag}>교차점</span>}
        <span className={styles.stateTag} data-state={state}>
          {STATE_NAME[state]}
        </span>
      </header>

      <dl className={styles.detailFacts}>
        <Fact label="미션" value={detail.mission} />
        <Fact label="팩션" value={detail.faction} />
        <Fact label="적 레벨" value={detail.levelRange} />
      </dl>

      <label className={styles.completeToggle}>
        <input
          type="checkbox"
          checked={state === "cleared"}
          onChange={() => onToggle(detail.id)}
        />
        완료
      </label>
    </section>
  );
}

/** 값이 없는 줄은 그리지 않는다 — 빈칸을 지어내지 않는다. */
function Fact({ label, value }: { label: string; value?: string }) {
  if (value === undefined) return null;
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}
