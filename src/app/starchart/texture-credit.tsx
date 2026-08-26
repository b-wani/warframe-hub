/**
 * 천체 텍스처 출처 표기.
 *
 * CC BY 4.0의 조건이고 수용 기준 §10-7이 페이지에 있으라고 요구한다 — 3D가 뜨든
 * 안 뜨든(폴백 뷰든) 보여야 하므로 Canvas 밖 DOM에 둔다.
 */
import { TEXTURE_CREDIT } from "@/starchart/textures";
import styles from "./page.module.css";

export function TextureCredit() {
  return (
    <p className={styles.credit}>
      행성 텍스처{" "}
      <a href={TEXTURE_CREDIT.url} target="_blank" rel="noreferrer">
        {TEXTURE_CREDIT.title}
      </a>{" "}
      —{" "}
      <a href={TEXTURE_CREDIT.licenseUrl} target="_blank" rel="noreferrer">
        {TEXTURE_CREDIT.license}
      </a>
    </p>
  );
}
