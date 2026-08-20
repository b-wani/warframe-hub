import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import RoadmapPage from "./page";

test("로드맵 페이지에 입문~세컨드 드림 노드들이 목록으로 표시된다", () => {
  render(<RoadmapPage />);
  const list = screen.getByRole("list", { name: "로드맵" });
  const items = within(list).getAllByRole("listitem");
  expect(items.length).toBeGreaterThanOrEqual(2);
  expect(
    within(list).getByRole("heading", { name: "보어의 전리품 (Vor's Prize)" }),
  ).toBeDefined();
  expect(
    within(list).getByRole("heading", { name: "금성 교차점 (지구 → 금성)" }),
  ).toBeDefined();
  // 두 번째 꿈은 스포일러 노드라 제목이 가려진 채 표시된다
  expect(
    within(list).queryByRole("heading", {
      name: "두 번째 꿈 (The Second Dream)",
    }),
  ).toBeNull();
});

test("노드의 준비물과 주의사항이 표시된다", () => {
  render(<RoadmapPage />);
  expect(screen.getByText(/라이노 부품 설계도/)).toBeDefined();
  expect(screen.getAllByRole("heading", { name: "주의사항" }).length).toBeGreaterThan(0);
});

test("페이지에 콘텐츠 기준 패치가 표시된다", () => {
  render(<RoadmapPage />);
  expect(screen.getByText("콘텐츠 기준 패치: Update 43")).toBeDefined();
});
