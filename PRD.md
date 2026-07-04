Rudy — Product Requirements Document
Version 0.9 (Draft for Engineering & Design Kickoff)
시작하기 전에, PM으로서 원문 기획에 대한 비판적 검토 결과를 먼저 공유합니다. 이 판단들이 아래 PRD 전체의 설계 결정에 반영되어 있습니다.
비판적 검토 요약

콜드 스타트가 이 제품 최대의 리스크입니다. Rudy의 가치는 "나를 아는 AI"인데, 설치 첫날 Rudy는 사용자를 전혀 모릅니다. Home이 비어 있거나 뻔한 추천을 하는 순간 제품 철학("오늘도 뭔가 준비해놨네")이 첫 경험에서 붕괴합니다. 온보딩과 Day 0~7 경험을 별도 설계 대상으로 승격했습니다.
카드 종류 7개는 과합니다. Today's Pick, Rediscovery, New Discovery, Recommendation, Interest Context, Insight, Surprise — 사용자 관점에서 이 중 4개는 구분이 안 됩니다. MVP는 카드 3종으로 시작하고, 카드 타입이 아니라 "카드를 고르는 이유(reason)"를 다양화하는 방식을 제안합니다.
채팅은 MVP에서 제외를 제안합니다. "채팅은 보조 기능"이라는 원칙을 가장 확실히 지키는 방법은 MVP에 채팅을 넣지 않는 것입니다. 대신 카드 단위의 가벼운 인터랙션(왜 이걸 추천했어? / 이런 건 그만 보여줘)만 제공합니다.
"평가하지 않는다" 원칙은 UX 문구 규칙으로 구체화해야 합니다. "3개월 전에 저장하고 아직 안 봤어요" 같은 문장은 기술적으로 사실이지만 사용자를 평가하는 문장입니다. 카피 가이드라인을 기능 요구사항에 포함했습니다.
Home의 성공 지표는 체류 시간이 아니라 '탈출률'입니다. 사용자를 밖으로 보내는 제품이므로, 카드 탭 → 외부 앱 이동이 북극성 지표가 되어야 합니다. 이는 일반적인 리텐션 최적화와 정면으로 충돌하므로 지표 체계를 명시했습니다.


1. Product Summary
1.1 제품 정의
Rudy는 사용자가 흩어진 곳에 저장해둔 것들(링크, 영상, 장소, 아이디어, 메모)을 이해하고, 매일 아침 그중 오늘 가장 의미 있는 것을 골라 먼저 건네주는 Personal AI Curator입니다.
한 문장 정의: "저장은 어디서든, 재발견은 Rudy에서."
1.2 해결하는 문제

사람들은 하루 평균 수 개의 콘텐츠를 저장하지만, 저장물의 대다수는 다시 열리지 않습니다. Watch Later는 무덤이 되고, 북마크는 죄책감의 목록이 됩니다.
기존 도구(북마크 매니저, Read-it-later, Second Brain)는 모두 저장과 정리를 해결합니다. 그러나 진짜 병목은 정리가 아니라 재발견의 타이밍입니다. 사용자는 "언제 이걸 다시 봐야 할지"를 스스로 판단할 수 없고, 판단하려는 노력 자체가 부담입니다.
검색 기반 도구는 "무엇을 찾을지 아는 사용자"만 돕습니다. 저장물의 가치 대부분은 사용자가 잊어버린 것들에 있습니다.

1.3 핵심 가치
가치설명Proactive사용자가 묻기 전에 AI가 먼저 준비한다Contextual오늘의 요일, 계절, 최근 관심사 변화에 맞는 것을 고른다Zero-guilt밀린 목록, 미완료 카운트, 독촉이 없다Outbound사용자를 붙잡지 않고 원래 앱으로 보낸다
1.4 차별점

vs. Pocket/Raindrop/Matter: 이들은 "저장함"이고 재발견은 사용자의 몫. Rudy는 재발견이 제품 그 자체.
vs. Notion/Obsidian (Second Brain): 이들은 정리 노동을 요구. Rudy는 정리를 요구하지 않음 — AI가 이해하므로 폴더/태그 관리가 불필요.
vs. ChatGPT/AI 챗 앱: 챗은 pull(사용자가 질문). Rudy는 push(AI가 먼저 제안). 빈 입력창이 아니라 완성된 브리핑으로 시작.
vs. 뉴스 피드/추천 피드: 피드는 외부 콘텐츠로 체류 시간을 극대화. Rudy는 사용자 자신의 과거 선택을 재료로 하고, 2분 안에 내보내는 것이 목표.


2. Product Principles
설계·개발 중 의사결정이 충돌할 때 아래 순서로 판단합니다.

Home-first. 모든 기능은 "다음 Home을 더 좋게 만드는가"로 평가한다. 그렇지 않은 기능은 만들지 않는다.
AI가 먼저 말을 건다. 빈 화면, 빈 입력창, "무엇을 도와드릴까요?"를 절대 보여주지 않는다.
저장물은 자산이지 부채가 아니다. 미확인 카운트, 밀린 목록, "N일째 안 읽음" 표현 금지. Rudy는 사용자를 평가하지 않는다.
2분 안에 내보낸다. Home의 성공은 체류가 아니라 이탈(원래 앱으로의 이동)이다. 무한 스크롤, 자동재생, 추가 피드 로딩 금지.
정리 노동 제로. 사용자에게 폴더, 태그, 분류를 요구하지 않는다. 이해는 AI의 일이다.
최소 입력, 최대 이해. 새 입력 채널을 추가하기 전에 기존 입력에서 더 깊이 이해할 방법을 먼저 찾는다.
설명 가능한 큐레이션. 모든 카드에는 "왜 오늘 이것인가"라는 이유가 붙는다. 이유 없는 추천은 피드이고, 이유 있는 추천이 큐레이션이다.
매일 새로 태어난다. 어제의 Home은 오늘 사라진다. 아카이브를 뒤지는 UX를 만들지 않는다 (Library는 예외적 보조 공간).
채팅은 카드에 종속된다. 독립된 챗 화면을 제품의 중심에 두지 않는다.


3. User Personas
P1. 콘텐츠 수집가 — "지호" (28, 프로덕트 디자이너) — Primary

YouTube Watch Later 400개, Safari 읽기 목록 200개, 인스타 저장 다수.
저장하는 순간의 설렘은 있지만 다시 보는 시스템이 없음. 정리 앱을 3번 시도했다가 모두 포기.
니즈: "정리 안 해도 되고, 알아서 좋은 타이밍에 다시 보여줬으면."
Rudy 사용 패턴: 출근길 지하철에서 90초 확인 → YouTube/브라우저로 이동.

P2. 아이디어 메모광 — "수민" (34, 스타트업 마케터) — Primary

사업 아이디어, 가고 싶은 여행지, 사고 싶은 것들을 메모 앱 여기저기에 흩어놓음.
니즈: "몇 달 전의 내 생각이 지금의 나와 다시 만났으면."
Rudy 사용 패턴: Quick Capture 헤비 유저. Rediscovery 카드에 가장 강하게 반응.

P3. 라이프 플래너 — "민준" (41, 직장인) — Secondary

가고 싶은 식당, 여행지, 사고 싶은 물건 위주로 저장(장소·위시리스트 중심).
니즈: "주말이 되면, 근처에 가면, 세일하면 알려줬으면."
MVP에서는 부분적으로만 충족 (위치·가격 트리거는 v2).

Anti-persona: 팀 협업/지식관리 목적 사용자, 챗봇 파워유저. 이들을 위해 기능을 추가하지 않습니다.

4. User Journey
J1. 첫 만남 (Day 0) — 콜드 스타트 해결이 핵심

온보딩에서 관심사 5~7개 선택 (자유 입력 병행).
"첫 기억 3개를 심어주세요": 공유시트 사용법을 가르치며 실제 저장 3건 유도. (튜토리얼이 아니라 실제 데이터 수집)
저장 즉시 AI가 분석 → 그 자리에서 첫 Home을 생성해 보여줌. "내일 아침엔 더 잘 준비해둘게요."


Day 0 Home 구성: 방금 저장한 것 1개에 대한 이해 카드 + 관심사 기반 New Discovery 2개. 재발견은 아직 불가능하므로 발견으로 보완.

J2. 아침 루틴 (Day 30, 정착 사용자)

8:10 AM 알림: "오늘의 Home이 준비됐어요 — 3개월 전 아이슬란드 메모, 지금 다시 볼 이유가 생겼어요."
앱 열기 → 카드 4장 스캔 (약 60초).
Rediscovery 카드 탭 → 저장 당시 메모와 AI의 "지금 다시 보는 이유" 확인 → "YouTube에서 보기" 탭 → 외부 이동.
세션 종료. 총 체류 90초.

J3. 저장 순간 (하루 중 수시)

YouTube에서 영상 시청 중 → Share → Rudy.
시트가 1초간 뜨며 "기억했어요" + AI가 이해한 한 줄 요약. (선택) 한 줄 메모 추가.
사용자는 YouTube로 즉시 복귀. 총 소요 3초.

J4. 생각 포착

걷다가 아이디어 → 위젯/앱 아이콘 롱프레스 → Quick Capture.
"회사 근처에 브런치 카페 차리면 어떨까" 입력 → 저장.
2주 뒤 Home: "2주 전 브런치 카페 아이디어 — 비슷한 관심사의 저장물 2개와 연결됐어요."

J5. 재발견의 순간 (제품의 마법)

사용자가 최근 "베이킹" 영상을 3개 저장 → AI가 관심사 상승 감지 → 8개월 전 저장했던 "사워도우 만들기" 북마크를 Rediscovery로 부상.
카드 문구: "요즘 베이킹에 빠지셨네요. 8개월 전의 지호님이 미리 저장해둔 게 있어요."
핵심 감정: 과거의 내가 지금의 나에게 보낸 선물.

J6. 이탈 방어 (Day 3~7, 위험 구간)

저장이 3일간 없으면: Home을 New Discovery 중심으로 채우되, "저장 좀 하세요" 류의 독촉 금지.
대신 카드 하단에 부드러운 힌트 1회: "YouTube에서 공유하면 Rudy가 기억해둘게요."


5. Information Architecture
Rudy
├── Home (기본 진입 화면, 제품의 중심)
│    └── Card Detail (카드 확장 뷰)
├── Capture (+ 버튼 / 위젯 / Share Extension)
│    ├── Quick Capture (텍스트)
│    └── Share to Rudy (시스템 공유시트)
├── Library (보조 공간)
│    ├── All Memories (시간순)
│    ├── Interests (AI가 만든 관심사 클러스터)
│    └── Search
└── Settings
     ├── 알림 시간
     ├── 관심사 관리
     ├── 연동 (post-MVP)
     └── 데이터/프라이버시
구조 원칙

탭은 3개를 넘지 않음: Home / + / Library. (Settings는 프로필 아이콘)
Home이 항상 첫 화면. 마지막 화면 복원 없음 — 앱을 열면 무조건 오늘의 Home.
Library는 의도적으로 한 단계 깊이 배치. "찾으러 가는" 예외적 행동을 위한 공간이지 메인 동선이 아님.
챗 탭 없음 (원칙 9).


6. Screen Flow
S1. Home

목적: 오늘 나에게 가장 가치 있는 3~5개를 30초~2분 안에 전달하고 외부로 내보낸다.
기능: 인사 헤더, 카드 스택(3~5장), 카드별 액션.
사용자 행동: 스크롤, 카드 탭(→상세), 외부 링크 탭(→앱 이탈), 카드 피드백(좋아요/그만 보기), 당겨서 새로고침 없음(하루 1회 생성 원칙).
필요 데이터: 오늘의 DailyBrief(카드 배열, 각 카드의 memory 참조·이유·액션), 사용자 이름, 날짜.

S2. Card Detail

목적: 카드 하나에 대한 맥락 제공 — "무엇인지 + 왜 오늘인지 + 어디로 갈지".
기능: AI 요약, 저장 당시 내 메모, 저장일, 연결된 다른 Memory 2~3개, 큐레이션 이유 전문, 외부 열기 버튼(주 CTA), 피드백 버튼.
필요 데이터: Memory 상세, 연결 Memory 목록, curation_reason.

S3. Share Extension (시스템 공유시트)

목적: 3초 안에 저장 완료, 원래 앱으로 복귀.
기능: URL/이미지/텍스트 수신, 즉시 저장 확인("기억했어요"), 선택적 한 줄 메모 필드, AI 분석은 백그라운드 비동기.
필요 데이터: 공유 payload, 인증 토큰.
제약: 네트워크 실패 시 로컬 큐잉 후 재시도. 저장 실패를 사용자가 겪게 하지 않는다.

S4. Quick Capture

목적: 생각을 5초 안에 붙잡는다.
기능: 전체화면 텍스트 입력(키보드 즉시 활성), 음성 입력(STT), 저장 버튼. 분류/태그 UI 없음.
필요 데이터: 텍스트, 타임스탬프, (선택) 위치.

S5. Library — All Memories

목적: "그때 저장한 그거 어딨지?"에 대한 안전망.
기능: 시간 역순 리스트(썸네일+제목+AI 한줄요약), 무한 스크롤(여기는 허용), Memory 탭 → Card Detail 재사용.
필요 데이터: Memory 페이지네이션 목록.

S6. Library — Interests

목적: "Rudy가 나를 어떻게 이해하는지" 투명하게 보여줌 → 신뢰 형성.
기능: AI 생성 관심사 클러스터 카드(예: "베이킹 · 12개 기억 · 최근 상승 ↑"), 클러스터 탭 → 해당 Memory 목록, 관심사 숨기기/삭제.
필요 데이터: Interest 목록(이름, memory count, 추세), 클러스터별 Memory.

S7. Search

목적: 의미 기반 검색. "그 파스타 영상"으로 찾아짐.
기능: 자연어 검색(시맨틱), 결과는 Memory 리스트.
필요 데이터: 검색 쿼리 → 벡터 검색 결과.

S8. Onboarding (3단계)

가치 제안 1장 ("저장은 어디서든, 재발견은 Rudy에서")
관심사 선택 (5~7개, 스킵 가능)
첫 기억 심기 (공유시트 가이드 + 실제 저장 3건, 최소 1건 필수) → 첫 Home 즉시 생성

S9. Settings

알림 시간 설정(기본 8:00), 관심사 관리, 계정, 데이터 내보내기/삭제, (post-MVP) 외부 연동.


7. Home Experience (핵심 설계)
7.1 목적
Home은 "오늘 Rudy가 나를 위해 준비한 것"입니다. 피드도 대시보드도 아닌, 매일 아침 발행되는 나만을 위한 1페이지 브리핑입니다. 성공 기준은 사용자가 (1) 열고, (2) 하나 이상에 반응하고, (3) 2분 안에 떠나는 것입니다.
7.2 UX 구조
┌─────────────────────────────┐
│  좋은 아침이에요, 지호님        │  ← 인사 헤더 (날짜, 톤은 담백하게)
│  7월 3일 금요일               │
├─────────────────────────────┤
│  ★ HERO CARD                │  ← 오늘의 단 하나 (대형 카드)
│  [썸네일]                    │
│  "8개월 전 저장한 사워도우 —   │
│   요즘 베이킹에 빠진 지금이     │
│   딱 좋은 타이밍이에요"        │
│  [ YouTube에서 보기 → ]      │
├─────────────────────────────┤
│  SUPPORT CARD 1 (중형)       │  ← 재발견 or 발견
├─────────────────────────────┤
│  SUPPORT CARD 2 (중형)       │
├─────────────────────────────┤
│  SUPPORT CARD 3 (중형, 선택)  │
├─────────────────────────────┤
│  CLOSING LINE                │  ← "오늘은 여기까지예요.
│                              │     내일 또 준비해둘게요."
└─────────────────────────────┘
명시적 끝이 있는 화면. Closing line은 이 제품의 반(反)피드 철학을 UI로 선언하는 장치입니다. 더 불러올 것이 없고, 그것이 의도임을 사용자가 느끼게 합니다.
7.3 카드 구조 — 타입은 3개, 이유는 무한대
원안의 7개 요소를 3개 카드 타입 × 다양한 curation reason으로 재구성합니다. 사용자에게 중요한 것은 카드의 분류가 아니라 "왜 오늘 이것인가"이기 때문입니다.
카드 타입재료원안 요소 흡수Rediscovery사용자의 기존 MemoryRediscovered Memories, Today's Pick, SurpriseDiscovery외부 신규 콘텐츠 (관심사 기반)New Discovery, Personalized RecommendationReflection사용자 데이터에 대한 가벼운 관찰Interest Context, Light Personal Insight
모든 카드의 공통 구조:
Card {
  hero_visual      // 썸네일/아이콘
  title            // 콘텐츠 제목 또는 캡처 요약
  curation_reason  // "왜 오늘" — 1~2문장, 카드의 영혼
  primary_action   // 외부 열기 (deep link) 또는 상세 보기
  feedback         // 👍 좋아요 / ✕ 오늘은 아니야 / ⋯ 이런 건 그만
}
curation_reason 예시 (이것이 카드 타입 대신 다양성을 만듭니다):

시의성: "주말이에요. 3주 전 저장한 북한산 코스, 이번 주말 어때요?"
관심사 상승: "요즘 베이킹 저장이 늘었어요. 예전에 담아둔 이것도 연결돼요."
숙성: "이 아이디어를 적은 지 한 달 됐어요. 지금 보면 다르게 보일 수도."
연결 발견: "어제 저장한 영상, 작년에 저장한 이 글과 같은 주제예요."
순수 서프라이즈: "오늘은 이유 없이 이걸 골랐어요. 1년 전의 지호님이 좋아했던 거예요." (Surprise는 별도 카드가 아니라 reason의 한 종류)

7.4 우선순위 및 구성 규칙

카드 수: 3~5장 고정. 데이터가 많아도 5장 초과 금지 (큐레이션 = 버리는 것).
Hero 1장은 항상 Rediscovery 우선. 재발견이 이 제품의 차별점이므로 가장 좋은 자리를 준다. 적합한 재발견이 없을 때만 Discovery가 Hero.
구성 비율 가이드: Rediscovery ≥ 50%, Discovery ≤ 40%, Reflection ≤ 1장(매일 아님 — 주 2~3회).
동일 Memory는 재부상 후 21일 쿨다운. 동일 관심사 카드가 하루 2장을 넘지 않음.
사용자가 "오늘은 아니야"를 누른 Memory는 14일 쿨다운, "그만"은 영구 제외 + 유사물 감점.

7.5 생성 로직 (Daily Brief Pipeline)
매일 새벽 사용자별 배치 실행 (사용자 알림 시간 − 2h):
1. Candidate Pool 수집
   - Resurface 후보: 스코어링 (7.6)
   - Discovery 후보: 상위 관심사 기반 외부 콘텐츠 검색 (MVP: 제한된 소스)
   - Reflection 후보: 관심사 추세 변화 감지 시에만

2. Scoring & Ranking
   각 후보에 대해:
   score = w1·relevance(현재 관심사와의 유사도)
         + w2·timing(요일/계절/이벤트 적합성)
         + w3·maturity(저장 후 경과 시간의 적정성)
         + w4·novelty(최근 노출 이력 페널티)
         + w5·feedback(과거 유사 카드 반응)

3. Composition (제약 충족 선택)
   - 3~5장 선택, 비율·중복 규칙 적용
   - 다양성 보장: 관심사/포맷(영상·글·장소·아이디어) 분산

4. Reason Generation (LLM)
   - 선택된 각 카드에 대해 curation_reason 생성
   - 입력: memory 요약, 저장 시 메모, 선택 근거(score 요소), 오늘 날짜/요일
   - 톤 가이드 적용 (7.7)

5. 저장 & 푸시
   - DailyBrief 레코드 생성 → 알림 발송
   - 생성 실패 시 fallback: 최근 저장물 시간순 3장 + 정적 인사 (Home이 비는 일은 절대 없음)

하루 1회 생성이 원칙. 단, 당일 저장이 5건 이상 쌓이면 다음날 브리핑에 "어제 많이 저장하셨네요" 맥락 반영.
사용자가 낮에 다시 열면 같은 Home 유지 (새로고침 없음 — 희소성이 가치).

7.6 사용자 행동과 피드백 루프
행동시그널 강도학습 반영외부 링크 탭 (이탈)최강 양성해당 관심사·reason 유형 가중 ↑카드 상세 열람중간 양성완만한 가중 ↑👍명시적 양성즉시 반영스크롤 통과 (무반응)약한 음성누적 시에만 반영✕ 오늘은 아니야중간 음성해당 Memory 쿨다운⋯ 그만 보여줘강한 음성Memory 제외 + 유사물 감점
7.7 카피 톤 가이드 (원칙 3 "평가하지 않는다"의 구현)
금지 표현: "아직 안 봤어요", "N개가 밀려있어요", "잊고 계셨죠?", "이번엔 꼭", 미확인 뱃지·카운트 전부.
권장 프레임: 과거의 저장을 항상 선물/자산으로 표현. "그때의 당신이 남겨둔 것", "지금 보면 좋을 타이밍". 명령형 대신 제안형("~어때요?"). 이모지·과장 최소화, 담백하고 따뜻한 존댓말.

8. Memory System (핵심 설계)
8.1 Memory의 정의
Memory = 사용자가 남긴 하나의 흔적 + AI의 이해. 원본을 호스팅하지 않고 참조 + 이해 레이어만 보유합니다 (원본은 기존 서비스에 존재 — 제품 철학과 일치하며 저작권·저장 비용 리스크도 회피).
8.2 Memory 종류
타입소스예linkShare ExtensionYouTube 영상, 아티클, 상품 페이지place지도 앱 공유식당, 여행지thoughtQuick Capture아이디어, 하고 싶은 것image공유시트 (스크린샷 등)인스타 캡처, 사진note앱 내 작성Daily note (post-MVP)
각 Memory에 AI가 부여하는 이해 레이어:
understanding {
  summary            // 한 줄 요약 (사용자에게 노출)
  content_type       // video / article / product / place / idea ...
  topics[]           // 정규화된 주제 태그
  inferred_intent    // 왜 저장했는가 추론: learn / do / go / buy / remember / inspire
  time_sensitivity   // evergreen / seasonal / dated / event-bound
  best_resurface_ctx // 언제 다시 보이면 좋은가: weekend / evening / when-topic-rises ...
  embedding          // 벡터 (연결·검색용)
}
inferred_intent가 재부상 로직의 핵심 입력입니다. "가고 싶은 곳(go)"은 주말 전에, "배우고 싶은 것(learn)"은 관심사 상승기에, "사고 싶은 것(buy)"은 숙성 후에 다시 보여주는 식으로 intent별 전략이 달라집니다.
8.3 단기 기억 vs 장기 기억

단기 기억 (Working Context, 최근 14일): 최근 저장물, 최근 카드 반응, 최근 관심사 변화. Home 생성 시 "지금의 사용자"를 대표. 원본 데이터는 삭제되지 않고 가중치만 시간 감쇠.
장기 기억 (User Model): 누적된 관심사 프로필, 안정적 취향(포맷 선호: 영상형/글형), 행동 패턴(주말에 장소 카드 반응↑ 등), 명시적 선호(온보딩 선택, 그만 보기 이력). 주 1회 배치로 재계산.

8.4 관심사 계산 (Interest Graph)

관심사는 사용자가 만드는 태그가 아니라 Memory 임베딩의 클러스터링 결과입니다. AI가 클러스터에 이름을 붙입니다("홈 베이킹", "북유럽 여행").
각 Interest의 상태:

Interest {
  name, memory_count
  strength        // 0~1, 시간 감쇠 적용된 누적 시그널
  momentum        // 최근 14일 변화율 → "요즘 빠진 것" 감지
  last_engaged_at
  status          // rising / stable / dormant
}

momentum > threshold → Rising interest → 관련 오래된 Memory 재부상 트리거 + Reflection 카드 후보.
dormant 관심사는 삭제하지 않음 — 6개월 뒤 서프라이즈 재부상의 재료가 됩니다.

8.5 Memory 연결

저장 시점에 임베딩 유사도 기반으로 기존 Memory와의 연결(edge) 생성 (top-k, threshold 이상).
연결 유형: same_topic, same_intent(예: 여행 계획 관련), temporal(같은 시기 저장).
활용: Card Detail의 "연결된 기억", 큐레이션 reason("어제 저장한 것과 이어져요"), 클러스터 강화.

8.6 Resurface 로직
각 Memory의 재부상 점수를 Daily Pipeline에서 계산:
resurface_score =
    interest_alignment   // 현재 rising/stable 관심사와의 정합
  × timing_fit           // time_sensitivity + best_resurface_ctx vs 오늘
  × maturity_curve       // intent별 최적 숙성 곡선
  × freshness_penalty    // 최근 노출/쿨다운
  × feedback_modifier    // 과거 반응
Maturity curve (intent별 기본값, 데이터로 튜닝)

go(장소): 저장 후 3일~/ 주말·연휴 직전 부스트
learn: 관심사 momentum 상승 시 부스트, 평시엔 30일 주기
buy: 7일 숙성 후 1회 ("아직도 갖고 싶으세요?"가 아니라 "일주일 지났는데 여전히 멋지네요" 톤)
idea(thought): 14일 / 30일 / 90일 간격의 스페이스드 재부상 — 아이디어는 반복 노출이 가치
inspire: 무작위성 허용 (서프라이즈 소스)
dated(시한성): 시한 임박 시 1회 부스트, 시한 경과 후엔 재부상 제외 (죽은 링크·지난 이벤트를 보여주는 것은 신뢰 파괴)

신뢰 보호 장치: 재부상 전 링크 유효성 체크(HTTP 상태). 죽은 링크는 카드 제외 + Library에 표시.

9. Functional Requirements
FR-1. Share to Rudy (Share Extension)

iOS/Android 시스템 공유시트 타깃 제공. URL, 텍스트, 이미지 수신.
수신 → 즉시 로컬 확인 UI(≤1초) → 백그라운드 업로드 → 비동기 AI 분석.
오프라인 시 로컬 큐, 온라인 복귀 시 자동 동기화.
선택적 한 줄 메모 필드 (저장 의도 파악에 매우 가치 있는 시그널이므로 UI는 유지하되 강요하지 않음).
실패율 SLO: 저장 유실 0. (유실 한 번이 신뢰 전부를 파괴)

FR-2. Quick Capture

앱 내 + 버튼, 홈 위젯, 앱 아이콘 롱프레스 진입.
텍스트/음성(STT). 진입→키보드 활성까지 ≤0.5초.
저장 후 즉시 닫힘. 분류 UI 없음.

FR-3. Daily Brief 생성 및 알림

사용자별 새벽 배치 생성 (7.5 파이프라인).
알림: 하루 1회, 사용자 설정 시각. 알림 문구는 오늘의 Hero 카드 예고편 ("3개월 전 아이슬란드 메모를 다시 꺼냈어요").
알림 끄면 Home은 조용히 갱신만. 재알림/독촉 알림 없음 (원칙 3).

FR-4. Home & Card 인터랙션

7장 참조. 외부 열기는 가능한 한 딥링크(YouTube 앱, 지도 앱 직접 실행).
피드백 3종(👍/✕/그만) 기록 및 학습 반영.

FR-5. Library

시간순 전체 목록, 관심사 클러스터 뷰, Memory 삭제/수정(메모 편집).
정리 기능(폴더 생성, 수동 태그)은 의도적으로 제공하지 않음.

FR-6. Search

자연어 시맨틱 검색 (임베딩 기반) + 키워드 폴백.
응답 p95 ≤ 1.5초.

FR-7. 계정 및 데이터

소셜 로그인(Apple/Google). 데이터 전체 내보내기(JSON), 계정 삭제 시 30일 내 완전 삭제.
프라이버시: Memory는 개인 데이터 중 가장 사적인 것에 속함. 사용자 콘텐츠는 모델 학습에 사용하지 않음을 명시. 분석용 LLM 호출은 no-retention 설정.

FR-8. (Post-MVP) 외부 연동

v1.5+: YouTube Watch Later 가져오기, 브라우저 북마크 임포트, 캘린더 read-only(시의성 큐레이션 강화).
임포트는 "대량 유입 → 콜드스타트 단축"의 최단 경로이므로 로드맵 상 우선순위 높음. 단 MVP에서는 API/파싱 복잡도 때문에 제외.


10. AI Architecture
10.1 역할 분해
컴포넌트시점모델작업Ingestion Analyzer저장 직후 (비동기, ≤30초)중형 LLM + 임베딩 모델콘텐츠 추출(메타데이터/본문/자막), 요약, topics, intent 추론, time_sensitivity 판정, 임베딩 생성, 연결 생성Interest Engine일 1회 배치클러스터링 + 소형 LLM(네이밍)클러스터 재계산, strength/momentum 갱신Curation Engine일 1회 배치규칙+스코어링 (비LLM)후보 수집, 스코어링, 카드 구성 — 결정적 로직으로 유지 (비용·일관성·디버깅 가능성)Reason WriterCuration 직후중형 LLMcuration_reason 생성, 톤 가이드 준수, 인사말 생성Search실시간임베딩 검색시맨틱 검색
설계 결정: 카드 선택은 LLM이 아니라 스코어링 엔진이 합니다. LLM은 *이해(ingestion)*와 *표현(reason)*만 담당. 이유: (1) 일일 전 사용자 배치에서 LLM으로 랭킹까지 하면 비용이 선형 폭증, (2) 선택 로직이 결정적이어야 A/B 테스트와 디버깅 가능, (3) 환각으로 잘못된 카드가 뽑히는 위험 차단.
10.2 콘텐츠 추출 파이프라인 (Ingestion 상세)
URL 수신 → 소스 판별
  ├─ YouTube: oEmbed + 자막 API → 제목/채널/자막 요약
  ├─ 일반 웹: 메타태그 + 본문 추출(readability) → 요약
  ├─ 상품: OG 태그 + 가격 파싱(가능 시)
  ├─ 장소: 지도 URL 파싱 → 장소명/좌표
  └─ 이미지: 멀티모달 모델로 내용 인식 (스크린샷 내 텍스트 포함)
→ understanding 생성 → 임베딩 → 연결 생성 → memory 상태 'ready'

추출 실패 시에도 Memory는 생성 (제목=URL, understanding은 degraded 플래그). 나중에 재시도.

10.3 비용 통제

Ingestion: 저장당 1회 고정 (재분석은 실패 시만).
Reason Writer: 사용자당 하루 1회, 카드 3~5개를 단일 프롬프트로 배치 생성.
임베딩·클러스터링은 저비용. 사용자당 일일 AI 비용 목표: $0.01~0.03 수준 유지.

10.4 품질 가드레일

Reason 출력에 대한 금지어 필터(7.7 금지 표현) + 길이 제한.
재부상 대상 dated 콘텐츠의 시한 검증.
사용자별 reason 샘플 로깅(동의 기반) → 톤 품질 주간 리뷰.


11. Database Design
┌──────────────┐       ┌───────────────────┐       ┌──────────────┐
│    users     │1─────*│     memories      │*─────*│  interests   │
└──────────────┘       └───────────────────┘ (via  └──────────────┘
       │1                      │1            memory_interests)
       │                       │*                    
       │*              ┌───────────────┐            
┌──────────────┐       │ memory_links  │            
│ daily_briefs │       └───────────────┘            
└──────────────┘                                    
       │1                                           
       │*                                           
┌──────────────┐       ┌───────────────────┐        
│ brief_cards  │──────*│ card_feedbacks    │        
└──────────────┘       └───────────────────┘
sqlusers (
  id UUID PK,
  auth_provider TEXT, auth_id TEXT,
  display_name TEXT,
  notify_time TIME DEFAULT '08:00',
  timezone TEXT,
  onboarding_interests TEXT[],      -- 초기 선택
  created_at, updated_at
)

memories (
  id UUID PK,
  user_id UUID FK,
  type TEXT,                        -- link|place|thought|image|note
  source_url TEXT NULL,
  raw_text TEXT NULL,               -- quick capture 원문 / 사용자 메모
  title TEXT,
  thumbnail_url TEXT NULL,
  -- understanding layer
  summary TEXT,
  content_type TEXT,
  topics TEXT[],
  inferred_intent TEXT,             -- learn|do|go|buy|remember|inspire
  time_sensitivity TEXT,            -- evergreen|seasonal|dated|event_bound
  expires_at TIMESTAMPTZ NULL,      -- dated인 경우
  embedding VECTOR(1024),
  analysis_status TEXT,             -- pending|ready|degraded|failed
  -- resurface state
  last_surfaced_at TIMESTAMPTZ NULL,
  surface_count INT DEFAULT 0,
  suppressed_until TIMESTAMPTZ NULL, -- ✕ 쿨다운
  is_excluded BOOL DEFAULT false,    -- '그만 보기'
  link_alive BOOL DEFAULT true,
  created_at, updated_at, deleted_at
)
-- INDEX: (user_id, created_at), (user_id, analysis_status), vector index on embedding

interests (
  id UUID PK,
  user_id UUID FK,
  name TEXT,                        -- AI 생성
  centroid VECTOR(1024),
  memory_count INT,
  strength FLOAT,                   -- 0~1
  momentum FLOAT,                   -- 최근 변화율
  status TEXT,                      -- rising|stable|dormant
  is_hidden BOOL DEFAULT false,     -- 사용자 숨김
  last_engaged_at, created_at, updated_at
)

memory_interests (
  memory_id UUID FK, interest_id UUID FK,
  similarity FLOAT,
  PRIMARY KEY (memory_id, interest_id)
)

memory_links (
  id UUID PK,
  memory_a UUID FK, memory_b UUID FK,
  link_type TEXT,                   -- same_topic|same_intent|temporal
  similarity FLOAT,
  created_at
)

daily_briefs (
  id UUID PK,
  user_id UUID FK,
  brief_date DATE,
  greeting TEXT,
  closing TEXT,
  status TEXT,                      -- generated|fallback|failed
  generated_at,
  UNIQUE (user_id, brief_date)
)

brief_cards (
  id UUID PK,
  brief_id UUID FK,
  memory_id UUID FK NULL,           -- discovery 카드는 NULL 가능
  external_content JSONB NULL,      -- discovery용 (url, title, thumbnail)
  card_type TEXT,                   -- rediscovery|discovery|reflection
  reason_code TEXT,                 -- timing|rising_interest|maturity|connection|surprise...
  curation_reason TEXT,             -- LLM 생성 문구
  position INT,                     -- 0 = hero
  score FLOAT,
  score_breakdown JSONB             -- 디버깅/튜닝용
)

card_feedbacks (
  id UUID PK,
  card_id UUID FK, user_id UUID FK,
  action TEXT,     -- open_external|open_detail|like|not_today|never|impression
  created_at
)

user_model (                        -- 장기 기억 스냅샷
  user_id UUID PK,
  format_preference JSONB,          -- {video:0.6, article:0.3, ...}
  context_patterns JSONB,           -- {weekend_place_affinity:0.8, ...}
  reason_type_affinity JSONB,
  updated_at
)

DB: PostgreSQL + pgvector (MVP 규모에 충분, 벡터 전용 DB는 조기 최적화).
score_breakdown 저장은 큐레이션 품질 튜닝의 생명줄 — 반드시 포함.


12. API Design
REST, Authorization: Bearer <JWT>. Base: /v1
Memories
POST   /memories                    # Share Ext / Quick Capture
       body: { type, source_url?, raw_text?, user_note?, shared_from? }
       → 201 { id, analysis_status: "pending" }   # 즉시 반환, 분석 비동기

GET    /memories?cursor=&limit=30&interest_id=
GET    /memories/{id}               # understanding + linked memories 포함
PATCH  /memories/{id}               # user_note 수정
DELETE /memories/{id}
POST   /memories/search             # { query } → 시맨틱 검색 결과
Brief (Home)
GET    /briefs/today
       → { brief_date, greeting, closing, status,
           cards: [ { id, card_type, reason_code, curation_reason,
                      position, memory?: {...}, external_content?,
                      primary_action: { type: "deeplink|detail", url } } ] }
       # 미생성 시 서버가 fallback brief를 동기 생성해 반환 (빈 Home 금지)

POST   /briefs/cards/{card_id}/feedback
       body: { action: "open_external|open_detail|like|not_today|never|impression" }
Interests
GET    /interests                   # name, count, strength, status
GET    /interests/{id}/memories
PATCH  /interests/{id}              # { is_hidden }
User
GET    /me
PATCH  /me                          # notify_time, timezone
POST   /me/onboarding               # { interests: [...] }
GET    /me/export                   # 데이터 내보내기 job 생성
DELETE /me                          # 계정 삭제
내부 (비공개)
POST /internal/ingest/{memory_id}      # 분석 워커 트리거
POST /internal/briefs/generate         # 배치 스케줄러 → 사용자별 생성
설계 노트: POST /memories는 어떤 경우에도 p95 300ms 내 응답 (Share Extension UX의 생명). 분석은 큐(SQS 등) 기반 워커로 분리.

13. MVP Scope
MVP (v1.0) — 목표: "재발견의 마법"을 최소 구성으로 증명
포함

Share to Rudy (URL/텍스트/이미지)
Quick Capture (텍스트만; 음성은 v1.1)
Ingestion AI (요약·intent·임베딩·연결)
Interest Engine (클러스터링·momentum)
Daily Brief: Rediscovery + Reflection 카드, 하루 1회, 알림
Home + Card Detail + 피드백 3종
Library (시간순 + 관심사 뷰) + 시맨틱 검색
온보딩 (관심사 선택 + 첫 기억 3개)
iOS 우선 단일 플랫폼

의도적 제외 (그리고 이유)

Discovery(외부 신규 콘텐츠) 카드 — 외부 추천 품질을 담보하려면 콘텐츠 소싱 파이프라인이 별도 제품 수준. MVP는 사용자 자신의 데이터만으로 가치를 증명해야 함. 단, 콜드스타트 기간(Memory <15개)에 한해 제한된 화이트리스트 소스로 최소 제공.
채팅 (전면 제외 — 원칙 9)
외부 서비스 연동/임포트 (v1.5)
Daily Notes (v2)
위치 기반 트리거 (v2)
Android (v1.5)

MVP 성공 지표 (North Star: Weekly Rediscovery Actions)

Brief open rate (알림→열람): ≥ 45%
카드→외부 이동 전환율: ≥ 25% (북극성 구성요소)
주간 저장 건수/활성 사용자: ≥ 5
W4 리텐션: ≥ 30%
평균 세션 길이: 2분 이하 (역방향 지표 — 길어지면 실패 신호)

v1.x 백로그

v1.1: 음성 캡처, 위젯, 죽은 링크 처리 고도화
v1.5: YouTube/북마크 임포트(콜드스타트 단축), Android, Discovery 카드 정식 오픈


14. Product Roadmap
~6개월: "재발견을 증명한다"

MVP 출시 (iOS) → 큐레이션 품질 루프 구축 (score_breakdown 기반 주간 튜닝)
v1.5: 대량 임포트 (Watch Later/북마크) — 기존 저장물 수백 건이 첫 주부터 재발견 재료가 되는 경험
Android 출시
판단 기준: 북극성(주간 재발견 액션)과 W4 리텐션이 목표치 도달 시 다음 단계 투자

~1년: "맥락이 깊어진다"

Discovery 정식화: 관심사 기반 외부 콘텐츠 (품질 큐레이션된 소스부터)
캘린더 read-only 연동 → 시의성 큐레이션 ("금요일 반차네요, 저장해둔 그 전시 어때요?")
위치 트리거 (opt-in): 저장한 장소 근처 도달 시 부드러운 제안
Daily Note: 하루 한 줄 → Reflection 카드 재료 → 장기적으로 "그때의 나" 재발견으로 확장
Evening Brief 실험 (아침 외 두 번째 순간)

~2년: "나를 가장 잘 아는 AI Home"

멀티 디바이스 확장: 위젯 고도화, 워치 글랜스, (탐색) 브라우저 신탭 = Rudy Home
Memory 간 추론 고도화: 단순 유사도 연결 → "여행 계획", "이직 고민" 같은 의도 스레드 자동 형성 및 스레드 단위 큐레이션
연간 회고 상품화: "올해의 당신이 저장한 것들" (강력한 바이럴+리텐션 자산)
플랫폼화 탐색: 서드파티 앱이 Rudy Memory에 쓰기/읽기 하는 API — Rudy가 개인 맥락 레이어가 되는 방향. 단, 이 시점에도 사용자 대면 제품의 중심은 여전히 Home이어야 함.


부록: 오픈 퀘스천 (킥오프 논의 필요)

Discovery 콘텐츠 소싱 — 콜드스타트용 화이트리스트 소스 선정 기준 (편집팀 필요 여부)
알림 문구 개인화 수준 vs 프라이버시 (잠금화면에 저장물 제목 노출 여부 — 기본은 비노출 제안)
이미지 Memory의 멀티모달 분석 비용 — MVP에서 OCR만 vs 풀 비전 모델
한국어/영어 동시 지원 여부 (Reason Writer 톤 가이드는 언어별 별도 작성 필요)