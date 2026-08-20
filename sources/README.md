# 출처 등록부

콘텐츠 소싱에 사용한 원천 자료의 등록부. 페이지 노출용 크레딧 데이터는
`src/data/sources.json`에 있으며, 이 문서는 운영 기록(수집 방법·라이선스·상태)을 담는다.

역할 구분: 이 문서는 **사용한 모든 출처**(노드가 직접 참조하지 않는 확인용 출처 포함)를
등록하고, `sources.json`에는 **노드가 참조하는 출처만** 넣는다. 출처를 추가·폐기할 때는
두 곳을 함께 갱신한다.

## 원칙 (스펙 #1 참조)

- 원문 문장 전재 금지 — 설명문은 전부 자체 집필·한국어 재서술
- 특정 출처 DB의 통째 이관 금지
- CC 라이선스 출처는 표기 조건 준수, 페이지에 출처 크레딧·원문 링크 표기
- 국내/해외 자료 충돌 시 최신 패치 기준(대개 해외 공식 위키) 우선 + 검수 큐 표시

## 해외 출처

| 출처 | URL | 수집일 | 상태 | 비고 |
| --- | --- | --- | --- | --- |
| 공식 위키 — Vor's Prize | https://wiki.warframe.com/w/Vor%27s_Prize | 2026-08-04 | alive | 퀘스트 사실 (wikitext 원문 수집) |
| 공식 위키 — The Teacher | https://wiki.warframe.com/w/The_Teacher | 2026-08-04 | alive | Update 40 신규 퀘스트 |
| 공식 위키 — Vox Solaris (Quest) | https://wiki.warframe.com/w/Vox_Solaris_(Quest) | 2026-08-04 | alive | |
| 공식 위키 — Once Awake | https://wiki.warframe.com/w/Once_Awake | 2026-08-04 | alive | |
| 공식 위키 — Heart of Deimos | https://wiki.warframe.com/w/Heart_of_Deimos | 2026-08-04 | alive | |
| 공식 위키 — The Archwing | https://wiki.warframe.com/w/The_Archwing | 2026-08-04 | alive | |
| 공식 위키 — Natah (Quest) | https://wiki.warframe.com/w/Natah_(Quest) | 2026-08-04 | alive | 해금 조건 서술 불일치 → 검수 큐 |
| 공식 위키 — The Second Dream | https://wiki.warframe.com/w/The_Second_Dream | 2026-08-04 | alive | |
| 공식 위키 — Junction (개요) | https://wiki.warframe.com/w/Junction | 2026-08-04 | alive | 정크션 리워크 공지 포함 (개별 페이지가 최신) |
| 공식 위키 — Venus~Neptune Junction (개별 7페이지) | https://wiki.warframe.com/w/Venus_Junction 외 | 2026-08-04 | alive | 과제·보상·위치는 개별 페이지 기준 |
| 공식 위키 — Rhino | https://wiki.warframe.com/w/Rhino | 2026-08-04 | alive | 부품 획득처·제작 시간 |
| 공식 위키 — Version/data | https://wiki.warframe.com/w/Module:Version/data | 2026-08-04 | alive | 기준 패치 확인 (Update 43.0, 핫픽스 43.0.8 / 2026-07-13) |
| 공식 위키 — Affinity | https://wiki.warframe.com/w/Affinity | 2026-08-20 | alive | 숙련도 분배 공식·스텔스 배율 교차 확인 |
| 공식 위키 — Sanctuary Onslaught | https://wiki.warframe.com/w/Sanctuary_Onslaught | 2026-08-20 | alive | 생맹 입장 조건·엘맹 어빌 쿨타임 교차 확인 |
| 공식 위키 — Amp | https://wiki.warframe.com/w/Amp | 2026-08-20 | alive | 앰프 해금·판매처·도금 교차 확인 |
| 공식 위키 — The Steel Path | https://wiki.warframe.com/w/The_Steel_Path | 2026-08-20 | alive | 해금 조건 완화·모디파이어 교차 확인 |
| 공식 위키 — Arbitrations | https://wiki.warframe.com/w/Arbitrations | 2026-08-20 | alive | U39(2025-06) 해금 완화 확인 |
| 공식 위키 — Specter (Tenno) | https://wiki.warframe.com/w/Specter_(Tenno) | 2026-08-20 | alive | 스펙터 등급·제작 수량 교차 확인 |
| 공식 위키 — Captura | https://wiki.warframe.com/w/Captura | 2026-08-20 | alive | 캡쳐라 진입·씬 획득처 교차 확인 |
| 공식 위키 — Text Icons | https://wiki.warframe.com/w/Text_Icons | 2026-08-20 | alive | 로드아웃 텍스트 아이콘 코드 교차 확인 |
| AlecaFrame (컴패니언 앱) | https://www.alecaframe.com/ | 2026-08-20 | alive | 커뮤니티 표준 도구 — 지식 노트 tools-external-sites 기재 |
| Mandascore (옥타비아 작곡기) | https://buff0000n.github.io/mandascore/ | 2026-08-20 | alive | 팬 제작 웹 도구 |
| 공식 위키 — Shield | https://wiki.warframe.com/w/Shield | 2026-08-20 | alive | 실드 게이팅 수치·독성 관통 교차 확인 |
| 공식 위키 — Damage | https://wiki.warframe.com/w/Damage | 2026-08-20 | alive | U36 팩션 상성표 교차 확인 |

라이선스: wiki.warframe.com 의 텍스트 콘텐츠는 CC BY-SA 4.0. 본 프로젝트는 사실만
추출해 자체 집필하므로 전재에 해당하지 않으나, 페이지에 출처 크레딧과 원문 링크를
표기한다 (`src/data/sources.json` → 로드맵 페이지 노출).

## 국내 출처

| 출처 | URL/파일 | 수집일 | 상태 | 비고 |
| --- | --- | --- | --- | --- |
| 오디스 코덱스 v3.5 (XLSX, 시트 15개) | 오디스 마이너 갤러리 공유 구글 시트 (운영자 제공 사본, 로컬 보관) | 2026-08-04 | alive | 갤러리 가이드 글 링크 색인 + 드랍·프라임·리벤 데이터. 하이퍼링크 1,141건. 파일 자체는 ADR-0001에 따라 커밋하지 않는다 (`sources/ordis-codex-v3.5/`, gitignore) |
| 오디스 마이너 갤러리 가이드 글 (개별) | https://gall.dcinside.com/mgallery/board/lists/?id=ordis | 2026-08-04~ | alive | 위 색인이 가리키는 글들. 지식 베이스(`knowledge/`, 로컬 전용) 구축에 사용, 개별 글 URL은 인용 시 지식 문서 frontmatter에 기록 |
| 워프레임 카테고리 정리 시트 (커뮤니티 구글 시트) | https://docs.google.com/spreadsheets/u/0/d/1RtVPsL__PUt_Q-fb4GHOmw5GI1r1BB8n-0zweqMZODs/htmlview | 2026-08-20 | alive | 오디스 코덱스가 참조하는 보조 시트. URL 등록만, 파일 미보관 |
| 유튜브 — 지구평원 워프레임 빠른랭작법 (마니아갤러리) | https://youtu.be/vQHLNCUoZJo | 2026-08-20 | alive | 지평 스텔스작 시연 영상. 갤러리 가이드(398205)가 인용. 텍스트 노트로 요지 반영 |
| 유튜브 — 마랭 9 시험 풀영상 (iexplore76) | https://www.youtube.com/watch?v=grLoj43rCNs | 2026-08-20 | alive | 갤러리 가이드(202085)가 인용한 시연 영상 |

## 수집 방법

- 위키는 MediaWiki raw(`index.php?title=…&action=raw`)로 wikitext 원문을 받아
  사실(순서·선행조건·과제·보상)만 추출했다. 원문 파일은 저장소에 커밋하지 않는다
  (DB 통째 이관 금지 원칙).
