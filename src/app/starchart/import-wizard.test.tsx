import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ImportWizard } from "./import-wizard";

const KNOWN = new Set(["SolNode27", "SolNode89", "SolNode1"]);
const ACCOUNT_ID = "5f2b9c1d3e4a5b6c7d8e9f01";

function profileJson(missions: unknown[]): string {
  return JSON.stringify({ Results: [{ Missions: missions }] });
}

function renderWizard(
  props: Partial<Parameters<typeof ImportWizard>[0]> = {},
) {
  const onImport = vi.fn();
  const onClose = vi.fn();
  render(
    <ImportWizard
      completedIds={new Set()}
      knownNodeIds={KNOWN}
      onImport={onImport}
      onClose={onClose}
      {...props}
    />,
  );
  return { onImport, onClose };
}

/** 1단계를 통과해 붙여넣기 화면까지 간다. */
async function goToPasteStep(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("계정 ID"), ACCOUNT_ID);
  await user.click(screen.getByRole("button", { name: "프로필 열기" }));
}

async function paste(
  user: ReturnType<typeof userEvent.setup>,
  text: string,
): Promise<void> {
  const box = screen.getByLabelText("프로필 JSON");
  await user.click(box);
  await user.paste(text);
  await user.click(screen.getByRole("button", { name: "확인" }));
}

let openSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  openSpy = vi.spyOn(window, "open").mockReturnValue(null);
});
afterEach(() => openSpy.mockRestore());

describe("1단계 — 계정 ID", () => {
  test("계정 ID를 넣으면 앱이 조립한 URL을 새 탭으로 연다", async () => {
    const user = userEvent.setup();
    renderWizard();

    await goToPasteStep(user);

    expect(openSpy).toHaveBeenCalledWith(
      `https://api.warframe.com/cdn/getProfileViewingData.php?playerId=${ACCOUNT_ID}`,
      "_blank",
      "noopener,noreferrer",
    );
    expect(screen.getByLabelText("프로필 JSON")).toBeTruthy();
  });

  test("계정 ID가 없으면 열 수 없다", () => {
    renderWizard();
    expect(
      screen.getByRole("button", { name: "프로필 열기" }),
    ).toHaveProperty("disabled", true);
  });

  test("계정 ID 확보 절차를 모달 안에서 접이식으로 안내한다", () => {
    renderWizard();
    expect(screen.getByText("계정 ID는 어디서 확인하나요?")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /FrameHub/ }),
    ).toHaveProperty(
      "href",
      "https://gist.github.com/DaPigGuy/18349a0fd5ad08502305a98f8b115c26",
    );
  });
});

describe("2단계 — 오류 4구분 (스펙 §5)", () => {
  test("① JSON 파싱 실패", async () => {
    const user = userEvent.setup();
    renderWizard();
    await goToPasteStep(user);

    await paste(user, "{ 이건 JSON이 아니다");
    expect(screen.getByRole("alert").textContent).toContain(
      "JSON으로 읽을 수 없습니다",
    );
  });

  test("② Missions 없음 — 프로필 데이터가 아니거나 비공개", async () => {
    const user = userEvent.setup();
    renderWizard();
    await goToPasteStep(user);

    await paste(user, '{"Results":[{"DisplayName":"나"}]}');
    expect(screen.getByRole("alert").textContent).toContain(
      "프로필 데이터가 아닙니다",
    );
    expect(screen.getByRole("alert").textContent).toContain("비공개");
  });

  test("③ 아는 노드 0건 — 제보 안내", async () => {
    const user = userEvent.setup();
    renderWizard();
    await goToPasteStep(user);

    await paste(user, profileJson([{ Tag: "EventNode1" }]));
    expect(screen.getByRole("alert").textContent).toContain("제보");
  });

  test("URL을 붙여넣으면 1단계로 되돌리고 계정 ID를 채워 준다", async () => {
    const user = userEvent.setup();
    renderWizard();
    await goToPasteStep(user);

    await paste(
      user,
      `https://api.warframe.com/cdn/getProfileViewingData.php?playerId=${ACCOUNT_ID}`,
    );

    expect(screen.getByLabelText("계정 ID")).toHaveProperty("value", ACCOUNT_ID);
    expect(screen.getByRole("alert").textContent).toContain("주소");
  });
});

describe("2단계 — 미리보기와 확정", () => {
  test("인식·신규·유지 수를 보여 주고, 확정해야 병합한다", async () => {
    const user = userEvent.setup();
    const { onImport, onClose } = renderWizard({
      completedIds: new Set(["SolNode27", "quest-vor-prize"]),
    });
    await goToPasteStep(user);

    await paste(
      user,
      profileJson([{ Tag: "SolNode27" }, { Tag: "SolNode89" }]),
    );

    expect(screen.getByText(/노드 2개 인식/).textContent).toContain(
      "1개 새로 추가",
    );
    expect(screen.getByText(/노드 2개 인식/).textContent).toContain(
      "기존 2개 유지",
    );
    expect(onImport).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "진행도에 반영" }));
    expect(onImport).toHaveBeenCalledWith(["SolNode27", "SolNode89"]);
    expect(onClose).toHaveBeenCalled();
  });

  test("스틸패스 기록은 무시되고 안내 한 줄만 남는다", async () => {
    const user = userEvent.setup();
    const { onImport } = renderWizard();
    await goToPasteStep(user);

    await paste(
      user,
      profileJson([
        { Tag: "SolNode27", Tier: 1 },
        { Tag: "SolNode89" },
      ]),
    );

    expect(screen.getByText(/스틸패스 기록은 v1에서 다루지 않습니다/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "진행도에 반영" }));
    expect(onImport).toHaveBeenCalledWith(["SolNode89"]);
  });

  test("ESC는 모달만 닫는다", async () => {
    const user = userEvent.setup();
    const onMapEscape = vi.fn();
    window.addEventListener("keydown", onMapEscape);
    const { onClose } = renderWizard();

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalled();
    expect(onMapEscape).not.toHaveBeenCalled();
    window.removeEventListener("keydown", onMapEscape);
  });
});
