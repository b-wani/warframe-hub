# 스타차트 v1 스펙

상태: 확정 (구현 착수 가능)
확정일: 2026-08-26
근거: [웨이파인더 맵 #20](https://github.com/b-wani/warframe-hub/issues/20)의 결정 티켓 #21~#34.
각 절 끝의 `근거:` 링크가 해당 결정의 상세(대안·기각 사유 포함)를 담은 원본이다.

용어는 [CONTEXT.md](../../CONTEXT.md)의 유비쿼터스 언어를 따른다 — 이 문서는
용어를 재정의하지 않고 사용만 한다.

## 1. 목적과 범위

워프레임 인게임 성계지도를 재현한 3D 스타차트. 실제 게임과 같은 구성·배치
(행성·노드·교차점)를 웹에서 재현하고, 그 위에 ① 사용자 진행도(로컬스토리지,
완료 집합 단일 모델)와 ② 실시간 월드스테이트(균열 + 기존 사이클·보이드 상인)를
얹어, 초보자가 "다음에 뭘 해야 하나"를 게임 하는 느낌으로 파악하게 한다.

- 스타차트가 **유일한 진행도 화면**이다. 기존 `/roadmap`은 2026-08-26에 제거했다
  — 스타차트가 생기기 전이라 진행도 화면은 그때까지 없다.
  ([ADR 0002](../adr/0002-starchart-is-the-only-progress-lens.md))
- 인게임 비주얼 기준은 2016 Star Chart 3.0 체계다 — 2025 리워크(Update 38.5)는
  경로 개편이지 비주얼 개편이 아니다. 데이터는 리워크 반영분을 쓴다.

근거: [#21 인게임 성계지도 스펙](https://github.com/b-wani/warframe-hub/issues/21), [#25 진행도 도메인 모델](https://github.com/b-wani/warframe-hub/issues/25)

## 2. 화면 구조

### 2.1 두 개의 뷰, 하나의 장면

- **성계 뷰**: 태양계 전체 — 행성/위성 17 + 특수 구역 5를 실제 천문 순서로 배치한
  천체들. 행성 전체 클리어 시 완료 아이콘 표시.
- **행성 뷰**: 행성을 줌인하면 그 행성의 노드 구름(그래프)이 행성 주위에 표시된다.
  행성 가이드(지식 베이스 기반 초보자 안내 + 비노드 목표 체크)가 함께 노출된다.
- **전환은 "연속 비행"**: 컷 전환·모프가 아니라, 한 장면 안에서 카메라가 행성까지
  시네마틱하게 비행한다(`CameraControls.setLookAt(..., true)` 보간). 세계가 끊기지
  않는 연속성이 핵심 경험이다.
- **프록시마**(7개 그룹)는 독립 천체가 아니라 해당 행성에 종속 표시 — 행성 뷰의
  ⚓ 토글로 전환하며, 프록시마 노드는 행성 바깥 고리에 배치한다.
- **릴레이** 그룹(1개)은 지도에서 숨긴다(진행도와도 무관).

근거: [#32 카메라 연출 프로토타입](https://github.com/b-wani/warframe-hub/issues/32) (변형 A 채택, B·C 기각 — `prototype/starchart-camera-interaction` 브랜치), [#26 그룹 유형](https://github.com/b-wani/warframe-hub/issues/26), [#41 성계 뷰 골격](https://github.com/b-wani/warframe-hub/issues/41) (성계 뷰·릴레이 숨김 구현 완료), [#42 행성 뷰와 연속 비행](https://github.com/b-wani/warframe-hub/issues/42) (행성 뷰·연속 비행 구현 완료 — 프록시마 ⚓ 토글은 [#48](https://github.com/b-wani/warframe-hub/issues/48))

### 2.2 노드 표현

인게임 3상태 시각을 재현한다 (노드 상태는 파생값 — §4.2):

| 상태 | 시각 |
|---|---|
| 잠김 | 검은 마름모 + 자물쇠 + 점선 연결 |
| 미클리어 | 파란 마름모 + 흰 실선 연결 |
| 클리어 | 흰 마름모 |

- 교차점(Junction)은 특수 노드로 구별해 표현한다(인게임은 과제 진행도 표기 —
  v1은 과제 시스템이 없으므로 완료/미완료만).
- 노드 선택 시 상세 표시: 표시명·미션 유형·팩션·레벨 범위 + 주요 노드(교차점
  12·보스 20)는 큐레이션 오버레이 콘텐츠(§3.3).
- 정보 노출은 선택(탭/클릭) 기준 — 호버는 데스크톱 보조 수단이며 호버에만
  의존하는 정보가 있어서는 안 된다(§7).

근거: [#21](https://github.com/b-wani/warframe-hub/issues/21), [#34 모바일 정책](https://github.com/b-wani/warframe-hub/issues/34), [#43 노드 3상태·상세·개별 체크](https://github.com/b-wani/warframe-hub/issues/43) (3상태 시각·교차점 구별·노드 상세 구현 완료 — 주요 노드의 큐레이션 오버레이 콘텐츠는 [#50](https://github.com/b-wani/warframe-hub/issues/50))

## 3. 데이터 파이프라인

### 3.1 정제 노드 데이터셋 (자동 생성)

- 산출물: `src/data/starchart.json` (커밋됨) — 노드 354 · 그룹 30(행성/위성 17,
  프록시마 7, 특수 5, 릴레이 1) · `nextNodes` 간선. 앱이 임포트하는 유일한
  스타차트 데이터.
- 생성: `pnpm build:starchart` (`scripts/build-starchart-data.mts`) — 업스트림
  [warframe-public-export-plus](https://github.com/calamity-inc/warframe-public-export-plus)의
  `ExportRegions.json` + `dict.ko.json`에서 생성. 표시명 인라인(한국어 사전 표기
  그대로), 그룹 유형 태그, 팩션 수동 매핑(enum 10종) 포함.
- 검증: 사전 누락 키·미매핑 팩션·데이터셋 밖을 가리키는 간선이 있으면 빌드 실패.
  런타임 폴백은 언어 키 마지막 세그먼트.
- 갱신: 게임 패치 때 수동 재실행 + diff 검수. 원본 사전(4.5MB)·원형 JSON은
  커밋·번들 제외.

근거: [#22 데이터 소스](https://github.com/b-wani/warframe-hub/issues/22), [#26 표시명·분류](https://github.com/b-wani/warframe-hub/issues/26), [#28 빌드 파이프라인](https://github.com/b-wani/warframe-hub/issues/28) (구현 완료, 커밋 304a759), [#56 표시명 오버라이드](https://github.com/b-wani/warframe-hub/issues/56) (업스트림 사전이 틀린 키 — 타우 성계 그룹명)

### 3.2 좌표 (수동 큐레이션)

좌표는 어느 공개 소스에도 없다. 별도 좌표 JSON 파일로 관리한다:

1. force-directed 간이 시뮬레이션으로 행성 단위 초기 배치 생성
   (반발 12000 · 간선 스프링 90px · 중심 인력 0.003, 시드 고정 — 검증된 파라미터).
2. 보정은 좌표 JSON을 에디터에서 직접 수정 → 새로고침 확인. **편집 UI는 만들지
   않는다** (드래그 편집·스크린샷 트레이싱 변형은 기각, `prototype/starchart-layout-workflow` 브랜치에 보존).

- 산출물: `src/data/starchart-layout.json` (커밋됨) — 노드 352 · 천체 29.
  릴레이 그룹은 지도에서 숨기므로 좌표 대상이 아니다.
- 생성: `pnpm build:starchart-layout` (`scripts/build-starchart-layout.mts`).
  재실행은 이미 있는 좌표를 보존하고 빠진 것만 채운다 — 수동 보정이 살아남는다.
- 검증: 좌표가 빠진 노드·그룹, 고아 좌표, 천체 배치표와 데이터셋의 그룹 불일치가
  있으면 실패한다. CI 단위 테스트가 커밋된 두 데이터셋의 정합을 지킨다.
- 워크플로 문서: [좌표 데이터셋 생성·보정](../starchart-layout-workflow.md)

근거: [#29 좌표 배치 프로토타입](https://github.com/b-wani/warframe-hub/issues/29), [#39 좌표 데이터셋 생성 파이프라인](https://github.com/b-wani/warframe-hub/issues/39) (구현 완료)

### 3.3 큐레이션 오버레이 (수동 저작)

- 대상: 주요 노드 32개 = 교차점 12 + 보스 노드(MT_ASSASSINATION) 20.
- 형태: `src/data/`에 커밋되는 노드 id 키 JSON — 자동 생성물인 starchart.json과
  분리(재생성 충돌 방지, diff 검수 용이).
- 스키마: 옛 roadmap-nodes.json 스키마(summary, preparations, cautions, spoiler,
  sourceIds, basedOnPatch — `/roadmap` 제거 전 git 이력) + 보스용 `drops`(대표
  드랍) 필드.
- 저작은 지식 베이스(`knowledge/`, 로컬 전용) 참조 재서술 — **저작 자체는 스펙
  이후 단계**이며 이 스펙의 범위 밖(§9).

근거: [#30 큐레이션 범위](https://github.com/b-wani/warframe-hub/issues/30)

## 4. 진행도 모델

### 4.1 완료 집합 (유일 원본)

- 사용자가 완료한 id의 집합 하나. 성계 노드(`SolNodeNN`)와 비노드 목표(퀘스트 7
  + 라이노 준비 1 = 8개 슬러그, 잠정)가 공존. 교차점은 SolNode id로만 기록.
- 저장: 로컬스토리지 + repository 인터페이스 경계, `version: 2`. 마이그레이션
  없음 — 로더가 모르는 버전은 빈 집합으로 읽는다(v1 데이터 자연 폐기).
- repository 경계 덕에 이후 서버 저장 전환이 용이하다(완료 집합은 합집합 병합이
  자연스럽다) — v1 범위 밖(§9).

### 4.2 파생 상태

- 노드 3상태(잠김/미클리어/클리어)는 완료 집합 + `nextNodes` 그래프에서 계산,
  저장하지 않는다.
- 행성 완료 여부·완료 아이콘도 파생.

### 4.3 조작

- **개별 체크**: 노드 상세에서 완료 토글.
- **구간 일괄 체크**: "여기까지 완료"(선행 노드 전체 완료 처리) + "행성 전체
  완료". `completeThrough` 순수 함수 규칙 유지 — 해제 없음, 몇 개가 완료되는지
  확인 단계, 확인 후 진행이 바뀌면 확인 무효, 이미 완료된 노드엔 버튼 비노출.
- **비노드 목표 체크**: 행성 가이드 안에서.

근거: [#25 진행도 도메인 모델](https://github.com/b-wani/warframe-hub/issues/25), [ADR 0002](../adr/0002-starchart-is-the-only-progress-lens.md), [#43](https://github.com/b-wani/warframe-hub/issues/43) (개별 체크·파생 상태·행성 완료 아이콘 구현 완료), [#46](https://github.com/b-wani/warframe-hub/issues/46) (구간 일괄 체크·행성 전체 완료 구현 완료 — 확인 단계·확인 무효화·버튼 비노출 포함. 비노드 목표 체크는 [#49](https://github.com/b-wani/warframe-hub/issues/49))

## 5. 진행도 가져오기 UX

경로: 비문서화 프로필 엔드포인트(`getProfileViewingData.php?playerId=<hex>`)의
JSON을 사용자가 직접 붙여넣고 클라이언트에서 파싱한다. 서버 프록시 원클릭화는
차단 리스크로 보류. 닉네임 조회는 게임에서 제거되어(U38.0.8) 계정 ID(hex) 필수.

- **진입점**: 완료 집합이 비어 있으면 온보딩 배너(닫으면 localStorage에 영구
  해제 기록) + 툴바 상시 버튼.
- **2단계 위저드**:
  1. 계정 ID 입력 → 앱이 URL을 조립해 새 탭으로 열어준다(사용자가 URL을 손으로
     짜맞추지 않게). 계정 ID 확보 절차는 모달 안 접이식 한국어 안내 + 원본
     (FrameHub gist) 링크.
  2. JSON 붙여넣기 → `Missions[].Tag` 파싱. 관대한 파서 — URL이 들어오면 1단계로
     되돌린다.
- **오류 4구분**: ① JSON 파싱 실패 ② `Missions` 없음("프로필 데이터가 아닙니다
  — 다른 페이지를 복사했거나 프로필이 비공개일 수 있습니다") ③ `Missions`는
  있으나 알려진 SolNode 0건(우리 쪽 버그 신호 — 제보 안내) ④ 정상 → 미리보기.
- **미리보기 확정 후 합집합 병합**: "노드 N개 인식, M개 새로 추가, 기존 K개
  유지". `Tier: 1`(스틸패스)은 무시하고 "스틸패스 기록은 v1에서 다루지 않습니다"
  한 줄만 표기.
- **재실행 무해**(합집합), 전용 되돌리기 없음. 탈출구는 툴바 설정 메뉴의
  **진행도 전체 초기화** — "완료 N개가 삭제됩니다" 숫자 confirm으로 보호.

근거: [#27 가져오기 경로 리서치](https://github.com/b-wani/warframe-hub/issues/27) (`docs/research/account-progress-import.md`, `research/account-progress-import` 브랜치), [#33 UX 흐름](https://github.com/b-wani/warframe-hub/issues/33), [#44 진행도 가져오기 위저드](https://github.com/b-wani/warframe-hub/issues/44) (온보딩 배너·2단계 위저드·오류 4구분·미리보기 병합·전체 초기화 구현 완료)

## 6. 월드스테이트 오버레이

- v1 범위: **보이드 균열(Void Fissure)** + 기존 데이터(낮밤 사이클·보이드 상인).
  침공·얼럿 등 추가 오버레이는 이후 확장(§9).
- 균열 표현: 인게임처럼 해당 노드에 심볼 오버레이 + 로테이션(Lith/Meso/Neo/Axi/
  Requiem/Omnia) 구분, 전용 목록 탭(활성 균열 일람 → 노드로 이동).
- 데이터는 기존 월드스테이트 어댑터(`src/worldstate/`) 경유 — 섹션 단위 독립
  실패·TTL 캐시·폴백 규칙 그대로. 균열 섹션을 어댑터에 추가한다. 월드스테이트를
  못 받아도 지도·진행도는 온전하고 실시간 항목만 빠진다.

근거: [#21](https://github.com/b-wani/warframe-hub/issues/21), 기존 월드스테이트 어댑터 규약(CONTEXT.md)

## 7. 렌더링 구성

- 스택: `three@^0.185` + `@react-three/fiber@^9.7`(React 19 호환) +
  `@react-three/drei@^10.7`. WebGL 우선(WebGPU 후순위).
- SSR 회피: `'use client'` + `next/dynamic({ ssr: false })` — 스타차트 라우트에만
  로드.
- 카메라: drei `CameraControls` — 성계↔행성 연속 비행(§2.1).
- 노드 수백 개: `<Instances>` 상태별 그룹 + instanceId 포인터 이벤트, `<Bvh>`
  레이캐스팅 가속. 라벨·HUD는 drei `Text`/`Billboard`/`Html`, 연결선은 `Line`.
- 행성 비주얼: **텍스처 구체 + 프레넬 대기 셸 + 행성별 색(tint) 오버라이드**,
  링은 토성 등 해당 행성만. 텍스처는 Solar System Scope(CC BY 4.0, 출처 표기
  필수). 구름 레이어·프로시저럴 재현은 v2.
- 데이터 로드: 정제 노드 데이터셋(120KB) 정적 임포트 — 471KB 원형으로도 문제
  없음이 검증됐다.

근거: [#24 렌더링 스택](https://github.com/b-wani/warframe-hub/issues/24) (`research/rendering-stack` 브랜치), [#31 행성 비주얼](https://github.com/b-wani/warframe-hub/issues/31) (`research/planet-visual-rendering` 브랜치), [#23 raw 슬라이스](https://github.com/b-wani/warframe-hub/issues/23), [#41 성계 뷰 골격](https://github.com/b-wani/warframe-hub/issues/41) (스택 도입·SSR 회피·행성 비주얼 구현 완료), [#42 행성 뷰와 연속 비행](https://github.com/b-wani/warframe-hub/issues/42) (CameraControls 연속 비행·Instances/Bvh·Line·Html 라벨 구현 완료)

## 8. 모바일 정책과 폴백 뷰

**모바일도 동일 3D — 별도 모바일 폴백 없음.** 동작 보장, 완성도 기준은 데스크톱.

v1 요구사항인 적응 규칙 4항목:

1. **종횡비 인지 카메라 프레이밍** — 세로 화면에서도 성계 전체·노드 구름이
   프레임 안에 들어오도록 카메라 거리 보정.
2. **호버 의존 금지** — 노드 정보 노출은 탭(=선택)으로.
3. **탭 타깃 최소 44px** — 노드 히트 영역은 시각 크기보다 크게.
4. **HUD 모바일 배치 규칙** — 좁은 폭(360–430px)에서 HUD 요소 겹침 금지.

**폴백 뷰**: WebGL 불가 시 자동 표시되는 텍스트 대체 화면(행성 아코디언 + 노드
체크리스트). 3D가 뜨는 환경에서도 수동 전환 가능(접근성·저사양 자구책).
진행도 확인·체크는 3D 없이도 성립해야 한다.

근거: [#34 모바일 정책](https://github.com/b-wani/warframe-hub/issues/34), [#41 성계 뷰 골격](https://github.com/b-wani/warframe-hub/issues/41) (적응 규칙 1 종횡비 인지 프레이밍 구현 완료 — 나머지 3항목은 [#51](https://github.com/b-wani/warframe-hub/issues/51)), [#45 폴백 뷰](https://github.com/b-wani/warframe-hub/issues/45) (WebGL 불가 시 자동 표시·수동 전환·행성 아코디언 체크리스트 구현 완료)

## 9. v1 범위 밖 (맵의 fog·out of scope 승계)

- 로그인 기반 서버 진행도 저장 — repository 경계로 전환 준비됨, UI 필요 시점에
  재방문.
- 침공·얼럿 등 추가 월드스테이트 오버레이.
- 행성 가이드 저작 워크플로·범위, 비노드 목표 행성별 확정 재선정, 큐레이션
  오버레이 32노드 저작 — 그릇(스키마·위치)은 확정, 저작은 스펙 이후 단계.
- 스틸패스 진행도 축, 프로시저럴 행성 재현(v2), 트랙 A 전체(스타차트 외
  대시보드 위젯 — career/ROADMAP.md 소관).

## 10. 수용 기준

구현이 v1 완료로 인정되려면:

1. 성계 뷰 → 행성 뷰 연속 비행 전환, 프록시마 ⚓ 토글, 릴레이 숨김이 동작한다.
2. 354노드가 정제 노드 데이터셋 기준으로 렌더되고, 3상태가 완료 집합 +
   그래프에서 파생돼 인게임 시각 규칙(§2.2)으로 표시된다.
3. 개별 체크·구간 일괄 체크·행성 전체 완료·진행도 가져오기·전체 초기화가
   §4~§5 규칙대로 동작한다.
4. 활성 균열이 노드 심볼 + 목록 탭으로 표시되고, 월드스테이트 장애 시에도
   지도는 온전하다.
5. 적응 규칙 4항목 충족 + **중급 안드로이드 실기기에서 카메라 비행이 체감상
   부드럽다**(스모크 테스트). 미달 시 품질 조정(별 개수·DPR 캡)으로 대응하며
   정책 재론 사유가 아니다.
6. 폴백 뷰가 WebGL 불가 환경에서 자동 표시되고 수동 전환도 가능하다.
7. Solar System Scope 텍스처 출처 표기(CC BY 4.0)가 페이지에 존재한다.
8. `/roadmap` 제거 — 2026-08-26 완료([ADR 0002](../adr/0002-starchart-is-the-only-progress-lens.md)).
