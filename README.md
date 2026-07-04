# Rudy

Personal AI Curator — 저장한 것들을 AI가 이해하고, 매일 아침 "오늘 다시 볼 가치가 있는 것"을
Home 브리핑으로 건네는 앱. 저장 앱이 아니라 **재발견 앱**.

## 문서 (읽는 순서 / 토큰 효율)

| 문서 | 역할 |
|---|---|
| [CLAUDE.md](./CLAUDE.md) | 제품 규칙·기술 스택·마일스톤·개발 워크플로 (항상 참조) |
| [docs/spec.md](./docs/spec.md) | 백엔드 스펙 단일 소스 — 데이터모델·API·파이프라인·env |
| [DESIGN.md](./DESIGN.md) | 모바일 UI 디자인 토큰·컴포넌트 단일 소스 (M3~) |
| [PLAN.md](./PLAN.md) | 결정 로그 — 10-pass 검증, 마일스톤 verify 기준 |
| [PRD.md](./PRD.md) | 제품 배경 — 페르소나·저니·지표 |

## 구조 (구현 후)

```
apps/mobile   Expo RN    apps/api   Fastify    apps/worker   BullMQ    packages/shared   contract
```

Stack: OpenAI (gpt-4o-mini + text-embedding-3-small) · Postgres+pgvector · Redis/BullMQ · Fastify · Expo.
