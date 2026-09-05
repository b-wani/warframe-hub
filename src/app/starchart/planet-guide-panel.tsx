"use client";

/**
 * 행성 가이드 패널 — 행성 뷰가 함께 노출하는 초보자 안내와 그 안의 비노드 목표
 * 체크(스펙 §2.1·§4.3, CONTEXT "행성 가이드").
 *
 * 3D 뷰의 HUD에도 폴백 뷰의 아코디언에도 같은 컴포넌트가 선다 — 두 화면이 다른
 * 가이드를 말할 자리를 만들지 않으려는 것이고, 3D가 없다고 비노드 목표에 닿지
 * 못하면 그 목표는 폴백 뷰만 쓰는 사용자에게 영영 없는 것이 된다(스펙 §8).
 *
 * 비노드 목표는 노드가 아니므로 3상태가 없다 — 잠김/미클리어를 파생할 그래프가
 * 없고, 있는 것은 완료했는가 하나뿐이다(CONTEXT "비노드 목표"). 그래서 노드
 * 상세와 달리 상태 태그도 구간 일괄 체크도 없다. 기록되는 곳은 같다: 완료 집합
 * 하나에 슬러그로 들어간다(§4.1).
 *
 * 본문 저작은 스펙 이후 단계다(§9). 아직 없는 본문을 지어내지 않고 준비 중임을
 * 그대로 적는다 — 빈칸을 지어내지 않는 것은 노드 상세와 같은 규칙이다.
 */
import type { PlanetGuide } from "@/starchart/planet-guide";
import styles from "./page.module.css";

/** 종류를 글로도 구별한다 — 퀘스트와 준비 목표는 할 일의 성격이 다르다. */
const KIND_NAME = {
  quest: "퀘스트",
  preparation: "준비",
} as const;

export function PlanetGuidePanel({
  guide,
  completedIds,
  onToggle,
  className,
}: {
  guide: PlanetGuide;
  /** 완료 집합 — 비노드 목표도 성계 노드와 같은 집합에 산다(§4.1). */
  completedIds: ReadonlySet<string>;
  /** 비노드 목표 체크(§4.3) — 노드 개별 체크와 같은 조작·같은 집합이다. */
  onToggle: (id: string) => void;
  /** 자리마다 다른 옷(HUD·폴백 목록). 내용과 조작은 어디서나 같다. */
  className?: string;
}) {
  const done = guide.objectives.filter((objective) =>
    completedIds.has(objective.slug),
  ).length;

  return (
    <section
      className={
        className ? `${styles.guide} ${className}` : styles.guide
      }
      data-planet-guide={guide.body}
      aria-label="행성 가이드"
    >
      <header className={styles.guideHead}>
        <h2 className={styles.guideTitle}>행성 가이드</h2>
        {guide.objectives.length > 0 && (
          <span className={styles.guideCount}>
            {done}/{guide.objectives.length}
          </span>
        )}
      </header>

      {guide.summary ? (
        <p className={styles.guideSummary}>{guide.summary}</p>
      ) : (
        <p className={styles.guidePending}>
          이 행성의 안내 문안은 아직 준비 중입니다.
        </p>
      )}

      {guide.objectives.length > 0 && (
        <>
          <h3 className={styles.guideObjectivesTitle}>비노드 목표</h3>
          <ul className={styles.guideObjectives}>
            {guide.objectives.map((objective) => {
              const complete = completedIds.has(objective.slug);
              return (
                <li
                  key={objective.slug}
                  className={styles.guideObjective}
                  data-objective-slug={objective.slug}
                  data-complete={complete || undefined}
                >
                  <label className={styles.guideObjectiveLabel}>
                    <input
                      type="checkbox"
                      checked={complete}
                      onChange={() => onToggle(objective.slug)}
                    />
                    <span className={styles.guideObjectiveTitle}>
                      {objective.title}
                    </span>
                  </label>
                  <span className={styles.guideKind}>
                    {KIND_NAME[objective.kind]}
                  </span>
                  {/* 부연은 있는 것만 — 없는 줄은 화면에도 없다 */}
                  {objective.note && (
                    <p className={styles.guideNote}>{objective.note}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      <p className={styles.guidePatch}>기준 패치 {guide.basedOnPatch}</p>
    </section>
  );
}
