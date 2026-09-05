/**
 * 사용자가 OS/브라우저에서 모션 감소를 켰는가 — 카메라 연속 비행을 건너뛰고
 * 목적지에 바로 서는 기준(접근성). 스펙 §2.1의 "연속 비행"은 기본값이지,
 * 움직임이 힘든 사용자에게 강요하는 것이 아니다.
 *
 * 절대 던지지 않고, 판별할 수 없으면 "줄이지 않는다"로 답한다 — 어느 쪽으로
 * 틀려도 카메라는 목적지에 도착해야 한다. 브라우저에서만 부를 수 있다.
 */
export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  } catch {
    return false;
  }
}
