"use client";

/**
 * 스타차트가 어느 뷰로 서는지 정하는 자리 — 3D 성계지도인가, 폴백 뷰인가
 * (스펙 §8).
 *
 * 기준은 WebGL을 렌더할 수 있는가 하나다. 렌더할 수 없으면 폴백 뷰가 자동으로
 * 뜨고, 렌더할 수 있어도 사용자가 목록으로 건너갔다 돌아올 수 있다 — 접근성과
 * 저사양 자구책이다. 모바일이냐 아니냐는 기준이 아니다: 모바일도 기본은 같은
 * 3D다.
 *
 * 완료 집합을 쥐는 것도 여기다. 두 뷰가 각자 진행도를 들면 뷰를 옮기는 순간
 * 진행도가 갈리므로, 완료 집합은 뷰보다 위에 하나만 있고 두 뷰는 같은 집합을
 * 읽고 같은 토글·같은 일괄 체크를 부른다(§4.1). 가져오기·초기화 조작
 * (`ProgressControls`)도 마찬가지 이유로 여기 붙는다 — 3D가 없다고 진행도를 못
 * 다루면 안 된다.
 */
import dynamic from "next/dynamic";
import { useState } from "react";
import { knownNodeIds } from "@/starchart/data";
import { isWebglAvailable } from "@/starchart/webgl";
import { FallbackView } from "./fallback-view";
import { ProgressControls } from "./progress-controls";
import { StarchartLoading } from "./starchart-loading";
import styles from "./page.module.css";
import { useStarchartProgress } from "./use-progress";

/**
 * three·r3f·drei는 3D 뷰에 들어갈 때만 내려온다 — 폴백 뷰로 시작하는 사용자가
 * 쓰지도 못할 3D 번들을 받을 이유가 없다(스펙 §7).
 */
const Scene = dynamic(() => import("./scene"), {
  ssr: false,
  loading: () => <StarchartLoading />,
});

type ViewMode = "3d" | "fallback";

export default function StarchartView() {
  const { completedIds, toggle, merge, reset } = useStarchartProgress();
  // WebGL 판별은 첫 렌더에 한 번뿐이다 — 브라우저에서만 답할 수 있는 질문이지만
  // (이 모듈은 `ssr: false`로만 내려온다) 답이 도중에 바뀌지는 않는다. 효과로
  // 미루면 3D를 못 띄우는 환경이 빈 화면을 한 프레임 보게 된다.
  const [webgl] = useState(isWebglAvailable);
  // 사용자가 고른 뷰. 고르기 전에는 WebGL 여부가 정한다.
  const [chosen, setChosen] = useState<ViewMode | null>(null);

  const mode: ViewMode = chosen ?? (webgl ? "3d" : "fallback");

  const controls = (
    <ProgressControls
      completedIds={completedIds}
      knownNodeIds={knownNodeIds}
      onImport={merge}
      onReset={reset}
    />
  );

  if (mode === "3d") {
    return (
      <>
        <div className={styles.canvas}>
          <Scene
            completedIds={completedIds}
            onToggle={toggle}
            onBulkComplete={merge}
          />
        </div>
        {controls}
        <button
          type="button"
          className={styles.viewToggle}
          data-hud="view-mode"
          onClick={() => setChosen("fallback")}
        >
          목록으로 보기
        </button>
      </>
    );
  }

  return (
    // 폴백 뷰는 글이라 스크롤하는 화면이다 — HUD를 띄우지 않고 조작도 글의
    // 흐름 안에 둔다(겹칠 자리가 없어야 좁은 화면에서도 읽힌다)
    <div className={styles.fallbackPage}>
      <div className={styles.fallbackHead}>
        {controls}
        {webgl ? (
          <button
            type="button"
            className={styles.toolButton}
            onClick={() => setChosen("3d")}
          >
            3D로 보기
          </button>
        ) : (
          <p className={styles.fallbackNotice}>
            이 브라우저에서 3D를 렌더할 수 없어 목록으로 표시합니다. 진행도
            확인과 완료 체크는 여기서 그대로 됩니다.
          </p>
        )}
      </div>
      <FallbackView
        completedIds={completedIds}
        onToggle={toggle}
        onBulkComplete={merge}
      />
    </div>
  );
}
