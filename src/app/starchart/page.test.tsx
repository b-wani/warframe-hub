import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { starchartPatchBaseline } from "@/starchart/data";
import { metadata } from "./page";
import { PatchBaseline } from "./patch-baseline";
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

/*
 * 콘텐츠 기준 패치 — 큐레이션 오버레이의 노드별 기준 패치를 모은 페이지 표기다
 * (스펙 §3.3). 모으는 규칙은 단위 테스트(src/starchart/node-overlay.test.ts)가
 * 본다. 여기서는 화면이 그것을 어떻게 세우는지만 본다.
 */
test("콘텐츠 기준 패치를 페이지에 적는다", () => {
  render(<PatchBaseline patches={["Update 43"]} />);
  expect(screen.getByText(/콘텐츠 기준 패치 Update 43/)).toBeTruthy();
});

test("여러 패치가 섞여 있으면 뭉개지 않고 그대로 적는다", () => {
  const { container } = render(
    <PatchBaseline patches={["Update 43", "Update 42"]} />,
  );
  expect(container.textContent).toContain("Update 43, Update 42");
});

test("실린 콘텐츠가 없으면 표기도 세우지 않는다", () => {
  const { container } = render(<PatchBaseline patches={[]} />);
  expect(container.textContent).toBe("");
});

test("커밋된 오버레이에서 표기가 파생된다", () => {
  expect(starchartPatchBaseline.length).toBeGreaterThan(0);
});
