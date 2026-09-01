import { describe, expect, test } from "vitest";
import {
  accountIdFrom,
  importPreview,
  looksLikeUrl,
  parseProfileImport,
  profileUrl,
} from "./profile-import";

const known = new Set(["SolNode27", "SolNode1", "SolNode89"]);
const ACCOUNT_ID = "5f2b9c1d3e4a5b6c7d8e9f01";

function profile(missions: unknown[]): string {
  return JSON.stringify({ Results: [{ Missions: missions }] });
}

describe("계정 ID와 프로필 URL", () => {
  test("앱이 URL을 조립한다 — 사용자가 손으로 짜맞추지 않는다", () => {
    expect(profileUrl(ACCOUNT_ID)).toBe(
      `https://api.warframe.com/cdn/getProfileViewingData.php?playerId=${ACCOUNT_ID}`,
    );
  });

  test("아이디만 붙여넣든 URL을 통째로 붙여넣든 같은 계정 ID를 얻는다", () => {
    expect(accountIdFrom(`  ${ACCOUNT_ID.toUpperCase()} `)).toBe(ACCOUNT_ID);
    expect(accountIdFrom(profileUrl(ACCOUNT_ID))).toBe(ACCOUNT_ID);
  });

  test("계정 ID로 보이지 않는 입력은 없다고 답한다", () => {
    expect(accountIdFrom("")).toBeNull();
    expect(accountIdFrom("내 닉네임")).toBeNull();
    expect(accountIdFrom("abc123")).toBeNull();
  });

  test("URL 붙여넣기를 알아본다", () => {
    expect(looksLikeUrl(` ${profileUrl(ACCOUNT_ID)} `)).toBe(true);
    expect(looksLikeUrl('{"Missions":[]}')).toBe(false);
  });
});

describe("parseProfileImport — 오류 4구분 (스펙 §5)", () => {
  test("URL을 붙여넣으면 계정 ID를 건져 1단계로 되돌린다", () => {
    expect(parseProfileImport(profileUrl(ACCOUNT_ID), known)).toEqual({
      kind: "url",
      accountId: ACCOUNT_ID,
    });
  });

  test("① JSON으로 읽히지 않으면 파싱 실패다", () => {
    expect(parseProfileImport("{ 이건 JSON이 아니다", known)).toEqual({
      kind: "invalid-json",
    });
  });

  test("② Missions가 없으면 프로필 데이터가 아니다", () => {
    expect(parseProfileImport('{"Results":[{"DisplayName":"나"}]}', known)).toEqual(
      { kind: "not-profile" },
    );
    expect(parseProfileImport("[1,2,3]", known)).toEqual({ kind: "not-profile" });
  });

  test("③ Missions는 있는데 아는 노드가 0건이면 우리 쪽 신호다", () => {
    expect(
      parseProfileImport(profile([{ Tag: "EventNode1" }, { Tag: "???" }]), known),
    ).toEqual({ kind: "no-known-nodes", missionCount: 2 });
  });

  test("④ 정상 — 아는 노드만 중복 없이 모은다", () => {
    const result = parseProfileImport(
      profile([
        { Tag: "SolNode27", Completes: 3 },
        { Tag: "SolNode27", Completes: 1 },
        { Tag: "EventNode1" },
        { Tag: "SolNode89" },
        { Completes: 2 },
        null,
      ]),
      known,
    );
    expect(result).toEqual({
      kind: "ready",
      nodeIds: ["SolNode27", "SolNode89"],
      steelPathIgnored: 0,
    });
  });

  test("Missions가 최상위에 있어도 읽는다 — 관대한 파서다", () => {
    const result = parseProfileImport(
      JSON.stringify({ Missions: [{ Tag: "SolNode1" }] }),
      known,
    );
    expect(result).toMatchObject({ kind: "ready", nodeIds: ["SolNode1"] });
  });

  test("스틸패스(Tier 1) 기록은 완료로 세지 않고 개수만 남긴다", () => {
    const result = parseProfileImport(
      profile([
        { Tag: "SolNode27", Tier: 1 },
        { Tag: "SolNode89", Tier: 1 },
        { Tag: "SolNode1" },
      ]),
      known,
    );
    expect(result).toEqual({
      kind: "ready",
      nodeIds: ["SolNode1"],
      steelPathIgnored: 2,
    });
  });
});

describe("importPreview", () => {
  test("인식·신규·유지 수를 센다", () => {
    expect(
      importPreview(
        ["SolNode27", "SolNode89"],
        new Set(["SolNode27", "quest-vor-prize"]),
      ),
    ).toEqual({ recognized: 2, added: 1, kept: 2 });
  });

  test("전부 이미 갖고 있으면 새로 추가되는 것이 없다 — 재실행은 무해하다", () => {
    expect(importPreview(["SolNode27"], new Set(["SolNode27"]))).toEqual({
      recognized: 1,
      added: 0,
      kept: 1,
    });
  });
});
