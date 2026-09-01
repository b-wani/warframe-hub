"use client";

/**
 * 클라이언트 전용 스타차트를 붙이는 경계.
 *
 * `ssr: false`는 클라이언트 컴포넌트 안에서만 쓸 수 있으므로(Next.js 규약) 이
 * 얇은 래퍼가 존재한다 — 덕분에 진행도(로컬스토리지)도 WebGL 판별도 서버 렌더를
 * 거치지 않고, three·r3f·drei는 3D 뷰에 들어갈 때만 내려온다(스펙 §7).
 *
 * 어느 뷰로 설지는 여기서 정하지 않는다 — 3D인지 폴백 뷰인지는 브라우저에서만
 * 알 수 있고, 그 판단은 `starchart-view`의 몫이다(스펙 §8).
 */
import dynamic from "next/dynamic";
import styles from "./page.module.css";

const StarchartView = dynamic(() => import("./starchart-view"), {
  ssr: false,
  loading: () => <p className={styles.loading}>성계지도를 불러오는 중…</p>,
});

export function StarchartCanvas() {
  return <StarchartView />;
}
