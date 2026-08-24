# Research: 워프레임 계정 스타차트 진행도 가져오기 (이슈 #27)

조사일: 2026-08-24. 질문: 외부 서비스가 워프레임 계정의 클리어한 스타차트 노드 목록을 읽어올 수 있는가?

## 1. 공식 공개 API

DE(Digital Extremes)가 문서화해 제공하는 계정 데이터 API는 **없다**. 공개된 것은:

- **worldState.php** — 게임 월드 상태(알림, 침공 등). 계정 데이터 아님. 비문서화, "언제든 바뀔 수 있음". ([위키: World State](https://wiki.warframe.com/w/World_State))
- **Public Export** — 아이템/노드 정적 데이터(공식 컴패니언 앱·Twitch 확장용). 계정 데이터 아님. ([위키: Public Export](https://warframe.fandom.com/wiki/Public_Export))

포럼에서 계정 API 요청 스레드가 여럿 있으나 공식 제공은 없음.

## 2. 비공식 경로: getProfileViewingData

게임 내 "프로필 보기"가 쓰는 엔드포인트가 사실상 유일한 경로다.

- 현재 URL (PC): `https://api.warframe.com/cdn/getProfileViewingData.php?playerId=<ACCOUNT_ID>`
  (콘솔/모바일은 도메인만 다름; 구 `content.warframe.com/dynamic/...`도 동계열)
- **인증: 로그인 불필요** — 공개 엔드포인트. 단 **Update 38.0.8(2025 초) 이후 `n=<닉네임>` 조회가 제거**되어, 이제 **계정 ID(hex)가 필수**다. 닉네임만으로는 불가. ([browse.wf/profile](https://browse.wf/profile), [FrameHub 안내 gist](https://gist.github.com/DaPigGuy/18349a0fd5ad08502305a98f8b115c26))
- 계정 ID는 사용자가 직접 확인해야 함(EE.log, 게임 내 링크 복사 등 — FrameHub gist가 절차 안내).

### 응답에 스타차트 진행도 포함 여부: **포함됨**

응답 JSON의 `Missions` 배열이 클리어 노드 목록이다. [WFCD/profile-parser](https://github.com/WFCD/profile-parser)의 `src/Mission.ts` 기준 원시 스키마:

```ts
interface RawMission {
  Tag?: string;      // SolNode id (예: "SolNode45")
  Completes?: number; // 클리어 횟수
  Tier?: number;      // 1 = Steel Path
  highScore?: number;
}
```

즉 일반 스타차트 + 스틸패스 클리어 여부를 SolNode id 체계로 그대로 얻을 수 있고, `warframe-worldstate-data`로 노드명/진영/미션타입 매핑이 가능하다.

### 제약

- **공격적인 레이트리밋**: 과다 요청·잘못된 ID 반복 시 IP 임시 차단 보고 (FrameHub gist). FrameHub는 이 때문에 자동 조회 UI 대신 **사용자가 직접 URL을 열어 JSON을 붙여넣는 방식**을 안내한다.
- 브라우저 직접 호출은 CORS로 막히므로 서버 프록시 또는 사용자 수동 붙여넣기가 필요.
- 게임 내 프로필 공개 설정에 따라 조회가 제한될 수 있음.
- 비문서화 엔드포인트 — 38.0.8의 닉네임 제거처럼 예고 없이 바뀐 전례가 있음.

### 커뮤니티 라이브러리

- [WFCD/profile-parser](https://github.com/WFCD/profile-parser) (JS/TS): 응답 파싱, SolNode → 노드명 변환.
- [browse.wf/profile](https://browse.wf/profile): 계정 ID 기반 프로필 뷰어(같은 엔드포인트).

## 3. ToS / 리스크

- DE [Content Policy](https://www.warframe.com/en/contentpolicy): 팬 사이트는 비상업(직접 판매 금지, 광고는 허용) 조건으로 IP 사용 허용. 데이터 엔드포인트 자체에 대한 명시적 정책 문서는 없음.
- worldState/Public Export/프로필 엔드포인트를 쓰는 커뮤니티 도구(WFCD 생태계, FrameHub, browse.wf, AlecaFrame 등)는 수년간 묵인·사실상 용인 상태. 단 공식 보장은 없다.
- 실질 리스크: (a) 예고 없는 스펙 변경, (b) 레이트리밋/IP 차단, (c) 서버 프록시 운영 시 우리 IP가 차단 대상이 되는 점.

## 4. 결론 및 권고

- **"닉네임 입력 → 자동 가져오기"는 현재 불가능** (38.0.8에서 닉네임 조회 제거).
- 현실적인 흐름 (FrameHub 방식, 권고):
  1. 사용자에게 계정 ID 확인 절차 안내 (FrameHub gist 링크 수준의 도움말).
  2. 사용자가 `getProfileViewingData.php?playerId=...` URL을 브라우저로 열어 **JSON을 복사해 붙여넣기** → 클라이언트에서 `Missions[].Tag/Tier` 파싱 → 우리 노드 체크리스트에 반영.
  3. (선택) 서버 프록시로 원클릭화할 수 있으나, 레이트리밋·차단 리스크를 우리가 떠안게 되므로 초기에는 붙여넣기 방식을 권장.
- 파싱은 `Tag`(SolNode id) + `Tier`(스틸패스) 기준, 매핑에 warframe-worldstate-data 활용.
