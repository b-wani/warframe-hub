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

test("컨텍스트를 얻으면 WebGL이 있는 것으로 본다 — 얻은 컨텍스트는 놓는다", () => {
  const loseContext = vi.fn();
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => ({ getExtension: () => ({ loseContext }) }) as never,
  );

  expect(isWebglAvailable()).toBe(true);
  // 3D 장면이 쓸 컨텍스트를 판별이 물고 있으면 안 된다
  expect(loseContext).toHaveBeenCalledOnce();
});

test("컨텍스트를 놓는 확장이 없어도 답은 같다", () => {
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => ({ getExtension: () => null }) as never,
  );
  expect(isWebglAvailable()).toBe(true);
});

test("getContext가 던져도 던지지 않는다 — 없는 것으로 본다", () => {
  // 컨텍스트 생성이 예외로 실패하는 브라우저·확장 설정이 있다
  HTMLCanvasElement.prototype.getContext = vi.fn(() => {
    throw new Error("blocked");
  });
  expect(isWebglAvailable()).toBe(false);
});
