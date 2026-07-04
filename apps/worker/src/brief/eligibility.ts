import { SCORING } from '@rudy/shared';

/** Rediscovery 후보 자격 판정에 필요한 memory 필드 (docs/spec.md §4.1). */
export interface RediscoveryCheck {
  analysisStatus: string;
  deletedAt: Date | null;
  isExcluded: boolean;
  suppressedUntil: Date | null;
  lastSurfacedAt: Date | null;
  timeSensitivity: string | null;
  expiresAt: Date | null;
  linkAlive: boolean;
  embedding: number[] | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Rediscovery 후보 필터 — SQL이 아닌 순수 함수로 두어 규칙을 단위 테스트한다
 * (사용자당 수백 행 규모라 앱단 필터로 충분, F7과 같은 단순화).
 */
export function isEligibleRediscovery(m: RediscoveryCheck, now: Date): boolean {
  if (m.analysisStatus !== 'ready' || m.deletedAt || m.embedding === null) return false;
  if (m.isExcluded) return false; // never 피드백 — 영구 제외
  if (m.suppressedUntil && m.suppressedUntil.getTime() >= now.getTime()) return false;
  if (
    m.lastSurfacedAt &&
    now.getTime() - m.lastSurfacedAt.getTime() < SCORING.surfaceCooldownDays * DAY_MS
  ) {
    return false; // 21일 쿨다운
  }
  if (m.timeSensitivity === 'dated' && m.expiresAt && m.expiresAt.getTime() < now.getTime()) {
    return false; // 유효기간 지난 dated
  }
  return m.linkAlive;
}
