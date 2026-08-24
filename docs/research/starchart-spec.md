# Warframe Star Chart 스펙 리서치 (2025 리워크 기준)

웹 재현(warframe-hub)용 시각·인터랙션 요구사항 목록. 조사일: 2026-08-24.
주요 출처: 공식 위키 [Star Chart](https://wiki.warframe.com/w/Star_Chart), [Junction](https://wiki.warframe.com/w/Junction), [Void Fissure](https://wiki.warframe.com/w/Void_Fissure), 공식 [패치노트](https://www.warframe.com/en/patch-notes).

## 1. 화면 구성 (성계 뷰 ↔ 행성 뷰)

- [ ] **2단계 계층 줌**: 최상위는 태양계 전체를 보여주는 성계 뷰. 천체를 클릭하거나 줌인하면 해당 행성의 노드 그래프(행성 뷰)로 전환된다. 위키: "When zooming in or clicking on a celestial body, the player sees how they are linked through Solar Rail Junctions, beginning with Earth, and can select individual mission nodes to play." — https://wiki.warframe.com/w/Star_Chart
- [ ] **행성 배치는 실제 천문학적 순서**: 수성–금성–지구–화성–(소행성대/세레스)–목성… 순으로 바깥으로 배열. 소행성대는 세레스 옆에 배치됨(패치노트 인용: "Moved asteroid belt in the Star Chart to be beside Ceres"). — https://wiki.warframe.com/w/Star_Chart
- [ ] **카메라 전환은 시네마틱**: 성계↔행성 전환 시 부드러운 줌/이동 애니메이션. 행성 선택 시 캐릭터(오퍼레이터/드리프터)가 행성을 가리키는 연출 존재(웹 재현에서는 트랜지션 애니메이션으로 대체 가능). — https://wiki.warframe.com/w/Star_Chart
- [ ] **행성 뷰**: 행성 구체 주위/표면 위에 미션 노드들이 점으로 흩어져 있고, 노드 간 경로가 선으로 연결된 그래프 형태.

## 2. 노드 표현

- [ ] **상태별 노드 스타일** (위키 명시):
  - 잠김(선행 미완료): 검은 자물쇠 심볼 + 점선 연결선
  - 미클리어(플레이 가능): 파란 마름모(rhombus) + 흰 연결선
  - 클리어(반복 가능): 흰 마름모 + 흰 연결선
  — https://wiki.warframe.com/w/Star_Chart
- [ ] **호버 시 미리보기**: 노드에 호버하면 타일셋/적 이미지와 게임모드 아이콘이 표시됨(Update 28.0에서 도입: "Hovering over a Node will display a new tileset/accompanying enemy image and gamemode icons"). 툴팁에 노드명·미션 타입·팩션·레벨 범위 표기. — https://wiki.warframe.com/w/Star_Chart
- [ ] **특수 미션 심볼 오버레이**: 퀘스트(퀘스트 심볼), 보스(왕관 쓴 눈), 다크 섹터(클랜 로고), 보이드 균열(불꽃/Void Tear 심볼), 나이트메어(빨간 마름모 속 흰 소용돌이), 소티(깃발 속 다이아 4개), 신디케이트(각 신디케이트 심볼) 등 노드 위에 겹쳐 표시. — https://wiki.warframe.com/w/Star_Chart
- [ ] **Junction**: 행성 간 Solar Rail 경로 상의 특수 노드. 과제 진행도(예: 0/4 ~ 4/4)를 노드에 표기, 과제 완료 후 입장해 스펙터를 격파하면 다음 천체 잠금 해제("Defeating the Junction's Specter grants control of the connected Solar Rail, which unlocks the next celestial body"). — https://wiki.warframe.com/w/Junction
- [ ] **행성 단위 완료 표시**: 노드 전부 클리어 시 성계 뷰의 행성 위에 완료 아이콘 표시. 일반 경로와 Steel Path는 별도 아이콘으로 추적(Update 36.0). — https://wiki.warframe.com/w/Star_Chart
- [ ] **Adversary 오버레이**: Kuva Lich/Sister가 노드를 점령 중이면 성계 뷰의 행성이 빨강/파랑 핏방울로 둘러싸임. — https://wiki.warframe.com/w/Star_Chart

## 3. 인터랙션 흐름

- [ ] 성계 뷰에서 행성 호버 → 이름/완료 상태 하이라이트 → 클릭으로 행성 뷰 진입.
- [ ] 행성 뷰에서 노드 호버 → 미리보기 패널, 노드 클릭 → 미션 상세(모드가 여러 개면 "a selector...for you to choose your game mode" 선택 UI) → 입장 버튼.
- [ ] **Navigation 내 로드아웃 변경**(Update 36.0, 2024-06): 미션 입장 전 화면에서 워프레임/무기/컴패니언 교체 가능. 팩션별 추천 데미지(Vulnerabilities/Resistances)도 표기. — https://wiki.warframe.com/w/Star_Chart
- [ ] Update 37.0(2024-10): "Open Squads" 카운터 제거(UI 정리), 저모딩 장비 경고 추가. — https://wiki.warframe.com/w/Star_Chart

## 4. 실시간 오버레이 (균열·침공 등)

- [ ] **Void Fissure**: 일반 노드 위에 Void Tear(불꽃) 심볼로 표기. 티어는 Lith/Meso/Neo/Axi/Requiem/Omnia, 티어별 1~2개 미션이 상시 로테이션. Navigation에 전용 "Void Fissure 탭"(활성 균열 목록 패널) 존재. Steel Path 균열은 별도 플레어. — https://wiki.warframe.com/w/Void_Fissure
- [ ] **침공(Invasion)**: 해당 노드에 침공 전용 아이콘 오버레이 + 진영 진행도 바, 성계 뷰 행성에도 표시. — https://wiki.warframe.com/w/Star_Chart
- [ ] 나이트메어/쿠바 사이펀·플러드/소티/아비트레이션 등도 각각 전용 아이콘으로 동시 레이어링. — https://wiki.warframe.com/w/Star_Chart
- [ ] 웹 재현 요구: worldstate 기반 실시간 데이터로 노드 심볼을 동적으로 덧씌우는 오버레이 레이어 필요.

## 5. 2025 리워크에서 바뀐 것 (구 자료와 구분)

2025년의 변화는 **비주얼 전면 개편이 아니라 진행 경로(노드 패스) 리워크**임. 큰 비주얼 개편(현행 3D 성계 뷰, Star Chart 3.0)은 2016년 Specters of the Rail에서 이루어졌고, 구 자료(Star Chart 1.0/2.0의 격자형 지도)는 참고 금지. — https://wiki.warframe.com/w/Star_Chart_1.0

**Update 38.5 (2025-03-19) 신규 유저 경험 리워크**:
- 지구·금성·화성 노드 경로 리워크: The Second Dream 도달 단축이 목적.
- 지구→금성→수성 경로 4노드→3노드 (Kiliken, Aphrodite를 주경로에서 제외, Fossa 추가).
- 지구→화성→데이모스 경로 6노드→3노드 (Hellas, Spear, Martialias, Kadesh 제외, Augustus 추가).
- 목성-토성 Junction 요구조건: "Raptor(유로파) 격파" → "Baal(유로파) 완료"로 교체.
- 스타차트/로딩 화면에 새 퍼커션 음악 추가.
— 출처: https://www.warframe.com/en/patch-notes , https://wiki.warframe.com/w/Star_Chart

주의: 커뮤니티 팬 리워크 제안(포럼 글)과 실제 패치를 혼동하지 말 것. 2025년 이후에도 UI 미세 조정은 계속되나(Update 40 등은 스타차트 자체 개편 아님) 위 구조가 현행 스펙.
