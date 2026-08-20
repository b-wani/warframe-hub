/**
 * 절대 URL의 기준. OG/트위터 카드와 사이트맵은 절대 URL이어야 하므로
 * 배포 도메인을 알아야 한다. Vercel 프리뷰에서는 `VERCEL_URL`이 주어진다.
 */
export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL !== undefined
    ? `https://${process.env.VERCEL_URL}`
    : "https://warframe-hub.vercel.app")
).replace(/\/$/, "");

export const siteName = "워프레임 허브";

export const siteDescription =
  "한국 워프레임 뉴비를 위한 진행 트래커. 어디까지 했고 다음에 뭘 할지, 메인 퀘스트·교차점 순서와 준비물을 한 곳에서 관리한다.";
