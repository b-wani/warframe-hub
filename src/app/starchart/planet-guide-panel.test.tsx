import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import type { PlanetGuide } from "@/starchart/planet-guide";
import { PlanetGuidePanel } from "./planet-guide-panel";

const earth: PlanetGuide = {
  body: "Earth",
  summary: "여기서부터 시작한다.",
  basedOnPatch: "Update 43",
  objectives: [
    { slug: "vors-prize", kind: "quest", title: "보어의 전리품" },
    {
      slug: "rhino-prep",
      kind: "preparation",
      title: "라이노 제작 시작",
      note: "수성 교차점 과제",
    },
  ],
};

describe("PlanetGuidePanel", () => {
  test("안내 본문과 기준 패치를 보여 준다", () => {
    render(
      <PlanetGuidePanel
        guide={earth}
        completedIds={new Set()}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByText("여기서부터 시작한다.")).toBeTruthy();
    expect(screen.getByText("기준 패치 Update 43")).toBeTruthy();
  });

  test("본문이 아직 없으면 준비 중임을 적는다 — 지어내지 않는다", () => {
    render(
      <PlanetGuidePanel
        guide={{ ...earth, summary: undefined }}
        completedIds={new Set()}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByText(/준비 중/)).toBeTruthy();
  });

  test("비노드 목표가 체크 항목으로 선다", () => {
    render(
      <PlanetGuidePanel
        guide={earth}
        completedIds={new Set()}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByRole("checkbox", { name: /보어의 전리품/ })).toBeTruthy();
    expect(
      screen.getByRole("checkbox", { name: /라이노 제작 시작/ }),
    ).toBeTruthy();
  });

  test("종류를 글로도 구별한다 — 색만으로 알리지 않는다", () => {
    render(
      <PlanetGuidePanel
        guide={earth}
        completedIds={new Set()}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByText("퀘스트")).toBeTruthy();
    expect(screen.getByText("준비")).toBeTruthy();
  });

  test("부연은 있는 것만 — 없는 줄은 화면에도 없다", () => {
    render(
      <PlanetGuidePanel
        guide={earth}
        completedIds={new Set()}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByText("수성 교차점 과제")).toBeTruthy();
    expect(screen.queryAllByText(/과제$/)).toHaveLength(1);
  });

  test("완료 집합에 슬러그가 있으면 체크되어 있다", () => {
    render(
      <PlanetGuidePanel
        guide={earth}
        completedIds={new Set(["vors-prize"])}
        onToggle={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("checkbox", { name: /보어의 전리품/ }),
    ).toHaveProperty("checked", true);
    expect(
      screen.getByRole("checkbox", { name: /라이노 제작 시작/ }),
    ).toHaveProperty("checked", false);
  });

  test("체크하면 슬러그 id로 알린다 — 완료 집합에 그 id로 들어간다", async () => {
    const onToggle = vi.fn();
    render(
      <PlanetGuidePanel
        guide={earth}
        completedIds={new Set()}
        onToggle={onToggle}
      />,
    );

    await userEvent.click(
      screen.getByRole("checkbox", { name: /라이노 제작 시작/ }),
    );
    expect(onToggle).toHaveBeenCalledWith("rhino-prep");
  });

  test("이미 완료된 항목을 다시 누르면 같은 슬러그로 해제를 알린다", async () => {
    const onToggle = vi.fn();
    render(
      <PlanetGuidePanel
        guide={earth}
        completedIds={new Set(["vors-prize"])}
        onToggle={onToggle}
      />,
    );

    await userEvent.click(screen.getByRole("checkbox", { name: /보어의 전리품/ }));
    expect(onToggle).toHaveBeenCalledWith("vors-prize");
  });

  test("몇 개를 마쳤는지 센다", () => {
    const { rerender } = render(
      <PlanetGuidePanel
        guide={earth}
        completedIds={new Set()}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByText("0/2")).toBeTruthy();

    rerender(
      <PlanetGuidePanel
        guide={earth}
        completedIds={new Set(["vors-prize", "rhino-prep"])}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByText("2/2")).toBeTruthy();
  });

  test("비노드 목표가 없는 가이드는 목록도 개수도 그리지 않는다", () => {
    render(
      <PlanetGuidePanel
        guide={{ ...earth, objectives: [] }}
        completedIds={new Set()}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.queryByText("비노드 목표")).toBeNull();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });
});
