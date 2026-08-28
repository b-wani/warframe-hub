import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import type { NodeDetail } from "@/starchart/node-detail";
import { NodeDetailPanel } from "./node-detail-panel";

const ePrime: NodeDetail = {
  id: "SolNode27",
  name: "E Prime",
  mission: "섬멸",
  faction: "그리니어",
  levelRange: "1–3",
  junction: false,
};

describe("NodeDetailPanel", () => {
  test("표시명·미션 유형·팩션·레벨 범위를 모두 보여 준다", () => {
    render(
      <NodeDetailPanel detail={ePrime} state="uncleared" onToggle={vi.fn()} />,
    );

    expect(screen.getByRole("heading", { name: "E Prime" })).toBeTruthy();
    expect(screen.getByText("섬멸")).toBeTruthy();
    expect(screen.getByText("그리니어")).toBeTruthy();
    expect(screen.getByText("1–3")).toBeTruthy();
  });

  test("빠진 항목은 빈칸을 지어내지 않고 아예 빼놓는다", () => {
    render(
      <NodeDetailPanel
        detail={{ id: "X", name: "X", junction: false }}
        state="locked"
        onToggle={vi.fn()}
      />,
    );
    expect(screen.queryByText("팩션")).toBeNull();
    expect(screen.queryByText("적 레벨")).toBeNull();
  });

  test("3상태를 글로도 알린다 — 색만으로 알리지 않는다", () => {
    const { rerender } = render(
      <NodeDetailPanel detail={ePrime} state="locked" onToggle={vi.fn()} />,
    );
    expect(screen.getByText("잠김")).toBeTruthy();

    rerender(
      <NodeDetailPanel detail={ePrime} state="cleared" onToggle={vi.fn()} />,
    );
    expect(screen.getByText("클리어")).toBeTruthy();
  });

  test("교차점은 상세에서도 구별된다", () => {
    render(
      <NodeDetailPanel
        detail={{ ...ePrime, name: "금성 교차점", junction: true }}
        state="uncleared"
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByText("교차점")).toBeTruthy();
  });

  test("완료 토글은 클리어일 때 켜져 있다", () => {
    const { rerender } = render(
      <NodeDetailPanel detail={ePrime} state="uncleared" onToggle={vi.fn()} />,
    );
    const toggle = () => screen.getByRole("checkbox", { name: "완료" });
    expect(toggle()).toHaveProperty("checked", false);

    rerender(
      <NodeDetailPanel detail={ePrime} state="cleared" onToggle={vi.fn()} />,
    );
    expect(toggle()).toHaveProperty("checked", true);
  });

  test("완료 토글을 누르면 그 노드의 id로 알린다", async () => {
    const onToggle = vi.fn();
    render(
      <NodeDetailPanel detail={ePrime} state="uncleared" onToggle={onToggle} />,
    );

    await userEvent.click(screen.getByRole("checkbox", { name: "완료" }));
    expect(onToggle).toHaveBeenCalledWith("SolNode27");
  });

  test("잠긴 노드도 체크할 수 있다 — 진행도는 사용자가 아는 사실이다", async () => {
    const onToggle = vi.fn();
    render(
      <NodeDetailPanel detail={ePrime} state="locked" onToggle={onToggle} />,
    );

    const toggle = screen.getByRole("checkbox", { name: "완료" });
    expect(toggle).toHaveProperty("disabled", false);
    await userEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledWith("SolNode27");
  });

  test("호버 없이 닿는다 — 상세는 선택만으로 이미 열려 있다", () => {
    const { container } = render(
      <NodeDetailPanel detail={ePrime} state="uncleared" onToggle={vi.fn()} />,
    );
    const panel = container.querySelector("[data-selected-node='SolNode27']");
    expect(panel).not.toBeNull();
    expect(panel!.getAttribute("data-node-state")).toBe("uncleared");
  });
});
