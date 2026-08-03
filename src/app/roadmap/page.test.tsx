import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import RoadmapPage from "./page";

test("로드맵 페이지에 샘플 노드들이 목록으로 표시된다", () => {
  render(<RoadmapPage />);
  const list = screen.getByRole("list", { name: "로드맵" });
  const items = within(list).getAllByRole("listitem");
  expect(items.length).toBeGreaterThanOrEqual(2);
  expect(
    within(list).getByText("보의 전리품 (Vor's Prize)"),
  ).toBeDefined();
  expect(within(list).getByText("지구 → 금성 정크션")).toBeDefined();
});

test("노드의 준비물과 주의사항이 표시된다", () => {
  render(<RoadmapPage />);
  expect(
    screen.getByText(/라이노 부품 설계도/),
  ).toBeDefined();
  expect(
    screen.getByText(/설계도를 얻는 즉시 제작을 걸어두자/),
  ).toBeDefined();
});
