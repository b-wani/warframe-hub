/**
 * 3D 스타차트를 렌더할 수 있는 환경인가 — 폴백 뷰가 자동으로 뜨는 기준(스펙 §8).
 *
 * 실제 컨텍스트를 한 번 얻어 본다. 사용자 에이전트 문자열이나 기능 플래그로는
 * 알 수 없다 — WebGL을 끈 브라우저 설정·소프트웨어 렌더 차단·확장까지 이유가
 * 여러 갈래고, 물어보는 방법은 만들어 보는 것뿐이다.
 *
 * 절대 던지지 않는다: 컨텍스트 생성 자체가 예외로 실패하는 환경이 있고, 그것도
 * "WebGL이 없다"는 답이다. 브라우저에서만 부를 수 있다(document가 필요하다).
 */
export function isWebglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    // three는 webgl2를 먼저 쓰고 없으면 webgl로 내려간다 — 같은 순서로 묻는다
    const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!context) return false;
    // 물어보려고 만든 컨텍스트는 물어본 자리에서 놓는다 — 브라우저가 동시에
    // 들고 있을 수 있는 컨텍스트 수는 적고, 곧 3D 장면이 하나를 가져간다
    context.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}
