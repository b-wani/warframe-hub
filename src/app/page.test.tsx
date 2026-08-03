import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import Home from "./page";

test("홈 페이지에 서비스 이름이 보인다", () => {
  render(<Home />);
  expect(
    screen.getByRole("heading", { level: 1, name: "워프레임 허브" }),
  ).toBeDefined();
});
