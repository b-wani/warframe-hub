# Star Chart 노드 데이터 소스 조사 (Issue #22)

조사일: 2026-08-24. API 응답은 curl로 직접 확인함.

## 요약 권고

- **1차 소스: `warframe-public-export-plus`의 `ExportRegions.json`** — 노드별 행성/미션 타입/팩션/레벨 범위/마스터리에 더해 **노드 간 연결(`nextNodes`)까지 포함**하는 유일한 기계가독 소스.
- **보조 소스: warframestat.us `/solNodes`** (표시명 확인용) + **wiki.warframe.com** (2025 리워크 검증·수동 큐레이션 참조용).
- **좌표(지도 배치) 데이터는 어느 소스에도 없음** → 수작업 큐레이션 필요 (아래 전략 참조).

## 소스 비교

| 기준 | warframestat.us `/solNodes` | WFCD warframe-worldstate-data | calamity-inc warframe-public-export-plus (`ExportRegions.json`) | 공식 wiki (wiki.warframe.com) |
|---|---|---|---|---|
| 노드 수 | 452 (더미 "Ancient Retribution" 노드 다수 포함) | 452 (동일 파일 — API가 이 repo를 서빙) | 354 (실제 게임 데이터, 더미 적음) | 사실상 전체 (사람이 읽는 문서) |
| 필드 | `value`(이름+행성), `enemy`, `type` 뿐 | 동일 | 이름, systemIndex/Name, missionType, faction, min/maxEnemyLevel, masteryReq/Exp, tileset, questReq, darkSectorData 등 | 미션 타입·팩션·레벨·드랍 등 서술형 |
| 레벨 범위 | 없음 | 없음 | **있음** (`minEnemyLevel`/`maxEnemyLevel`) | 있음 (표) |
| 노드 연결 관계 | 없음 | 없음 | **있음** — `nextNodes` (354개 중 227개 노드에 존재, 방향 그래프) | Star Chart 문서에 경로 서술 |
| 좌표 | 없음 | 없음 | 없음 | 없음 (이미지뿐) |
| 2025 리워크(Techrot Encore 경로 개편) | 미션 타입은 갱신되나 경로 정보 자체가 없음 | 좌동 | 게임 클라이언트 export 기반 → `nextNodes`가 리워크 후 경로 반영 | 반영됨 (Star Chart 문서에 리워크 변경점 기술) |
| 라이선스 | (API) WFCD 데이터, MIT | MIT | repo 라이선스 없음; 내용물은 DE 게임 데이터(팬 콘텐츠 정책 적용) | CC-BY-SA (문서), 게임 데이터는 DE 소유 |
| 갱신 | worldstate-data 릴리스 따라감 | 활발 (last push 2026-08-22) | 게임 업데이트 시 갱신 (last push 2026-07-29, `senpai` 브랜치) | 커뮤니티가 패치 직후 갱신 |

## 응답 샘플

### warframestat.us `/solNodes` (https://api.warframestat.us/solNodes)

452개 키(`SolNode0`…), 값은 3필드뿐:

```json
"SolNode1": { "value": "Galatea (Neptune)", "enemy": "Corpus", "type": "Capture" }
```

`https://raw.githubusercontent.com/WFCD/warframe-worldstate-data/master/data/solNodes.json` 과 완전 동일(452개) — API는 이 데이터를 그대로 서빙. 지도 구축용으로는 정보가 너무 빈약.

### warframe-public-export-plus `ExportRegions.json`
(https://raw.githubusercontent.com/calamity-inc/warframe-public-export-plus/senpai/ExportRegions.json)

354개 키, 예시:

```json
"SolNode130": {
  "name": "/Lotus/Language/Locations/Lares",
  "systemIndex": 0,
  "systemName": "/Lotus/Language/Locations/Mercury",
  "missionType": "MT_DEFENSE",
  "faction": "FC_INFESTATION",
  "minEnemyLevel": 6, "maxEnemyLevel": 11,
  "masteryReq": 0, "masteryExp": 3,
  "tileset": "GrineerAsteroidTileset",
  "nextNodes": []
}
```

- 이름은 `/Lotus/Language/...` 키 → 동봉된 `dict_en.json`(또는 `dict_ko.json`)으로 로컬라이즈. 한국어 지원 가능.
- `nextNodes` 예: `SolNode119.nextNodes = ["SolNode12"]`. 227개 노드에 존재, junction·경로 그래프 구성 가능.
- 전체 필드: cacheRewardManifest, challenges, darkSectorData, enemySpec, faction, hidden, levelOverride, masteryExp/Req, min/maxEnemyLevel, missionName/Reward/Type, name, nextNodes, nodeType, questReq(s), rewardManifests, secondaryFaction, systemIndex/Name, tileset, vipAgent 등.
- 공식 DE Public Export(content.warframe.com/PublicExport, LZMA 압축)의 `ExportRegions`에는 `nextNodes`가 없음 — export-plus가 클라이언트에서 추가 추출한 확장판 ("Contains everything missing in Public Export and more", https://github.com/calamity-inc/warframe-public-export-plus).

## 2025 스타차트 리워크

Techrot Encore(2025.3)에서 junction 요구 노드 축소·경로 단순화(Earth→Mercury 4→3노드, Earth→Deimos 6→3노드 등), 노드 hover UI 개편. 출처: https://wiki.warframe.com/w/Star_Chart , https://wiki.warframe.com/w/Junction . 텍스트 소스 중 이를 구조적으로 반영하는 것은 export-plus의 `nextNodes`뿐.

## 좌표·연결선 확보 전략

1. **연결선**: `nextNodes`로 해결 — 수작업 불필요.
2. **좌표**: 어떤 공개 데이터셋에도 없음(게임 내 3D 배치는 클라이언트 에셋에 있으나 export되지 않음).
   - 권장: **행성 단위 자동 배치 + 행성 내 수작업/알고리즘 배치.** 행성은 약 20개(systemIndex), 노드는 실사용 기준 약 230~260개. 노드당 (x, y) 한 쌍 큐레이션 시 1인 반나절~1일 규모. 게임 스크린샷을 트레이싱해 JSON(`{node: [x, y]}`)으로 저장.
   - 대안: 연결 그래프 기반 force-directed 레이아웃으로 초기 배치 후 수동 미세조정 — 큐레이션 비용 추가 절감.
   - 게임 클라이언트 추출: 커뮤니티 언패커가 있으나 좌표 노출 사례 없음 + ToS 리스크. 비권장.

## 출처

- https://api.warframestat.us/solNodes (curl 확인, 452 nodes)
- https://github.com/WFCD/warframe-worldstate-data (MIT, push 2026-08-22)
- https://github.com/WFCD/warframe-items (MIT — 아이템 중심, 노드 지도용 정보 없음)
- https://github.com/calamity-inc/warframe-public-export-plus (`senpai` 브랜치, push 2026-07-29, curl 확인 354 nodes)
- https://wiki.warframe.com/w/Star_Chart , https://wiki.warframe.com/w/Junction , https://wiki.warframe.com/w/Public_Export
