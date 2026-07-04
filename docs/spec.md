# Rudy — Backend Implementation Spec

> **로드 시점**: 백엔드(api/worker/shared) 작업 시. 모바일만 할 땐 안 읽어도 됨 (그건 DESIGN.md).
> 이 문서는 데이터모델·API·파이프라인의 **단일 소스**다. PLAN.md의 v1.0~v1.2 보정이 여기 이미 반영돼 있다.
> PLAN.md는 "왜 이렇게 정했나"(결정 로그), 이 문서는 "무엇을 만드나"(스펙). 충돌 시 이 문서 우선.
> AI 제공자는 **OpenAI** (gpt-4o-mini + text-embedding-3-small@1024차원). 언어는 **영어 기본·한국어 선택**.

---

## 1. Data Model (Drizzle)

v1.1 스키마 델타가 아래에 이미 통합돼 있다 (locale, push token, URL dedup 등).

### users
- id UUID PK
- auth_provider TEXT ('apple'|'google'|'dev'), auth_id TEXT, UNIQUE(auth_provider, auth_id)
- display_name TEXT
- **locale TEXT NOT NULL DEFAULT 'en'** — 'en'|'ko'. Rudy가 사용자에게 말하는 언어. 모든 AI 산출물 언어 결정.
- notify_time TIME DEFAULT '08:00'
- **timezone TEXT** — 기본값 없음. 가입/온보딩 시 디바이스 tz 전송, 폴백 'UTC'. (IANA)
- **expo_push_token TEXT NULL** — 단일 디바이스 가정 (devices 테이블 없음)
- **hide_notification_content BOOL NOT NULL DEFAULT false** — 잠금화면 내용 숨김 토글
- onboarding_interests TEXT[]
- created_at, updated_at

### memories
- id UUID PK, user_id FK
- type TEXT: 'link' | 'thought' | 'image'  (image 분석은 M4)
- source_url TEXT NULL
- **source_url_normalized TEXT NULL** — youtu.be/watch/shorts 통일, utm·추적 파라미터 제거
- raw_text TEXT NULL
- title TEXT, thumbnail_url TEXT NULL
- summary TEXT NULL, content_type TEXT NULL (video|article|product|place|idea|other)
- topics TEXT[] DEFAULT '{}'
- inferred_intent TEXT NULL (learn|do|go|buy|remember|inspire)
- time_sensitivity TEXT NULL (evergreen|seasonal|dated|event_bound), expires_at TIMESTAMPTZ NULL
- embedding VECTOR(1024) NULL
- analysis_status TEXT DEFAULT 'pending' (pending|ready|degraded|failed)
- last_surfaced_at TIMESTAMPTZ NULL, surface_count INT DEFAULT 0
- suppressed_until TIMESTAMPTZ NULL, is_excluded BOOL DEFAULT false
- link_alive BOOL DEFAULT true
- created_at, updated_at, deleted_at (soft delete)
- INDEX (user_id, created_at DESC), (user_id, analysis_status)
- **partial UNIQUE (user_id, source_url_normalized) WHERE deleted_at IS NULL AND type='link'**
- **embedding: 벡터 인덱스(HNSW) 생성 보류 — 정확 스캔.** 수십만 행 도달 시 v1.x에서 HNSW+iterative_scan. (F7)

### interests
- id UUID PK, user_id FK
- name TEXT (AI 생성 또는 온보딩 라벨), centroid VECTOR(1024)
- memory_count INT, strength FLOAT, momentum FLOAT
- status TEXT (rising|stable|dormant), is_hidden BOOL DEFAULT false
- last_engaged_at, created_at, updated_at

### memory_interests
- memory_id FK, interest_id FK, similarity FLOAT, PK(memory_id, interest_id)

### memory_links
- id UUID PK, memory_a FK, memory_b FK (memory_a < memory_b 정규화)
- link_type TEXT (same_topic|temporal), similarity FLOAT, created_at
- **UNIQUE(memory_a, memory_b)** — 재분석 시 중복 엣지 방지

### daily_briefs
- id UUID PK, user_id FK, brief_date DATE (사용자 로컬 날짜), UNIQUE(user_id, brief_date)
- greeting TEXT, closing TEXT
- status TEXT (generated|fallback)
- generated_at

### brief_cards
- id UUID PK, brief_id FK, memory_id FK NULL
- external_content JSONB NULL — coldstart discovery용 {url,title,thumbnail_url,source}
- card_type TEXT (rediscovery|discovery|reflection)
- reason_code TEXT (timing|rising_interest|maturity|connection|surprise|cold_start)
- curation_reason TEXT, position INT (0 = hero)
- score FLOAT, score_breakdown JSONB

### card_feedbacks
- id UUID PK, card_id FK, user_id FK
- action TEXT (open_external|open_detail|like|not_today|never|impression), created_at
- **partial UNIQUE (card_id) WHERE action='impression'** + ON CONFLICT DO NOTHING (재전송 내성)
- 처리 규칙: not_today → memory.suppressed_until = now()+14d / never → memory.is_excluded = true
- **memory_id NULL 카드(discovery)면 상태 변경 스킵, 기록만.** (null 참조 방지)

### user_model
- user_id PK, format_preference JSONB, reason_type_affinity JSONB, updated_at
- MVP는 테이블만. 주간 배치는 스텁.

---

## 2. API (Fastify 5, /v1, JWT Bearer)

- zod 스키마는 `/packages/shared`에 정의, api·모바일 공유 (`fastify-type-provider-zod`).
- **에러 envelope**: `{ error: { code: string, message: string } }` + HTTP 상태코드.
- **페이지네이션**: cursor = `base64(created_at + ':' + id)`, 응답 `{ items, next_cursor|null }`.
- `@fastify/rate-limit` 기본 장착 (POST /memories는 LLM 비용 유발 공개 엔드포인트).

### Auth
- **POST /auth/dev** { email } → { token, user }  — `AUTH_DEV_MODE=true`일 때만. prod 빌드에서 차단.
- POST /auth/apple, POST /auth/google → { token, user }  — **M4**.
- JWT 만료 30일, refresh 토큰 없음.

### Uploads (M4)
- **POST /uploads** — multipart 1파일(image/*, ≤10MB) → StoragePort 저장 → { key, url }.
  image memory는 이 url을 POST /memories의 `image_url`로 전달한다.

### Memories
- **POST /memories** body: { type, source_url?, raw_text?, user_note?, shared_from?, image_url? }
  - image 타입은 image_url 필수 (POST /uploads 결과).
  - DB insert → ingest 큐 enqueue → 즉시 201 { id, analysis_status:'pending' }.
  - **p95 300ms. AI 호출을 이 경로에 절대 넣지 않는다.**
  - URL 정규화 충돌 시 **기존 memory 반환**(user_note 있으면 raw_text에 append, updated_at 갱신). (F4)
- GET /memories?cursor=&limit=30&interest_id=
- GET /memories/:id → understanding + linked memories(top 3)
- PATCH /memories/:id (raw_text/user_note 수정)
- DELETE /memories/:id (soft delete)
- **POST /memories/search** { query } → 쿼리 임베딩 → pgvector cosine top 20  (**M2 산출물**)

### Brief
- **GET /briefs/today**
  - 오늘(사용자 tz) brief 존재 → 반환.
  - 없으면 동기 fallback/coldstart 생성 후 반환 (§4). **빈 응답 금지.**
  - 카드에 primary_action: { type:'deeplink'|'detail', url? }. YouTube는 youtube:// 딥링크, 실패 시 https.
- POST /briefs/cards/:cardId/feedback { action }

### Interests
- GET /interests (is_hidden=false만)
- GET /interests/:id/memories
- PATCH /interests/:id { is_hidden }

### User
- GET /me, PATCH /me { notify_time, timezone, display_name, locale, expo_push_token, hide_notification_content }
  - locale 변경: 오늘 brief 유지, **다음 brief부터 새 언어**.
- **POST /me/onboarding** { interests: [{ key?: string, label: string }] }
  - 프리셋 칩은 key+locale 라벨, 자유 입력은 label만. interest.name = label, 임베딩도 label로 생성.
  - coldstart 매칭은 key 기준 (자유 입력은 미매칭 허용). **관심사 → interests 레코드 즉시 생성** (§5).
- DELETE /me (soft delete + 30일 후 hard delete job은 스텁)

---

## 3. Ingestion Pipeline (worker)

큐: `ingest`. 재시도 3회(backoff). 최종 실패 시 analysis_status='degraded', title 없으면 URL 도메인 사용. **Memory는 항상 유지.**

**모든 서버측 URL fetch는 `safeFetch` 공용 유틸 경유** (ingestion + 링크 체커 공유):
DNS resolve 후 사설/링크로컬 IP 차단(169.254.x, localhost, 10.x 등), redirect ≤3(hop마다 재검증), http(s)만, 응답 2MB cap, timeout 3s. (SSRF 방어, F5)

단계:
1. 콘텐츠 추출
   - YouTube URL: oEmbed로 제목/썸네일/채널. oEmbed 실패해도 videoId 기반 `i.ytimg.com` 썸네일 폴백. 자막 MVP 제외.
   - 일반 웹: safeFetch → OG 태그(og → twitter 폴백) + readability 본문 (최대 3000자).
   - 이미지: **M4** (StoragePort 저장 + vision 한 줄 설명). M1~M3는 API만 받고 분석 비활성.
   - thought: raw_text 그대로.
2. LLM 분석 (단일 호출, **OpenAI Structured Outputs `response_format: json_schema, strict:true`**)
   입력: 제목, 본문 발췌, 사용자 메모, 저장 시각. 출력 언어 = user.locale.
   출력: { summary, content_type, topics[3~6], inferred_intent, time_sensitivity, expires_at? }
3. 임베딩: `title + summary + topics` 연결 → text-embedding-3-small, dimensions:1024.
4. 연결 생성: 같은 user memory 중 cosine ≥ 0.82 → memory_links top 3.
5. 관심사 배정: 기존 interest centroid와 cosine ≥ 0.75면 배정 (재클러스터링은 §5 배치).
6. analysis_status = 'ready'.

---

## 4. Daily Brief Pipeline (worker) — 핵심 로직

스케줄: 15분 tick. Luxon으로 사용자 tz 로컬 계산, 창은 반열림 `[notify_time−2h, notify_time−1.75h)`.
`brief_date` = 사용자 로컬 날짜. 생성 전 존재 체크 + DB UNIQUE 이중 방어(`ON CONFLICT DO NOTHING`).
tick 밀린 사용자는 다음 tick "notify_time 이전 && 오늘 brief 없음"으로 보충. (F9/#9)

### 4.1 후보 수집 (user별)
- **Rediscovery**: analysis_status='ready', is_excluded=false, suppressed_until < now,
  (last_surfaced_at IS NULL OR < now−21d), dated & expires_at<now 제외, link_alive=true.
  - **쿨다운 단계 완화**: 후보 < 3장이면 쿨다운 21→7→0일 순으로 완화해 재수집 (앙상한 Home 방지).
    never(is_excluded)·suppress·죽은 링크 제외는 완화해도 유지.
- **Reflection**: momentum ≥ 0.5인 rising interest 있을 때만 1건. (momentum은 M5 전까진 0 → 자연히 미생성)
- **Discovery**: memory 수 < 15인 콜드스타트 사용자 **또는 rediscovery 후보 < 3장일 때 보충**.
  `/config/coldstart_sources.json` 화이트리스트에서 온보딩 관심사 key 매칭, 미매칭이면 프리셋 전체 풀.

### 4.2 스코어링 (결정적, LLM 금지 — 상수는 `/config/scoring.ts` 한 파일)
```
score = 0.35*interest_alignment   // memory↔rising/stable interest 최대 cosine
      + 0.20*timing_fit           // intent×요일 매트릭스
      + 0.20*maturity             // intent별 곡선
      + 0.15*novelty              // 1 − min(surface_count/3, 1)
      + 0.10*feedback             // 같은 topics 과거 like/open 비율, 무데이터 0.5
```
- timing_fit: go & 금~일 → 1.0 / 그 외 go → 0.4 / learn & rising 매칭 → 1.0 / 아니면 0.5 / 나머지 0.6.
- maturity (경과일 d): go: d≥3→1.0 else 0.3 / learn: 피크 30일 사인(0.5~1.0) / buy: d∈[7,21]→1.0 이후 0.4 /
  idea: d∈{14±3,30±5,90±10}→1.0 밖 0.3 / 기타 0.6.

### 4.3 구성 규칙
- 카드 3~5장. position 0(hero)=최고점 rediscovery. rediscovery 0건이면 discovery가 hero.
- rediscovery ≥ 50%, reflection ≤ 1장, 같은 interest ≤ 2장. 후보 3장 미만이면 있는 만큼 (최소 1장).
- **링크 검증(#6)**: 최종 선정 카드 3~5장만. HEAD → 실패 시 GET+Range:bytes=0-0 폴백, timeout 3s.
  4xx(405 제외)/네트워크 오류만 dead → link_alive=false + 차순위 교체 후 재검증. (safeFetch 경유)

### 4.4 문구 생성 (LLM 1회 호출)
- 선택 카드 전체 + greeting/closing 단일 프롬프트 배치 생성, JSON 출력. 언어 = user.locale.
- 입력: 카드별 {title, summary, user_note, reason_code, 경과일}, 오늘 날짜/요일, 사용자 이름.
- **§11 톤 가이드(locale별) 시스템 프롬프트 포함.** 금지어 필터 실패 → 1회 재생성 → 또 실패 시 reason_code별 템플릿.

### 4.5 Fallback vs Coldstart (분리된 경로 — 둘 다 카드 ≥ 3장, status='fallback')
- **Coldstart** (memory < 15 && 오늘 brief 없음): 최근 memory 최대 3장(reason_code='cold_start')
  + 온보딩 관심사 매칭 discovery 2장. memory 0건이면 discovery 3장.
- **Fallback** (생성 실패 시): 최근 memory 3건(시간 역순) + 템플릿 greeting. 3건 미만이면 discovery로 보충.
- 둘 다 **status='fallback'으로 저장** — 배치의 정식 엔진이 이후 승격할 수 있어야 한다.
  (coldstart를 'generated'로 저장하면 하루 종일 앙상한 브리핑에 갇힌다 — 결함 수정됨.)
- 동시성: `INSERT ... ON CONFLICT DO NOTHING` 후 재조회.
- **승격 규칙**: 배치는 status='fallback'이고 **카드 피드백(impression 포함) 0건**인 brief만 교체 가능. (#2)

### 4.6 알림 (push)
- brief 생성 완료 시 **BullMQ delayed job**(delay = notify_time − now). "예약 발송" API는 없음. (#3)
- jobId = `push:{userId}:{briefDate}` 멱등. notify_time 변경 시 기존 job 제거 후 재등록.
- 문구: hero 카드 예고 1문장, 언어 = user.locale. 잠금화면: hide_notification_content=true면 "오늘의 Home이 준비됐어요".
- 발송 결과 `DeviceNotRegistered` → users.expo_push_token = NULL. (H8, M4)

---

## 5. Interest Engine (worker, 일 1회 새벽 배치 — M5)

**중요**: 온보딩에서 interests가 이미 생성돼 있다(칩 라벨 임베딩 → centroid, strength=0.5, status='stable').
이 배치는 "생성"이 아니라 **재클러스터링·보정** 역할. (#1)

- user별 ready memory 임베딩 클러스터링 (k-means, k=⌈n/8⌉ 최대 10, min cluster size 3).
- **reconcile (상태 보존)**: 새 클러스터 centroid ↔ 기존 interest centroid cosine ≥ 0.8 → 기존 레코드
  **in-place 갱신**(name·is_hidden 보존), 미매칭만 신규 생성, 고아 interest는 삭제 대신 dormant. (F6)
- 신규 클러스터 이름: LLM 생성. locale별 규칙 — ko "2~6자 명사구" / en "1~3단어 명사구".
- strength: Σ(exp(−age_days/60)) 정규화 0~1.
- momentum: (최근 14일 신규) / (이전 14일 신규 + 1), 0~1 클리핑.
- status: momentum ≥ 0.5 → rising / strength < 0.1 → dormant / 그 외 stable.

---

## 6. i18n (영어 기본, 한국어 선택)

- `users.locale` ('en' 기본)이 모든 AI 산출물 언어 결정: summary, interest 이름, curation_reason, greeting/closing, 푸시.
  (저장물 콘텐츠 언어와 무관 — Rudy가 사용자에게 말하는 언어.)
- **톤/금지어 언어별 분리**: `/config/tone/en.ts`(1순위) + `/config/tone/ko.ts`.
  - en 금지어 예: "you still haven't", "piling up", "don't forget", "overdue", "backlog", "it's been N days", "finally get to".
  - curation_reason 길이: **en 120자 / ko 60자**.
- 임베딩은 변경 없음 (다국어 단일 벡터공간).
- 정적 UI 카피: **en을 원문으로 먼저 작성**, ko는 대응 번역. i18n 리소스 파일이 카피 단일 소스. (H7)
- coldstart_sources.json 구조: `{ interestKey: { en: [...], ko: [...] } }`. **en 소스 1순위 작성.**

---

## 7. Storage (StoragePort — M4)

- 인터페이스 put/getPublicUrl/**getBytes** (getBytes는 vision 분석용 — 로컬 URL은 OpenAI가 못 읽어 base64 전달 필요).
- dev = API 로컬 디스크(`/uploads` static, `UPLOADS_DIR` 공유 — api·worker 동일 경로), prod = S3 호환 (**MVP 미구현** — env=s3면 부팅 에러).
- env: `STORAGE_DRIVER=local|s3`, `UPLOADS_DIR`, `PUBLIC_BASE_URL` (+ S3 3종은 v1.x).

---

## 8. Env Vars

```
# AI (OpenAI)
OPENAI_API_KEY, OPENAI_MODEL=gpt-4o-mini, OPENAI_MODEL_REASON=gpt-4o-mini,
OPENAI_EMBEDDING_MODEL=text-embedding-3-small, EMBEDDING_DIMENSIONS=1024
# Infra
DATABASE_URL, REDIS_URL
# Auth
JWT_SECRET, AUTH_DEV_MODE=true
# Storage
STORAGE_DRIVER=local|s3 (+ S3_BUCKET, S3_REGION, S3_ENDPOINT)
# M4+
APPLE_CLIENT_ID, GOOGLE_CLIENT_ID, EXPO_ACCESS_TOKEN
```
`LlmPort`/`EmbeddingPort`/`StoragePort` 인터페이스로 추상화 — 제공자 교체 가능.

---

## 9. Copy & Tone Guide

- 담백하고 따뜻한 존댓말/정중한 영어. 이모지 금지. 느낌표 최대 1개.
- 과거 저장물은 항상 자산/선물 프레임: "그때 남겨둔", "지금 보면 좋을 타이밍".
- 제안형 어미: "~어때요?", "~해도 좋겠어요" / en 대응.
- 금지어(ko): "아직", "안 봤", "밀려", "잊고", "벌써", "이번엔 꼭", "N일째", "쌓여". en은 §6 목록.
- curation_reason: 1~2문장, en 120자 / ko 60자 이내.
