import Link from "next/link";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1>워프레임 허브</h1>
        <p>
          한국 워프레임 뉴비를 위한 진행 트래커 — 어디까지 했고 다음에 뭘 할지,
          스타차트 하나에서 본다.
        </p>
        <Link className={styles.cta} href="/starchart">
          스타차트 열기
        </Link>
      </main>
    </div>
  );
}
