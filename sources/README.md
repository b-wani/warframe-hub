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

라이선스: wiki.warframe.com 의 텍스트 콘텐츠는 CC BY-SA 4.0. 본 프로젝트는 사실만
추출해 자체 집필하므로 전재에 해당하지 않으나, 페이지에 출처 크레딧과 원문 링크를
표기한다 (`src/data/sources.json` → 로드맵 페이지 노출).

## 국내 출처

| 출처 | URL/파일 | 수집일 | 상태 | 비고 |
| --- | --- | --- | --- | --- |
| 오디스 코덱스 v3.5 (TSV 7탭) | **미확보** | — | missing | 이슈 #4가 전제한 원천 파일이 저장소에 없음. 공개 웹에서도 미발견. 운영자가 `sources/ordis-codex-v3.5/`에 TSV로 넣어 주면 교차 검증 2차를 진행한다 |

## 수집 방법

- 위키는 MediaWiki raw(`index.php?title=…&action=raw`)로 wikitext 원문을 받아
  사실(순서·선행조건·과제·보상)만 추출했다. 원문 파일은 저장소에 커밋하지 않는다
  (DB 통째 이관 금지 원칙).
