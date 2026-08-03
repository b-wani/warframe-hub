import Link from "next/link";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1>워프레임 허브</h1>
        <p>한국 워프레임 뉴비를 위한 진행 트래커 — 준비 중입니다.</p>
        <Link href="/roadmap">로드맵 보기</Link>
      </main>
    </div>
  );
}
