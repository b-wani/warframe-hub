import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { OnboardingRepository } from "@/starchart/onboarding-repository";
import { ProgressControls } from "./progress-controls";

function fakeOnboarding(dismissed = false): OnboardingRepository & {
  dismissedCount: number;
} {
  return {
    dismissedCount: 0,
    isDismissed() {
      return dismissed;
    },
    dismiss() {
      this.dismissedCount += 1;
      dismissed = true;
    },
  };
}

function renderControls({
  completedIds = new Set<string>(),
  onboarding = fakeOnboarding(),
}: {
  completedIds?: ReadonlySet<string>;
  onboarding?: OnboardingRepository;
} = {}) {
  const onImport = vi.fn();
  const onReset = vi.fn();
  const view = render(
    <ProgressControls
      completedIds={completedIds}
      knownNodeIds={new Set(["SolNode27"])}
      onImport={onImport}
      onReset={onReset}
      onboarding={onboarding}
    />,
  );
  return { ...view, onImport, onReset };
}

const banner = () =>
  screen.queryByText(/프로필을 붙여넣으면 클리어한 노드/);

afterEach(() => vi.restoreAllMocks());

describe("온보딩 배너", () => {
  test("완료 집합이 비어 있으면 보인다", () => {
    renderControls();
    expect(banner()).not.toBeNull();
  });

  test("완료가 하나라도 있으면 보이지 않는다", () => {
    renderControls({ completedIds: new Set(["SolNode27"]) });
    expect(banner()).toBeNull();
  });

  test("이미 닫은 적이 있으면 다시 나타나지 않는다", () => {
    renderControls({ onboarding: fakeOnboarding(true) });
    expect(banner()).toBeNull();
  });

  test("닫으면 사라지고 해제가 영구히 기록된다", async () => {
    const user = userEvent.setup();
    const onboarding = fakeOnboarding();
    renderControls({ onboarding });

    await user.click(screen.getByRole("button", { name: "닫기" }));

    expect(banner()).toBeNull();
    expect(onboarding.dismissedCount).toBe(1);
  });
});

describe("툴바", () => {
  test("가져오기 버튼은 배너를 닫은 뒤에도 상시 열려 있다", async () => {
    const user = userEvent.setup();
    renderControls({ onboarding: fakeOnboarding(true) });

    await user.click(screen.getByRole("button", { name: "진행도 가져오기" }));
    expect(screen.getByRole("dialog", { name: "진행도 가져오기" })).toBeTruthy();
  });

  test("배너에서도 위저드를 연다", async () => {
    const user = userEvent.setup();
    renderControls();

    const [, fromBanner] = screen.getAllByRole("button", {
      name: "진행도 가져오기",
    });
    await user.click(fromBanner);
    expect(screen.getByRole("dialog", { name: "진행도 가져오기" })).toBeTruthy();
  });
});

describe("진행도 전체 초기화", () => {
  test("삭제 개수를 확인받고 나서야 초기화한다", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { onReset } = renderControls({
      completedIds: new Set(["SolNode27", "SolNode89"]),
    });

    await user.click(screen.getByRole("button", { name: "진행도 설정" }));
    await user.click(screen.getByRole("button", { name: "진행도 전체 초기화" }));

    expect(confirm).toHaveBeenCalledWith(
      "완료 2개가 삭제됩니다. 계속할까요?",
    );
    expect(onReset).toHaveBeenCalled();
  });

  test("확인을 취소하면 아무 일도 없다", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const { onReset } = renderControls({
      completedIds: new Set(["SolNode27"]),
    });

    await user.click(screen.getByRole("button", { name: "진행도 설정" }));
    await user.click(screen.getByRole("button", { name: "진행도 전체 초기화" }));

    expect(onReset).not.toHaveBeenCalled();
  });

  test("지울 완료가 없으면 초기화 버튼을 누를 수 없다", async () => {
    const user = userEvent.setup();
    renderControls();

    await user.click(screen.getByRole("button", { name: "진행도 설정" }));
    expect(
      screen.getByRole("button", { name: "진행도 전체 초기화" }),
    ).toHaveProperty("disabled", true);
  });
});
