"use client";

/**
 * 고른 노드의 상세 — 표시명·미션 유형·팩션·레벨 범위와 완료 조작
 * (스펙 §2.2·§4.3).
 *
 * 3D가 아니라 DOM이다. 정보 노출은 선택(탭/클릭) 기준이고 호버에만 기대는 정보가
 * 있어서는 안 되므로(스펙 §2.2·§8-2), 노드를 고르면 이 패널이 이미 열려 있다 —
 * 툴팁이 아니다. DOM이라 키보드로 토글에 닿고, 상태를 색이 아니라 글로도 읽는다.
 *
 * 주요 노드(교차점·보스)에는 큐레이션 오버레이가 함께 얹힌다(스펙 §3.3). 얹는
 * 것이지 대신하는 것이 아니다 — 오버레이가 있어도 구조화 데이터는 그대로 서고,
 * 없는 노드는 구조화 데이터만 선다. 오버레이는 상세 모델(`nodeDetail`) 안이
 * 아니라 따로 받는다: 하나는 자동 생성 데이터셋에서, 하나는 수동 저작 파일에서
 * 오며 검증도 로더도 다르다 — 둘을 한 모델로 뭉치면 어느 쪽이 없어서 빈 것인지
 * 화면이 구별할 수 없다.
 *
 * 노드 상태는 파생값이라 받기만 한다 — 완료 여부도 따로 받지 않는다. 완료 집합에
 * 있다는 것과 클리어라는 것은 같은 사실이고(§4.2), 둘을 따로 넘기면 어긋날 자리가
 * 생긴다. 완료 집합 자체는 파생값이 아니라 원본이라 받는다 — 구간 일괄 체크가
 * 몇 개를 채우는지는 이 노드의 상태가 아니라 집합 전체가 답하는 질문이다.
 */
import type { NodeDetail } from "@/starchart/node-detail";
import type { NodeOverlay } from "@/starchart/node-overlay";
import { NODE_STATE_NAME, type NodeState } from "@/starchart/progress";
import { BulkComplete } from "./bulk-complete";
import styles from "./page.module.css";

export function NodeDetailPanel({
  detail,
  overlay,
  state,
  completedIds,
  onToggle,
  onBulkComplete,
}: {
  detail: NodeDetail;
  /** 주요 노드의 큐레이션 오버레이(§3.3). 없는 노드가 대부분이다. */
  overlay?: NodeOverlay;
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

      {overlay && <CurationOverlay overlay={overlay} />}

      {/* 여기까지 완료 — 자신과 선행이 이미 다 찼으면 아무것도 그리지 않는다 */}
      <BulkComplete
        target={{ kind: "through", id: detail.id }}
        completedIds={completedIds}
        onComplete={onBulkComplete}
      />
    </section>
  );
}

/**
 * 큐레이션 오버레이 본문. 스포일러로 저작된 것은 접어 둔다 — 진행도 화면에서
 * 아직 안 본 이야기를 눈에 밀어 넣지 않으려는 것이고, 펼치는 것은 사용자의
 * 선택이다.
 */
function CurationOverlay({ overlay }: { overlay: NodeOverlay }) {
  const body = (
    <>
      <p className={styles.overlaySummary}>{overlay.summary}</p>

      {/* 목록은 있는 것만 — 빈 제목만 남은 칸을 세우지 않는다 */}
      {overlay.preparations.length > 0 && (
        <>
          <h3 className={styles.overlayListTitle}>준비물</h3>
          <ul className={styles.overlayList}>
            {overlay.preparations.map((item) => (
              // 준비물은 이름·개수·출처 세 조각이다 — 한 문자열로 뭉치면 화면도
              // 테스트도 그중 하나만 짚을 수 없다
              <li key={item.name}>
                <span className={styles.overlayPrepName}>{item.name}</span>
                <span className={styles.overlayPrepQuantity}>
                  ×{item.quantity}
                </span>
                <span className={styles.overlayPrepSource}>{item.source}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <OverlayList label="주의" items={overlay.cautions} />
      <OverlayList label="대표 드랍" items={overlay.drops ?? []} />
    </>
  );

  return (
    <section
      className={styles.overlay}
      data-node-overlay={overlay.spoiler ? "spoiler" : "open"}
      aria-label="큐레이션 오버레이"
    >
      {overlay.spoiler ? (
        <details className={styles.overlaySpoiler}>
          <summary>스포일러 — 눌러서 펼치기</summary>
          {body}
        </details>
      ) : (
        body
      )}
      {/* 기준 패치는 접어 두지 않는다 — 콘텐츠가 언제 것인지는 스포일러가 아니다 */}
      <p className={styles.overlayPatch}>기준 패치 {overlay.basedOnPatch}</p>
    </section>
  );
}

function OverlayList({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <>
      <h3 className={styles.overlayListTitle}>{label}</h3>
      <ul className={styles.overlayList}>
        {items.map((item, index) => (
          // 같은 문장이 두 번 실릴 수 있다 — 문장 자체는 키가 되지 못한다
          <li key={`${label}-${index}`}>{item}</li>
        ))}
      </ul>
    </>
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
