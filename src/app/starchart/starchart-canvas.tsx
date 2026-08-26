"use client";

/**
 * 3D 장면을 붙이는 경계.
 *
 * `ssr: false`는 클라이언트 컴포넌트 안에서만 쓸 수 있으므로(Next.js 규약) 이
 * 얇은 래퍼가 존재한다 — 덕분에 three·r3f·drei는 서버 렌더와 서버 번들에
 * 들어가지 않고, 스타차트 라우트를 열 때만 내려온다(스펙 §7).
 *
 * WebGL이 없는 환경의 폴백 뷰는 별건이다(#45).
 */
import dynamic from "next/dynamic";
import styles from "./page.module.css";

const Scene = dynamic(() => import("./scene"), {
  ssr: false,
  loading: () => <p className={styles.loading}>성계지도를 불러오는 중…</p>,
});

export function StarchartCanvas() {
  return (
    <div className={styles.canvas}>
      <Scene />
    </div>
  );
}
