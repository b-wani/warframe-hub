import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, test, vi } from "vitest";
import type { NodeDetail } from "@/starchart/node-detail";
import type { NodeOverlay } from "@/starchart/node-overlay";
import { NodeDetailPanel } from "./node-detail-panel";

/**
 * 상세 내용만 보는 테스트를 위한 얇은 껍데기 — 일괄 체크 배선은 아래 describe가
 * 실제 완료 집합을 넣어 따로 본다.
 */
const Panel = (
  props: Omit<
    ComponentProps<typeof NodeDetailPanel>,
    "completedIds" | "onBulkComplete"
  >,
) => (
  <NodeDetailPanel
    completedIds={new Set()}
    onBulkComplete={vi.fn()}
    {...props}
  />
);

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
    render(<Panel detail={ePrime} state="uncleared" onToggle={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "E Prime" })).toBeTruthy();
    expect(screen.getByText("섬멸")).toBeTruthy();
    expect(screen.getByText("그리니어")).toBeTruthy();
    expect(screen.getByText("1–3")).toBeTruthy();
  });

  test("빠진 항목은 빈칸을 지어내지 않고 아예 빼놓는다", () => {
    render(
      <Panel
        detail={{ id: "X", name: "X", junction: false }}
        state="locked"
        onToggle={vi.fn()}
      />,
    );
    expect(screen.queryByText("팩션")).toBeNull();
    expect(screen.queryByText("적 레벨")).toBeNull();
  });

  test("3상태를 글로도 알린다 — 색만으로 알리지 않는다", () => {
    const { rerender } = render(<Panel detail={ePrime} state="locked" onToggle={vi.fn()} />);
    expect(screen.getByText("잠김")).toBeTruthy();

    rerender(<Panel detail={ePrime} state="cleared" onToggle={vi.fn()} />);
    expect(screen.getByText("클리어")).toBeTruthy();
  });

  test("교차점은 상세에서도 구별된다", () => {
    render(
      <Panel
        detail={{ ...ePrime, name: "금성 교차점", junction: true }}
        state="uncleared"
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByText("교차점")).toBeTruthy();
  });

  test("완료 토글은 클리어일 때 켜져 있다", () => {
    const { rerender } = render(<Panel detail={ePrime} state="uncleared" onToggle={vi.fn()} />);
    const toggle = () => screen.getByRole("checkbox", { name: "완료" });
    expect(toggle()).toHaveProperty("checked", false);

    rerender(<Panel detail={ePrime} state="cleared" onToggle={vi.fn()} />);
    expect(toggle()).toHaveProperty("checked", true);
  });

  test("완료 토글을 누르면 그 노드의 id로 알린다", async () => {
    const onToggle = vi.fn();
    render(<Panel detail={ePrime} state="uncleared" onToggle={onToggle} />);

    await userEvent.click(screen.getByRole("checkbox", { name: "완료" }));
    expect(onToggle).toHaveBeenCalledWith("SolNode27");
  });

  test("잠긴 노드도 체크할 수 있다 — 진행도는 사용자가 아는 사실이다", async () => {
    const onToggle = vi.fn();
    render(<Panel detail={ePrime} state="locked" onToggle={onToggle} />);

    const toggle = screen.getByRole("checkbox", { name: "완료" });
    expect(toggle).toHaveProperty("disabled", false);
    await userEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledWith("SolNode27");
  });

  test("호버 없이 닿는다 — 상세는 선택만으로 이미 열려 있다", () => {
    const { container } = render(<Panel detail={ePrime} state="uncleared" onToggle={vi.fn()} />);
    const panel = container.querySelector("[data-selected-node='SolNode27']");
    expect(panel).not.toBeNull();
    expect(panel!.getAttribute("data-node-state")).toBe("uncleared");
  });
});

describe("NodeDetailPanel 구간 일괄 체크", () => {
  test("여기까지 완료가 확인 단계를 거쳐 선행 노드까지 채운다", async () => {
    const user = userEvent.setup();
    const onBulkComplete = vi.fn();
    // Mariana(SolNode89)는 E Prime(SolNode27) 다음이다 — 둘이 함께 채워진다
    render(
      <NodeDetailPanel
        detail={{ id: "SolNode89", name: "Mariana", junction: false }}
        state="locked"
        completedIds={new Set()}
        onToggle={vi.fn()}
        onBulkComplete={onBulkComplete}
      />,
    );

    await user.click(screen.getByRole("button", { name: "여기까지 완료" }));
    expect(screen.getByText(/2개가 새로 완료됩니다/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "2개 완료" }));
    expect([...onBulkComplete.mock.calls[0][0]].sort()).toEqual([
      "SolNode27",
      "SolNode89",
    ]);
  });

  test("자신과 선행이 모두 완료된 노드에는 버튼이 없다", () => {
    render(
      <NodeDetailPanel
        detail={{ id: "SolNode89", name: "Mariana", junction: false }}
        state="cleared"
        completedIds={new Set(["SolNode27", "SolNode89"])}
        onToggle={vi.fn()}
        onBulkComplete={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "여기까지 완료" })).toBeNull();
    // 개별 체크는 그대로 있다 — 사라지는 것은 일괄 체크뿐이다
    expect(screen.getByRole("checkbox", { name: "완료" })).toBeTruthy();
  });
});

describe("NodeDetailPanel 큐레이션 오버레이", () => {
  const junction: NodeDetail = {
    id: "EarthToVenusJunction",
    name: "금성 교차점",
    junction: true,
  };

  const overlay: NodeOverlay = {
    summary: "금성으로 가는 관문.",
    preparations: [
      { name: "택슨 센티넬 설계도", source: "교차점 과제 보상", quantity: 1 },
    ],
    cautions: ["과제를 다 마치기 전에는 스펙터 방에 들어갈 수 없다"],
    spoiler: false,
    sourceIds: ["wiki-venus-junction"],
    basedOnPatch: "Update 43",
  };

  test("오버레이가 있으면 구조화 데이터와 함께 표시된다", () => {
    render(
      <Panel
        detail={ePrime}
        overlay={overlay}
        state="uncleared"
        onToggle={vi.fn()}
      />,
    );

    // 구조화 데이터는 그대로 남는다 — 오버레이는 얹는 것이지 대신하는 것이 아니다
    expect(screen.getByText("섬멸")).toBeTruthy();
    expect(screen.getByText("금성으로 가는 관문.")).toBeTruthy();
    expect(screen.getByText(/택슨 센티넬 설계도/)).toBeTruthy();
    expect(
      screen.getByText("과제를 다 마치기 전에는 스펙터 방에 들어갈 수 없다"),
    ).toBeTruthy();
    expect(screen.getByText(/Update 43/)).toBeTruthy();
  });

  test("오버레이가 없는 노드는 구조화 데이터만 표시한다", () => {
    render(<Panel detail={ePrime} state="uncleared" onToggle={vi.fn()} />);

    expect(screen.getByText("섬멸")).toBeTruthy();
    expect(screen.queryByText(/기준 패치/)).toBeNull();
    expect(document.querySelector("[data-node-overlay]")).toBeNull();
  });

  test("빈 목록은 제목도 세우지 않는다 — 빈칸을 지어내지 않는다", () => {
    render(
      <Panel
        detail={junction}
        overlay={{ ...overlay, preparations: [], cautions: [] }}
        state="uncleared"
        onToggle={vi.fn()}
      />,
    );

    expect(screen.queryByText("준비물")).toBeNull();
    expect(screen.queryByText("주의")).toBeNull();
    expect(screen.queryByText("대표 드랍")).toBeNull();
  });

  test("보스의 대표 드랍을 보여 준다", () => {
    render(
      <Panel
        detail={{ id: "SolNode104", name: "Fossa", junction: false }}
        overlay={{ ...overlay, drops: ["라이노 섀시 설계도"] }}
        state="uncleared"
        onToggle={vi.fn()}
      />,
    );

    expect(screen.getByText("대표 드랍")).toBeTruthy();
    expect(screen.getByText("라이노 섀시 설계도")).toBeTruthy();
  });

  test("스포일러 콘텐츠는 접어 두고 펼쳐야 읽힌다", async () => {
    render(
      <Panel
        detail={junction}
        overlay={{ ...overlay, spoiler: true }}
        state="uncleared"
        onToggle={vi.fn()}
      />,
    );

    const summary = screen.getByText("스포일러 — 눌러서 펼치기");
    expect(summary.closest("details")?.open).toBe(false);

    await userEvent.click(summary);
    expect(summary.closest("details")?.open).toBe(true);
  });
});
