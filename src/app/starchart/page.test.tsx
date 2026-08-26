import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { metadata } from "./page";
import { TextureCredit } from "./texture-credit";

// 3D 장면 자체는 WebGL이 필요해 jsdom에서 확인할 수 없다 — 캔버스가 실제로 뜨는지는
// e2e(e2e/starchart.spec.ts)가 본다. 여기서는 3D 없이도 성립해야 하는 것만 본다.

test("텍스처 출처 표기가 원문과 라이선스를 모두 가리킨다", () => {
  render(<TextureCredit />);
  expect(
    screen.getByRole("link", { name: /Solar System Scope/ }),
  ).toHaveProperty("href", "https://www.solarsystemscope.com/textures/");
  expect(screen.getByRole("link", { name: "CC BY 4.0" })).toHaveProperty(
    "href",
    "https://creativecommons.org/licenses/by/4.0/",
  );
});

test("스타차트 라우트에 제목·설명 메타데이터가 있다", () => {
  expect(metadata.title).toBe("스타차트");
  expect(metadata.description).toBeTruthy();
  expect(metadata.openGraph).toMatchObject({ url: "/starchart" });
});
