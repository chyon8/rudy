# Rudy MVP — 실행 계획 (Plan v1.0)

> PRD.md + CLAUDE.md를 기준으로 10회 반복 검증(허점 발견 → 해결)을 수행한 결과와,
> 그에 따라 확정된 기술 결정·마일스톤이다.
>
> **역할 (2026-07-04 문서 재구성 후)**: 이 문서는 이제 **결정 로그(왜 이렇게 정했나)** 다.
> 아래 §3 스펙 보정·v1.1/v1.2의 모든 확정 사항은 이미 **docs/spec.md**(백엔드 스펙 단일 소스)에
> 반영돼 있다. "무엇을 만드나"는 docs/spec.md·DESIGN.md, "왜"는 이 문서, 마일스톤 verify 기준은 아래 §4.

---

## 1. 반복 검증 결과 — 발견한 허점 10개와 해결

### #1. 의존성 역전: 스코어링(M2)이 Interest Engine(M5)에 의존 — **치명적**
- **허점**: 브리핑 스코어의 35%가 `interest_alignment`, Reflection 후보는 momentum 기반인데,
  interests 레코드를 만드는 Interest Engine 배치는 M5에 있다. M2~M4 동안 스코어링의 절반이 죽는다.
- **해결**: **온보딩에서 선택한 관심사 칩을 즉시 interests 레코드로 생성**한다
  (칩 텍스트를 임베딩 → centroid, strength=0.5, status='stable').
  ingestion 5단계(centroid cosine ≥ 0.75 배정)가 Day 0부터 작동하고, interest_alignment도 즉시 유효.
  M5의 Interest Engine 배치는 "생성"이 아니라 "재클러스터링·보정" 역할이 된다.
  Reflection 카드는 momentum이 생기는 M5 전까지 자연히 0건 — 구성 규칙(≤1장) 위반 없음.

### #2. 브리핑 생성 경합 — fallback이 정식 브리핑을 영구 차단
- **허점**: 새벽 배치 전에 사용자가 앱을 열면 GET이 동기 fallback을 생성하고,
  `UNIQUE(user_id, brief_date)` 때문에 이후 배치가 정식 브리핑을 만들 수 없다.
  또 GET 동시 요청 2건이 fallback을 중복 생성하면 UNIQUE 충돌로 500.
- **해결**:
  - fallback 생성은 `INSERT ... ON CONFLICT DO NOTHING` 후 재조회 (동시성 안전).
  - **승격 규칙**: 배치는 `status='fallback'`이고 **해당 brief 카드에 피드백(impression 포함) 0건**인
    브리핑에 한해 교체 가능. 피드백이 있으면 사용자가 이미 본 것이므로 유지 (하루 1회 원칙 유지).

### #3. 푸시 "예약"은 존재하지 않는 기능
- **허점**: CLAUDE.md 7.6 "notify_time에 Expo push 예약" — Expo Push API에는 서버측 예약 발송이 없다.
- **해결**: 브리핑 생성 완료 시 **BullMQ delayed job**(delay = notify_time − now)으로 발송 예약.
  사용자가 notify_time을 변경하면 기존 delayed job을 제거하고 재등록. jobId = `push:{userId}:{briefDate}`로 멱등화.

### #4. 이미지 Memory의 저장소가 어디에도 없음
- **허점**: image 타입이 MVP 범위인데 object storage가 스펙·env 어디에도 없다 (S3 설정 부재).
- **해결**: `StoragePort` 인터페이스(put/getPublicUrl) 도입 — dev는 API 서버 로컬 디스크(`/uploads` static),
  prod는 S3 호환(env로 전환). **구현 시점은 M4**(Share Extension과 함께 — 이미지 유입 경로가 공유시트이므로).
  M1~M3는 link/thought만 처리하고, type='image' API는 받되 분석은 M4에서 활성화.

### #5. 소셜 로그인이 M1 블로커
- **허점**: Sign in with Apple은 유료 개발자 계정·번들ID·콘솔 설정이 필요 — M1(백엔드 기초)에서
  이걸 기다리면 전체가 멈춘다. 시뮬레이터 개발 마찰도 크다.
- **해결**: `AUTH_DEV_MODE=true`일 때 `POST /auth/dev { email }` → JWT 발급 (prod 빌드에서 컴파일 타임 제외 수준으로 차단).
  Apple/Google 로그인은 **M4로 이동** (Share Extension이 어차피 Apple 계정을 요구하는 시점).
  JWT 만료 30일, refresh 토큰 없음 (MVP 단순화).

### #6. 링크 유효성 검증의 비용·오탐
- **허점**: "brief 생성 직전 HEAD 요청으로 검증" — 후보 전체에 하면 사용자당 수십 요청, HEAD를
  거부하는 서버(403/405)가 많아 멀쩡한 링크를 죽은 것으로 오판한다.
- **해결**: **최종 선정된 카드 3~5장만** 검증. HEAD 실패 시 `GET + Range: bytes=0-0` 폴백, 타임아웃 3초.
  4xx(405 제외)/네트워크 오류만 dead 판정 → `link_alive=false` + 차순위 후보로 교체 후 재검증.

### #7. Day 0 콜드스타트 조립 규칙이 fallback에 뭉개져 있음
- **허점**: 온보딩 직후 GET은 fallback 경로(최근 저장 시간순)로 떨어져 "방금 저장한 1건"짜리 Home이 된다.
  PRD J1의 "이해 카드 1 + New Discovery 2" 구성이 스펙 어디에도 구현 경로가 없다.
- **해결**: **coldstart 조립 경로를 fallback과 분리**: memory < 15 && 오늘 brief 없음 →
  방금 저장한 memory 카드(reason_code='cold_start') 1장 + 온보딩 관심사 매칭 discovery 2장.
  `/config/coldstart_sources.json`(프리셋 관심사 12개 × 소스 3~5개)은 M2에서 시드 작성.

### #8. Discovery 카드 피드백 처리 구멍
- **허점**: `not_today → memory.suppressed_until`, `never → is_excluded` 규칙은 memory_id가 NULL인
  discovery 카드에 적용 불가 — 그대로 구현하면 null 참조.
- **해결**: memory_id 없는 카드의 피드백은 **기록만** 하고 상태 변경은 스킵 (추후 학습 신호로만 사용).

### #9. 타임존·스케줄러 경계의 멱등성
- **허점**: 15분 tick × "notify_time − 2h" 창 계산은 경계 중복/누락과 이중 생성 위험.
- **해결**: Luxon으로 사용자 timezone 기준 로컬 계산, 창은 반열림 `[T−2h, T−1.75h)`.
  `brief_date` = 사용자 로컬 날짜. 생성 전 존재 체크 + DB UNIQUE로 이중 방어 (#2의 ON CONFLICT와 동일 패턴).
  tick이 밀려 창을 놓친 사용자는 다음 tick에서 "notify_time 이전 && 오늘 brief 없음" 조건으로 보충 생성.

### #10. UX 간결성·마일스톤 정합 최종 점검
- (a) **검색 API를 M2로 당김** — Library(M3) 상단 검색바가 M5의 검색 API를 기다리는 모순 제거.
  구현은 쿼리 임베딩 + pgvector cosine 하나라 저비용.
- (b) **금지어 필터를 M2로 당김** — 문구 생성(M2)과 한 몸. Acceptance criteria도 이를 요구.
- (c) Home 상태 정의: 로딩은 스켈레톤 1종, 네트워크 오류 시 마지막 brief 로컬 캐시 표시 (빈 Home 금지 원칙의 클라이언트측 구현).
- (d) 온보딩은 그대로 유지 (관심사 최소 3개, 첫 기억 1건) — 콜드스타트 재료라 더 줄이지 않는다.
- (e) 카드 피드백 UI 확인: 👍/✕만 노출, '그만 보기'는 ⋯ 메뉴 — 스펙 그대로. 추가 버튼 금지.

---

## 2. 확정 기술 결정

| 항목 | 결정 | 근거 |
|---|---|---|
| LLM | OpenAI. `OPENAI_MODEL=gpt-4o-mini`(ingestion), `OPENAI_MODEL_REASON=gpt-4o-mini`(문구, 톤 필요 시 gpt-4o 상향) | 사용자가 OpenAI 키 제공. `LlmPort`로 추상화 (제공자 교체 가능) |
| LLM 출력 강제 | OpenAI Structured Outputs (`response_format: json_schema, strict:true`) | ingestion 분석·reason writer JSON 파싱 실패 제거 |
| 임베딩 | OpenAI `text-embedding-3-small`, `dimensions:1024` | **dimensions 파라미터로 1024 출력 → VECTOR(1024) 스키마 그대로 유지**. `EmbeddingPort`로 추상화 |
| AI SDK | `openai` (npm) | api·worker 공용 |
| AI 비용 | ingestion 저장당 1회 / reason writer 사용자·일당 1회(카드 전체 단일 프롬프트) | 목표 $0.01~0.03/일/사용자. OpenAI Batch API(50%↓)는 규모 확대 시 v1.x 최적화 후보로만 기록 |
| 모노레포 | pnpm workspaces (turbo 없음) | 앱 3개+패키지 1개 규모에 충분. 단순함 우선 |
| API | Fastify 5 + `fastify-type-provider-zod`, zod 스키마는 `/packages/shared` | API·모바일 contract 단일 소스 |
| DB | PostgreSQL 16 + pgvector(HNSW), Drizzle (`customType`으로 vector) | 스펙 그대로 |
| 큐 | BullMQ: `ingest`(재시도 3회 backoff), `brief`(15분 repeatable), `push`(delayed) | #3 해결 반영 |
| 시간 | Luxon (IANA tz) | #9 |
| 테스트 | Vitest (api/worker 단위·통합), 스코어링·필터·쿨다운은 순수함수로 분리해 단위 테스트 | Acceptance criteria 직결 |
| 로컬 인프라 | docker-compose: `pgvector/pgvector:pg16` + `redis:7` | |
| 인증 | dev: `POST /auth/dev` (AUTH_DEV_MODE) / prod: Apple+Google (M4) | #5 |
| 스토리지 | `StoragePort` — dev 로컬 디스크, prod S3 호환 (M4 구현) | #4 |

## 3. CLAUDE.md 스펙 보정 (구현 시 이 규칙 적용)

1. 온보딩 관심사 → interests 레코드 즉시 생성 (§9 온보딩, §6-5단계 전제 충족). — #1
2. fallback 브리핑 승격 규칙: 배치는 피드백 0건인 fallback을 교체할 수 있다. — #2
3. §7.6 "푸시 예약" = BullMQ delayed job. — #3
4. image 분석·저장은 M4. StoragePort 추가 (env: `STORAGE_DRIVER=local|s3`, S3 설정 3종). — #4
5. §5 Auth에 `POST /auth/dev` 추가 (dev 전용). Apple/Google은 M4. — #5
6. §7.1 링크 검증은 선정 카드에만, HEAD→GET Range 폴백. — #6
7. §7.5 fallback과 별개로 coldstart 조립 경로 신설 (reason_code='cold_start'). — #7
8. §4 card_feedbacks 처리 규칙에 "memory_id NULL이면 기록만" 추가. — #8
9. 검색 API·금지어 필터는 M2 산출물. — #10
10. Env 추가: `AUTH_DEV_MODE`, `STORAGE_DRIVER`(+S3 3종).
11. **AI 제공자 = OpenAI** (사용자 결정). CLAUDE.md §3·§14는 명목상 Anthropic으로 적혀 있으나
    이 문서가 우선한다: LLM=gpt-4o-mini, 임베딩=text-embedding-3-small(dimensions:1024), SDK=`openai`.
    `LlmPort`/`EmbeddingPort` 추상화로 추후 제공자 교체 가능. 실제 env는 `.env`/`.env.example` 참조.

## 4. 마일스톤 (조정판) — 각 단계 완료 기준 포함

### M0 — Skeleton (½일)
모노레포(pnpm), docker-compose, tsconfig/eslint/vitest 공통 설정, `/packages/shared` 골격, env 로더.
- ✅ verify: `docker compose up` + `pnpm dev` → API `/health` 200, worker 부팅 로그.

### M1 — Foundation
Drizzle 스키마 전체+마이그레이션, dev auth(JWT), memories CRUD + `POST /memories/search`,
ingestion 워커(추출: YouTube oEmbed/readability → LLM 분석(structured output) → 임베딩 → 연결 → 관심사 배정),
`POST /me/onboarding`(관심사 → interests 생성).
- ✅ verify: URL 저장 → 30초 내 `analysis_status='ready'` + summary/topics/embedding/links 생성 (통합 테스트).
- ✅ verify: `POST /memories` 경로에 AI 호출 없음 (코드 리뷰) + 응답시간 테스트.
- ✅ verify: 검색 쿼리 "파스타 영상" → 관련 memory 상위 반환.

### M2 — Brief Engine
`/config/scoring.ts`(상수 집약), 후보 수집→스코어링→구성(순수 함수), reason writer(단일 프롬프트+금지어 필터+템플릿 폴백),
fallback+승격 규칙, coldstart 경로+`coldstart_sources.json` 시드, `GET /briefs/today`, feedback API(+#8 규칙),
brief 스케줄러(15분 tick, #9), 링크 검증(#6).
- ✅ verify (전부 자동 테스트): memory 0건 유저 200+카드≥1 / 21일 쿨다운 / never 영구 제외 /
  expires_at 경과 dated 제외 / 금지어 필터 / fallback 승격 / 같은 날 이중 생성 불가.

### M3 — Mobile Core
Expo 앱(탭 3개), dev 로그인, 온보딩 3단계(→ 첫 Home), Home(스켈레톤/캐시 폴백, impression 1회 전송, 새로고침·무한스크롤 없음),
Card Detail, Quick Capture(낙관적 UI+로컬 큐 재시도), Library(전체/관심사/검색).
- ✅ verify: 시뮬레이터에서 온보딩→저장→첫 Home→카드 탭→외부 열기 E2E 시나리오.
- ✅ verify: Home에 pull-to-refresh/무한스크롤 제스처 없음.

### M4 — Share Extension + Push + 실제 인증
iOS Share Extension(App Group 큐잉, 오프라인 flush), 이미지 storage+vision 분석, Apple/Google 로그인,
푸시 발송(delayed job, 잠금화면 프라이버시 토글).
- ✅ verify: 네트워크 차단 상태 공유 저장 → 앱 실행 시 memory 생성 (Acceptance criteria).
- ⚠️ 외부 의존: Apple Developer 계정, 실기기, EAS build.

### M5 — Polish
Interest Engine 배치(k-means 단순 구현, k=⌈n/8⌉ 최대 10, 이름 생성 LLM), momentum/status 갱신,
user_model 주간 배치 스텁, 죽은 링크 Library 표시, reason 샘플 로깅, e2e 정리, 스코어링 튜닝 패스.
- ✅ verify: 시드 데이터 30건 → 클러스터 생성·이름·rising 감지 스냅샷 테스트.

## 5. 개발 시작 전 준비물 (사용자 액션)

| 시점 | 필요한 것 |
|---|---|
| M1 | `OPENAI_API_KEY` (제공 완료, .env 설정됨) — LLM·임베딩 모두 OpenAI 하나로 커버 |
| M3 | Xcode + iOS 시뮬레이터 (로컬에 있으면 충분) |
| M4 | Apple Developer 계정($99/년), 실기기, Expo(EAS) 계정, Google OAuth 클라이언트 ID |

준비물이 없어도 M0~M3까지는 진행 가능하도록 위 결정(#5, #4)이 설계되어 있다.

---

# Final Review (v1.1) — 개발 직전 최종 검증 (10-pass)

> 신규 요구사항 반영: **영어 기본 + 한국어 선택 (타겟 = 영어권)**, 디자인 = 에디토리얼 + 크림 캔버스.
> 억지 개선 없이 critical만 채택. 판정: **Critical 6 / 결정 필요 2 / 이상 없음 2.**

| Pass | 대상 | 판정 |
|---|---|---|
| F1 | i18n 전파 (신규 요구사항) | 🔴 Critical |
| F2 | 타임존 글로벌화 | 🔴 Critical |
| F3 | 푸시 토큰 저장 부재 | 🔴 Critical — 이대로면 푸시 자체가 불가능 |
| F4 | 동일 URL 중복 저장 | 🔴 Critical |
| F5 | 서버측 URL fetch 보안 (SSRF) | 🔴 Critical |
| F6 | Interest 재클러스터링의 상태 파괴 | 🔴 Critical |
| F7 | pgvector HNSW + user_id 필터 recall | 🟡 결정 — MVP는 인덱스 없이 정확 스캔 |
| F8 | 스키마 미세 결함 (unique 제약 2건) | 🟡 결정 — 마이그레이션에 포함 |
| F9 | 브리핑·피드백·쿨다운 로직 재검증 | ✅ 이상 없음 (v1.0 해결책 유지) |
| F10 | 모바일 UX·디자인 정합 | ✅ 이상 없음 (i18n 항목만 F1로 이관) |

### F1. i18n — 영어 기본, 한국어 선택 (모든 레이어 파급)
- **`users.locale TEXT DEFAULT 'en'`** ('en'|'ko') 추가. 이 값이 모든 AI 산출물의 언어를 결정:
  memory summary, interest 이름, curation_reason, greeting/closing, 푸시 문구.
  (저장물 콘텐츠 언어와 무관 — Rudy가 사용자에게 말하는 언어 기준.)
- **톤 가이드·금지어 필터를 언어별 분리**: `/config/tone/ko.ts`(§11 그대로) + `/config/tone/en.ts` 신규
  (en 금지어 예: "you still haven't", "piling up", "don't forget", "overdue", "backlog",
  "it's been N days", "finally get to"). curation_reason 길이: ko 60자 / **en 120자**.
- **interest 이름 규칙 locale화**: ko "2~6자 명사구" / en "1~3단어 명사구".
- **임베딩은 변경 없음**: text-embedding-3-small은 다국어 단일 벡터공간 — ko/en 콘텐츠 혼재 검색·연결 그대로 동작.
- **모바일**: i18next + expo-localization을 **M3 첫날부터** 도입 (후행 도입은 전면 재작업).
  기본 = 시스템 로캘(en 폴백), Settings에 언어 항목 1개 → `PATCH /me { locale }`.
- **locale 변경 반영 시점**: 오늘 brief는 유지, 다음 brief부터 새 언어 (§7 "당일 재생성 없음"과 일관).
- **coldstart·온보딩**: 관심사 칩은 stable key + locale별 라벨. `coldstart_sources.json`은
  `{ interestKey: { en: [...], ko: [...] } }` 구조 — **en 소스가 1순위 작성 대상**.
- **타이포 locale 페어링**: en = EB Garamond(300)/Inter, ko = Noto Serif KR(300)/Pretendard.
  디자인 토큰의 font-family만 locale로 스왑, 나머지 시스템 동일.
- 부수 효과: 타겟이 영어라 gpt-4o-mini 문구 품질 리스크가 오히려 줄어듦 (영어 산문이 더 강함).

### F2. 타임존 글로벌화
- `users.timezone DEFAULT 'Asia/Seoul'` 제거 → **가입/온보딩 시 디바이스 타임존 전송**(expo-localization), 폴백 'UTC'.
- 스케줄러는 이미 사용자별 IANA tz + 15분 tick 재계산 구조라 글로벌·DST에 그대로 유효 (v1.0 #9 설계 유지 확인).

### F3. 푸시 토큰 저장 위치가 스펙 어디에도 없음
- CLAUDE.md는 푸시 발송을 요구하지만 Expo push token을 받는 API도 저장 컬럼도 없다.
- **`users.expo_push_token TEXT NULL`** + **`users.hide_notification_content BOOL DEFAULT false`**
  (§7.6 잠금화면 토글의 실체) 추가. 토큰 등록은 `PATCH /me { expo_push_token }` 재사용.
  스키마는 M1에 포함, 사용은 M4. MVP는 단일 디바이스 가정 (devices 테이블은 과설계).

### F4. 동일 URL 중복 저장 (Watch Later 재공유는 필연)
- **URL 정규화 유틸** 신설: youtu.be/watch?v=/shorts 변형 통일, utm·추적 파라미터 제거
  — YouTube 딥링크 변환(§5)과 공용.
- `memories.source_url_normalized TEXT NULL` + partial unique
  `(user_id, source_url_normalized) WHERE deleted_at IS NULL AND type='link'`.
- POST /memories에서 충돌 시 **기존 memory 반환**(새 메모가 있으면 raw_text에 append).
  재저장은 관심 신호이므로 `updated_at` 갱신 (resurface 부스트는 v1.x).
  오프라인 큐 이중 flush 경합도 이 제약이 자동 방어.

### F5. SSRF — 워커가 내부망 스캐너가 되는 구멍
- ingestion 추출·링크 체커 모두 사용자 제공 URL을 서버가 fetch한다. 방치 시 사설 IP
  (169.254.169.254, localhost, 10.x 등) 접근 가능.
- **`safeFetch` 공용 유틸 1개**: DNS resolve 후 사설/링크로컬 IP 차단, redirect ≤3(매 hop 재검증),
  http(s)만, 응답 2MB cap, timeout 3s. ingestion(M1)과 링크 체커(M2)가 공유.
- 겸사겸사 `@fastify/rate-limit` 기본 장착 (POST /memories는 LLM 비용을 유발하는 공개 엔드포인트).

### F6. Interest Engine 재클러스터링이 사용자 상태를 파괴
- M5의 k-means를 소박하게 "전부 지우고 재생성"으로 구현하면 `is_hidden`, Library 관심사 연속성,
  온보딩 interests가 매 새벽 리셋된다.
- **reconcile 규칙**: 새 클러스터 centroid ↔ 기존 interest centroid cosine ≥ 0.8 → 기존 레코드
  **in-place 갱신**(name·is_hidden 보존), 미매칭만 신규 생성, 고아 interest는 삭제 대신 dormant.

### F7. pgvector HNSW + user_id 필터의 recall 함정 (결정)
- HNSW는 전역 이웃 탐색 후 user_id 필터라 결과 누락 가능(pgvector 공지된 특성).
- **MVP는 벡터 인덱스 생성 보류 → 정확 스캔** (사용자당 수백~수천 행에서 ms 단위, 항상 정확).
  수십만 행 도달 시 HNSW + iterative_scan 도입 (v1.x 튜닝 항목). 단순화이자 정확성 확보.

### F8. 스키마 미세 결함 (마이그레이션에 포함)
- `memory_links`에 `UNIQUE(memory_a, memory_b)` — 재분석 시 중복 엣지 방지.
- `card_feedbacks`: impression은 partial unique `(card_id) WHERE action='impression'`
  + `ON CONFLICT DO NOTHING` — 클라이언트 재전송 내성.

### F9·F10. 재검증 통과 확인
- fallback 승격(#2)·coldstart(#7)·쿨다운·discovery null 처리(#8)·스케줄러 멱등성(#9): 신규 요구사항
  하에서도 유효. 변경 없음.
- 모바일: Expo RN iOS 우선 확인. 디자인 시스템은 **`DESIGN.md`가 유일한 소스**
  (ElevenLabs 레퍼런스와 동일한 문서 양식: Overview/Colors/Typography/Layout/Elevation/
  Shapes/Components/Do's-Don'ts/Responsive/Iteration Guide/Known Gaps). 크림 캔버스(#faf6ef),
  Hero 카드 전용 orb(card_type별 lavender/peach/mint), locale별 타이포 페어링(en: EB Garamond+Inter,
  ko: Noto Serif KR+Pretendard) 확정. M3 착수 시 DESIGN.md가 스타일링 단일 소스 — 임의 판단 금지.
  Home 오프라인 캐시, impression 1회 전송 유지.

### v1.1 스키마 델타 요약 (M1 마이그레이션 반영분)
```
users      + locale TEXT NOT NULL DEFAULT 'en'
users      + expo_push_token TEXT NULL
users      + hide_notification_content BOOL NOT NULL DEFAULT false
users      ~ timezone: DEFAULT 'Asia/Seoul' 제거 → 가입 시 디바이스 tz, 폴백 'UTC'
memories   + source_url_normalized TEXT NULL
memories   + UNIQUE(user_id, source_url_normalized) WHERE deleted_at IS NULL AND type='link'
memories   ~ embedding: HNSW 인덱스 생성 보류 (정확 스캔, F7)
memory_links   + UNIQUE(memory_a, memory_b)
card_feedbacks + UNIQUE(card_id) WHERE action='impression'
```

### 마일스톤 반영
- **M1**: v1.1 스키마 델타 전체, URL 정규화 유틸(F4), safeFetch(F5), rate-limit, summary locale 규칙(F1).
- **M2**: 톤 가이드/금지어 en·ko 분리(F1), coldstart en 소스 1순위(F1).
- **M3**: i18next 첫날 도입, 시스템 로캘 감지, Settings 언어 항목, locale별 타이포 토큰(F1), 디바이스 tz 전송(F2).
- **M4**: 푸시 토큰 등록·프라이버시 토글 사용(F3), 푸시 문구 locale(F1).
- **M5**: Interest reconcile 규칙(F6).

---

# Final Review (v1.2) — 핸드오프 무결성 검증 (시니어 기획자 패스)

> 렌즈: "이 문서만 들고 개발을 시작했을 때 멈추거나 잘못 추측하는 지점이 있는가."
> **판정: 아키텍처·데이터 모델·파이프라인 = 수정 없음 (3회 검증 수렴).**
> 남은 것은 핸드오프 결함 1건(H1, CLAUDE.md에 직접 반영 완료)과 구현 시 임의 판단이
> 발생할 미결정 7건(H2~H8) — 아래로 확정한다. **이 문서 이후 추가 스펙 변경 없음.**

### H1. 문서 우선순위가 자동 로드 경로에 없었음 — 🔴 치명 (수정 완료)
- CLAUDE.md는 매 세션 자동 로드되지만 PLAN.md는 아니다. 새 세션이 CLAUDE.md §3만 읽으면
  **Anthropic API·한국어 전제로 구현하는 사고**가 난다 (OpenAI 전환·i18n이 전부 PLAN.md에만 있으므로).
- → CLAUDE.md 최상단에 "PLAN.md 우선 + 주요 보정 요약" 경고 블록 삽입 완료.

### H2. 온보딩 "첫 Home" 타이밍 — 비동기 분석과의 경합 (유일하게 중요한 UX 미결정)
- 스펙은 "저장 완료 시 첫 Home 즉시 표시"인데 ingestion은 비동기(≤30초). 그대로 구현하면
  첫 Home의 카드가 제목=원시 URL, 요약 없음으로 뜬다 — PRD가 최대 리스크로 꼽은 콜드스타트의 첫인상 붕괴.
- **확정**: 첫 저장 후 "기억을 심는 중" 상태로 `analysis_status` 폴링(2초 간격, 최대 16초) →
  ready 시 GET /briefs/today. 타임아웃 시에도 진행하되 cold_start 카드는 title=URL 도메인,
  요약 자리에 템플릿 카피 "Rudy is still reading this one" / "Rudy가 아직 읽고 있어요" 표시
  (금지어 프레임 아님, LLM 아닌 정적 템플릿).

### H3. Library 관심사 탭의 빈 클러스터 노출
- 온보딩 직후 interests는 존재하지만 memory_count=0 — "베이킹 · 0개 기억" 나열은 어색.
- **확정**: 관심사 탭은 `memory_count ≥ 1`인 interest만 표시. 전부 0이면 탭 빈 상태 카피 1줄.

### H4. 온보딩 관심사 payload 형식
- **확정**: `POST /me/onboarding { interests: [{ key?: string, label: string }] }` —
  프리셋 칩은 key+locale 라벨, 자유 입력은 label만. interest.name = label(사용자 locale),
  임베딩도 label 텍스트로 생성. coldstart 매칭은 key 기준(자유 입력은 coldstart 미매칭 허용).

### H5. Settings 최종 구성 (중복 제거)
- **확정**: 알림 시간 / 언어(en·ko) / 잠금화면 내용 숨기기 / 계정(로그아웃·삭제). 끝.
- PRD S9의 "관심사 관리"는 Library 관심사 탭(숨기기 포함)으로 **일원화** — 같은 기능 두 곳 금지 (간결함 원칙).

### H6. API 응답 표준 (개발자 임의 판단 방지)
- **확정**: 에러 envelope `{ error: { code: string, message: string } }` + HTTP 상태코드.
  페이지네이션 cursor = `base64(created_at + ':' + id)`, 응답은 `{ items, next_cursor|null }`.

### H7. 정적 UI 카피 작성 규칙
- **확정**: 구현 시 **en을 원문으로 먼저 작성**(타겟 언어), ko는 대응 번역. 둘 다 §11 톤 가이드
  적용(담백, 죄책감 프레임 금지, 이모지 금지). i18n 리소스 파일이 카피의 단일 소스.

### H8. 푸시 토큰 무효화 (M4)
- **확정**: Expo push 발송 결과 `DeviceNotRegistered` 수신 시 `users.expo_push_token = NULL`.
  재등록은 앱 실행 시 토큰 동기화로 자연 복구.

### 검증 종료 선언
v1.0(아키텍처 10회) → v1.1(신규 요구사항 10-pass) → v1.2(핸드오프 패스)로 검증 수렴.
**기획서는 개발 착수 가능 상태다. 이후 스펙 변경은 구현 중 발견되는 사실에 의해서만 발생한다.**
