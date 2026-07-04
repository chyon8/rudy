# CLAUDE.md — Rudy MVP

Rudy는 사용자가 저장한 것들(링크·생각·이미지)을 AI가 이해하고, 매일 아침 "오늘 다시 볼 가치가 있는 것"을
골라 브리핑(Home)으로 건네는 **Personal AI Curator**다. 저장 앱이 아니라 **재발견 앱**이다.
Home이 제품의 중심이고, 사용자를 앱 밖으로 내보내는 것이 성공이다.

이 문서는 매 세션 자동 로드되는 **라우터**다 — 항상 지켜야 할 규칙과, 상세 스펙 문서로 가는 지도.

## 📂 문서 지도 (필요할 때만 로드해서 토큰 절약)

| 문서 | 언제 읽나 | 내용 |
|---|---|---|
| **CLAUDE.md** (이 문서) | 항상 (자동) | 제품 규칙·기술 스택·마일스톤·개발 워크플로 |
| **docs/spec.md** | 백엔드(api/worker/shared) 작업 시 | 데이터모델·API·파이프라인·env — **스펙 단일 소스** |
| **DESIGN.md** | 모바일 UI(M3~) 작업 시 | 디자인 토큰·컴포넌트 — **스타일 단일 소스** |
| **PLAN.md** | 결정 근거가 궁금할 때 | 10-pass 검증 로그, 마일스톤 상세 + verify 기준 |
| **PRD.md** | 제품 배경/판단 기준이 필요할 때 | 페르소나·저니·지표 |

**우선순위**: 스펙 충돌 시 `docs/spec.md`(백엔드)·`DESIGN.md`(UI)가 최종 소스. 근거는 PLAN.md.
CLAUDE.md 규칙과 충돌하는 판단이 필요하면 멈추고 질문.

**확정 사실 (오해 주의)**: AI = **OpenAI** (gpt-4o-mini + text-embedding-3-small @1024차원). 언어 = **영어 기본·한국어 선택**(users.locale). dev auth 우선(소셜 로그인 M4). 마일스톤은 PLAN.md §4 순서.

## Product Rules (구현 중 판단 기준 — 위반 금지)

1. Home이 비어 있는 상태를 절대 만들지 않는다. 생성 실패 시 fallback 반환.
2. 미확인 카운트·뱃지·"N일째 안 읽음" 류의 죄책감 유발 UI/카피 금지.
3. 무한 스크롤·당겨서 새로고침·자동재생을 Home에 넣지 않는다. Home은 명시적 끝이 있다.
4. 브리핑은 하루 1회 생성. 당일 재생성 없음 (fallback 제외).
5. 사용자에게 폴더/태그/분류를 요구하는 UI 금지.
6. 채팅 기능 없음. 만들지 않는다.
7. 저장(POST /memories)은 어떤 경우에도 유실되지 않는다. AI 분석 실패와 저장 성공은 분리된다.
8. 모든 카드에는 curation_reason(왜 오늘 이것인가)이 있다.
9. AI가 생성하는 모든 사용자 노출 문구는 톤 가이드(docs/spec.md §9)를 따른다.

## Tech Stack (확정)

- **Mobile**: React Native (Expo), iOS 우선 / Android 빌드만. Share Extension은 config plugin + 네이티브 모듈.
- **Backend**: Node.js + TypeScript, Fastify 5 (`fastify-type-provider-zod`).
- **DB**: PostgreSQL 16 + pgvector, Drizzle ORM (vector는 customType, VECTOR(1024)).
- **Queue**: BullMQ (Redis) — `ingest`(재시도 3회), `brief`(15분 repeatable), `push`(delayed).
- **AI**: OpenAI. LLM=gpt-4o-mini(Structured Outputs), 임베딩=text-embedding-3-small(dimensions:1024).
  `LlmPort`/`EmbeddingPort`/`StoragePort` 인터페이스로 추상화.
- **Auth**: dev(`POST /auth/dev`, AUTH_DEV_MODE) 우선 / Apple+Google은 M4. 서버 JWT(만료 30일).
- **i18n**: i18next + expo-localization (M3 첫날 도입).
- **Time**: Luxon (IANA tz). **Test**: Vitest.
- **Monorepo** (pnpm workspaces, turbo 없음):

```
/apps/mobile      # Expo RN
/apps/api         # Fastify
/apps/worker      # BullMQ (ingestion, brief, interest engine)
/packages/shared  # 타입·zod 스키마·상수 (API contract 단일 소스)
```

상세(스키마·엔드포인트·파이프라인·env)는 **docs/spec.md**.

## Milestones (이 순서로 — 각 완료 기준은 PLAN.md §4)

- **M0** Skeleton: 모노레포·docker-compose·공통 설정·shared 골격·env 로더.
- **M1** Foundation: Drizzle 스키마+마이그레이션, dev auth, memories CRUD + search, ingestion 워커, onboarding.
- **M2** Brief Engine: 스코어링·구성·reason writer·금지어 필터·fallback/coldstart·GET /briefs/today·feedback·스케줄러·링크 검증.
- **M3** Mobile Core: Home·Card Detail·Capture·Library·온보딩·i18n.
- **M4** Share Extension + Push + 실제 인증: iOS 공유 확장·이미지 storage/vision·Apple/Google 로그인·푸시.
- **M5** Polish: Interest Engine 배치·reconcile·죽은 링크 표시·e2e·스코어링 튜닝.

## 개발 워크플로 (모든 파일 변경에 적용 — 예외 없음)

파일을 변경할 때마다 아래 순서를 지킨다:

1. **변경 설명** — 어떤 파일의 어떤 코드를, 무엇을, 왜 바꿨는지 설명한다.
2. **검토 체크리스트** — 사용자가 바뀐 기능을 어떻게 직접 확인하면 되는지 체크리스트로 준다.
3. **컨펌 대기 → git 메시지 제공** — 사용자가 컨펌하면 `git add` → `git commit` → `git push`까지
   **복붙 가능한 명령/메시지**를 준다.
   - **⛔ 절대 터미널에서 직접 실행하지 않는다.** 사용자가 복붙해서 직접 돌린다. (초기 setup 1회 푸시만 예외였음)
   - **커밋 메시지에 Co-Authored-By 등 AI 서명을 넣지 않는다.**

## Development Behavior — Karpathy Guidelines

주의 깊음 > 속도. 사소한 작업엔 판단껏 완화.

- **가정하지 말 것**: 구현 전 가정을 명시. 해석이 여러 개면 임의로 고르지 말고 제시. 불명확하면 멈추고 질문.
  판단 기준: Product Rules → docs/spec.md·DESIGN.md → PLAN.md → 그래도 모호하면 질문.
- **단순함 우선**: 요청받지 않은 기능·추상화·설정 옵션·유연성을 만들지 않는다. 1회용 코드에 추상화 금지.
  검증은 시스템 경계(사용자 입력·외부 API)에서만. "시니어가 과하다 할까?" → 그렇다면 단순화.
- **수술적 변경**: 건드려야 할 것만. 인접 코드·주석·포맷을 "개선"하지 않는다. 기존 스타일을 따른다.
  무관한 데드 코드는 언급만 하고 삭제하지 않는다. 내 변경으로 고아가 된 import/변수는 제거.
- **목표 주도**: 작업을 검증 가능한 목표로 변환("버그 수정"→"재현 테스트 작성 후 통과"). 멀티스텝은
  `단계 → verify` 형식 짧은 계획 먼저. 완료 보고는 사실대로 (테스트 실패는 출력과 함께).

## Out of Scope (요청받아도 문서 수정 없이는 만들지 않음)

채팅 UI / 폴더·수동 태그·정리 / 외부 OAuth 연동·YouTube API / Android 출시 품질·위젯·음성·Daily Notes·위치 트리거 /
사용자 콘텐츠의 모델 학습 사용(AI 호출은 no-retention).
(v1.5 파일 임포트 예정 → 대량 insert 막는 구조는 피할 것. v2 시청기록 momentum → 카드 재료로는 영구 금지.)
