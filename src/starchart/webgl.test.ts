import { afterEach, expect, test, vi } from "vitest";
import { isWebglAvailable } from "./webgl.ts";

const getContext = HTMLCanvasElement.prototype.getContext;

afterEach(() => {
  HTMLCanvasElement.prototype.getContext = getContext;
});

test("컨텍스트를 못 얻으면 WebGL이 없는 것으로 본다", () => {
  // jsdom이 그런 환경이다 — getContext("webgl")이 null을 준다
  expect(isWebglAvailable()).toBe(false);
});

test("컨텍스트를 얻으면 WebGL이 있는 것으로 본다", () => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({}) as never);
  expect(isWebglAvailable()).toBe(true);
});

test("getContext가 던져도 던지지 않는다 — 없는 것으로 본다", () => {
  // 컨텍스트 생성이 예외로 실패하는 브라우저·확장 설정이 있다
  HTMLCanvasElement.prototype.getContext = vi.fn(() => {
    throw new Error("blocked");
  });
  expect(isWebglAvailable()).toBe(false);
});
