"use client";

/**
 * 고른 노드의 상세 — 표시명·미션 유형·팩션·레벨 범위와 완료 조작
 * (스펙 §2.2·§4.3).
 *
 * 3D가 아니라 DOM이다. 정보 노출은 선택(탭/클릭) 기준이고 호버에만 기대는 정보가
 * 있어서는 안 되므로(스펙 §2.2·§8-2), 노드를 고르면 이 패널이 이미 열려 있다 —
 * 툴팁이 아니다. DOM이라 키보드로 토글에 닿고, 상태를 색이 아니라 글로도 읽는다.
 *
 * 노드 상태는 파생값이라 받기만 한다 — 완료 여부도 따로 받지 않는다. 완료 집합에
 * 있다는 것과 클리어라는 것은 같은 사실이고(§4.2), 둘을 따로 넘기면 어긋날 자리가
 * 생긴다. 완료 집합 자체는 파생값이 아니라 원본이라 받는다 — 구간 일괄 체크가
 * 몇 개를 채우는지는 이 노드의 상태가 아니라 집합 전체가 답하는 질문이다.
 */
import type { NodeDetail } from "@/starchart/node-detail";
import { NODE_STATE_NAME, type NodeState } from "@/starchart/progress";
import { BulkComplete } from "./bulk-complete";
import styles from "./page.module.css";

export function NodeDetailPanel({
  detail,
  state,
  completedIds,
  onToggle,
  onBulkComplete,
}: {
  detail: NodeDetail;
  state: NodeState;
  /** 완료 집합 — 구간 일괄 체크가 몇 개를 채우는지 세는 근거다(§4.3). */
  completedIds: ReadonlySet<string>;
  /** 개별 체크. 잠긴 노드에도 열려 있다 — 진행도는 사용자가 아는 사실이다. */
  onToggle: (id: string) => void;
  /** 구간 일괄 체크 확정 — 새로 완료되는 id만 올라간다. */
  onBulkComplete: (addedIds: ReadonlySet<string>) => void;
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
          {NODE_STATE_NAME[state]}
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

      {/* 여기까지 완료 — 자신과 선행이 이미 다 찼으면 아무것도 그리지 않는다 */}
      <BulkComplete
        target={{ kind: "through", id: detail.id }}
        completedIds={completedIds}
        onComplete={onBulkComplete}
      />
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
