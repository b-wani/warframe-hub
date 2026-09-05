import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import Home from "./page";

test("홈 페이지에 서비스 이름이 보인다", () => {
  render(<Home />);
  expect(
    screen.getByRole("heading", { level: 1, name: "워프레임 허브" }),
  ).toBeDefined();
});

// 스타차트가 유일한 진행도 화면이므로(ADR 0002) 홈에서 거기로 가는 길이
// 하나 있어야 한다 — /roadmap이 있던 자리를 대신한다.
test("홈에서 스타차트로 가는 링크가 있다", () => {
  render(<Home />);
  const link = screen.getByRole("link", { name: "스타차트 열기" });
  expect(link.getAttribute("href")).toBe("/starchart");
});
