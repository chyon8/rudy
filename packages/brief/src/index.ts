// Brief Engine — 스코어링·구성·문구. API(동기 생성)와 worker(스케줄러)가 같은 엔진을 쓴다.
export {
  createFallbackBrief,
  generateBriefForUser,
  type BriefDeps,
  type GenerateResult,
  type UserRow,
} from './generate';
export { canPromote, isInGenerationWindow, timeToMinutes } from './window';
