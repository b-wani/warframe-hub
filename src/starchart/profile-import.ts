/**
 * 진행도 가져오기의 파싱 층 (스펙 §5).
 *
 * 사용자가 비문서화 프로필 엔드포인트의 JSON을 직접 붙여넣고, 우리는 그것을
 * 클라이언트에서만 읽는다 — 네트워크 호출은 없다(레이트리밋·CORS 때문에 서버
 * 프록시를 보류했다, #27).
 *
 * 파서는 관대하다. 응답 형태가 예고 없이 바뀌는 비문서화 경로이므로 `Missions`
 * 배열 하나만 찾으면 되고, 그 안에서도 우리가 아는 노드 id만 골라 쓴다. 대신
 * 실패는 네 갈래로 또렷하게 나눈다 — 사용자가 무엇을 잘못했는지(혹은 우리가
 * 무엇을 놓쳤는지) 문구 하나로 알 수 있어야 해서다.
 *
 * 스틸패스(`Tier: 1`) 기록은 여기서 버린다. 진행도 모델에 스틸패스 축이 없고,
 * 스틸패스는 일반 클리어의 상위집합이라 버려도 진행도가 줄지 않는다(CONTEXT).
 */

/** 프로필 엔드포인트 — 사용자가 URL을 손으로 짜맞추지 않게 앱이 조립한다. */
const PROFILE_ENDPOINT = "https://api.warframe.com/cdn/getProfileViewingData.php";

/** 계정 ID 확보 절차의 원본 안내(FrameHub gist, #27). */
export const ACCOUNT_ID_GUIDE_URL =
  "https://gist.github.com/DaPigGuy/18349a0fd5ad08502305a98f8b115c26";

/** 계정 ID는 hex 문자열이다 — 닉네임 조회는 U38.0.8에서 제거됐다(#27). */
const ACCOUNT_ID_PATTERN = /[0-9a-f]{16,}/i;

/**
 * 입력에서 계정 ID를 뽑는다. 아이디만 붙여넣든 프로필 URL을 통째로 붙여넣든
 * 같은 결과를 준다 — 어느 쪽이든 사용자가 원한 것은 하나다.
 */
export function accountIdFrom(raw: string): string | null {
  const match = ACCOUNT_ID_PATTERN.exec(raw.trim());
  return match ? match[0].toLowerCase() : null;
}

/** 계정 ID로 프로필 URL을 조립한다. */
export function profileUrl(accountId: string): string {
  return `${PROFILE_ENDPOINT}?playerId=${encodeURIComponent(accountId)}`;
}

/** 붙여넣은 것이 JSON이 아니라 URL인가 — 1단계로 되돌릴 신호다. */
export function looksLikeUrl(raw: string): boolean {
  const text = raw.trim();
  return /^(https?:\/\/|www\.)\S*$/i.test(text);
}

/**
 * 붙여넣기 한 번의 결과. 오류 4구분(스펙 §5)이 여기 그대로 있다 — `url`은
 * 오류라기보다 되돌림이고, 나머지 셋이 실패, `ready`가 미리보기로 간다.
 */
export type ProfileImport =
  /** URL을 붙여넣었다 — 1단계로 되돌린다. 계정 ID를 건질 수 있으면 함께 준다. */
  | { kind: "url"; accountId: string | null }
  /** ① JSON으로 읽히지 않는다. */
  | { kind: "invalid-json" }
  /** ② `Missions`가 없다 — 프로필 데이터가 아니거나 프로필이 비공개다. */
  | { kind: "not-profile" }
  /** ③ `Missions`는 있는데 아는 노드가 하나도 없다 — 우리 쪽 버그 신호다. */
  | { kind: "no-known-nodes"; missionCount: number }
  /** ④ 정상 — 미리보기로 간다. */
  | {
      kind: "ready";
      /** 아는 노드 id(중복 제거, 데이터셋에 있는 것만). */
      nodeIds: readonly string[];
      /** 버린 스틸패스 기록 수 — 안내 한 줄을 띄울지 정한다. */
      steelPathIgnored: number;
    };

type RawMission = { Tag?: unknown; Tier?: unknown };

/**
 * 붙여넣은 텍스트를 결과 하나로 바꾼다. 아는 노드 id 집합을 받아 그 밖의
 * `Tag`는 전부 버린다 — 이벤트 노드처럼 우리 지도에 없는 것이 섞여 있어도
 * 가져오기가 실패하지 않아야 한다.
 */
export function parseProfileImport(
  raw: string,
  knownNodeIds: ReadonlySet<string>,
): ProfileImport {
  if (looksLikeUrl(raw)) return { kind: "url", accountId: accountIdFrom(raw) };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { kind: "invalid-json" };
  }

  const missions = findMissions(parsed);
  if (missions === null) return { kind: "not-profile" };

  const nodeIds = new Set<string>();
  let steelPathIgnored = 0;
  for (const entry of missions) {
    const mission = (entry ?? {}) as RawMission;
    const tag = typeof mission.Tag === "string" ? mission.Tag : null;
    if (tag === null || !knownNodeIds.has(tag)) continue;
    // 스틸패스는 진행도 축이 아니다 — 세어만 두고 완료 집합에는 넣지 않는다
    if (mission.Tier === 1) steelPathIgnored += 1;
    else nodeIds.add(tag);
  }

  if (nodeIds.size === 0) {
    return { kind: "no-known-nodes", missionCount: missions.length };
  }
  return { kind: "ready", nodeIds: [...nodeIds], steelPathIgnored };
}

/**
 * `Missions` 배열을 찾는다. 최상위에 있을 수도, 응답 껍데기(`Results[0]`) 안에
 * 있을 수도 있다 — 비문서화 엔드포인트라 껍데기가 바뀐 전례가 있어 둘 다 본다.
 */
function findMissions(parsed: unknown): readonly unknown[] | null {
  for (const candidate of [parsed, ...resultsOf(parsed)]) {
    const missions = (candidate as { Missions?: unknown } | null)?.Missions;
    if (Array.isArray(missions)) return missions;
  }
  return null;
}

function resultsOf(parsed: unknown): readonly unknown[] {
  const results = (parsed as { Results?: unknown } | null)?.Results;
  return Array.isArray(results) ? results : [];
}

/** 미리보기 숫자 — 반영 전에 무엇이 일어나는지 알리는 유일한 값이다. */
export type ImportPreview = {
  /** 프로필에서 인식한 노드 수. */
  recognized: number;
  /** 그중 완료 집합에 새로 들어갈 수. */
  added: number;
  /** 이미 갖고 있어 그대로 남는 완료 수 — 병합은 지우지 않는다. */
  kept: number;
};

/**
 * 합집합 병합이 무엇을 바꾸는지 미리 센다. 세는 것과 반영하는 것이 같은 집합
 * 계산이라 미리보기와 결과가 어긋날 자리가 없다.
 */
export function importPreview(
  nodeIds: readonly string[],
  completedIds: ReadonlySet<string>,
): ImportPreview {
  const added = nodeIds.filter((id) => !completedIds.has(id)).length;
  return { recognized: nodeIds.length, added, kept: completedIds.size };
}
