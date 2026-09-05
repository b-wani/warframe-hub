import { afterEach, expect, test, vi } from "vitest";
import { prefersReducedMotion } from "./motion.ts";

const original = window.matchMedia;

afterEach(() => {
  window.matchMedia = original;
});

test("matchMedia가 없는 환경에서는 모션을 줄이지 않는다", () => {
  // jsdom이 그런 환경이다 — matchMedia 자체가 없다
  expect(prefersReducedMotion()).toBe(false);
});

test("사용자가 모션 감소를 켰으면 true", () => {
  window.matchMedia = vi.fn(
    (query: string) => ({ matches: query.includes("reduce") }) as MediaQueryList,
  );
  expect(prefersReducedMotion()).toBe(true);
  expect(window.matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
});

test("설정이 없으면 false", () => {
  window.matchMedia = vi.fn(() => ({ matches: false }) as MediaQueryList);
  expect(prefersReducedMotion()).toBe(false);
});

test("matchMedia가 던져도 답은 false다 — 카메라가 멈추면 안 된다", () => {
  window.matchMedia = vi.fn(() => {
    throw new Error("boom");
  });
  expect(prefersReducedMotion()).toBe(false);
});
