import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, expect, test } from "vitest";
import { getRoadmap } from "@/roadmap/roadmap";
import { RoadmapTracker } from "./tracker";

beforeEach(() => {
  window.localStorage.clear();
});

function renderTracker() {
  render(<RoadmapTracker roadmap={getRoadmap()} />);
}

test("노드 상세에 선행조건이 제목으로 표시된다", () => {
  renderTracker();
  const node = screen
    .getByRole("heading", { name: "금성 교차점 (지구 → 금성)" })
    .closest("li")!;
  const prereqs = within(node).getByRole("region", { name: "선행조건" });
  expect(within(prereqs).getByText("스승 (The Teacher)")).toBeDefined();
});

test("노드 상세에 출처 크레딧과 원문 링크가 표시된다", () => {
  renderTracker();
  const node = screen
    .getByRole("heading", { name: "보어의 전리품 (Vor's Prize)" })
    .closest("li")!;
  const link = within(node).getByRole("link", {
    name: "공식 위키 — Vor's Prize",
  });
  expect(link.getAttribute("href")).toBe(
    "https://wiki.warframe.com/w/Vor%27s_Prize",
  );
});

test("스포일러 노드는 제목과 내용이 기본적으로 가려져 있다", () => {
  renderTracker();
  expect(screen.queryByText("나타 (Natah)")).toBeNull();
  expect(screen.queryByText(/로터스의 과거/)).toBeNull();
  expect(
    screen.getAllByRole("button", { name: "스포일러 공개" }).length,
  ).toBeGreaterThan(0);
});

test("스포일러 공개 버튼을 누르면 제목과 내용이 보인다", async () => {
  renderTracker();
  const user = userEvent.setup();
  await user.click(screen.getAllByRole("button", { name: "스포일러 공개" })[0]);
  expect(
    screen.getByRole("heading", { name: "나타 (Natah)" }),
  ).toBeDefined();
  expect(screen.getByText(/로터스의 과거/)).toBeDefined();
});

test("다음 목표 목록에서도 스포일러 제목은 가려진다", async () => {
  renderTracker();
  const user = userEvent.setup();
  // 스포일러가 아닌 노드를 전부 완료 처리하면 스포일러 노드(나타)가
  // 다음 목표에 올라온다.
  const roadmap = getRoadmap();
  for (const node of roadmap.nodes) {
    if (node.spoiler) continue;
    await user.click(
      screen.getByRole("checkbox", { name: `${node.title} 완료` }),
    );
  }
  const nextGoals = screen.getByRole("region", { name: "다음 목표" });
  expect(within(nextGoals).queryByText("나타 (Natah)")).toBeNull();
  expect(within(nextGoals).getByText("??? (스포일러)")).toBeDefined();
});
