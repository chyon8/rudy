import { describe, expect, it } from 'vitest';
import { isEligibleRediscovery, type RediscoveryCheck } from './eligibility';

const NOW = new Date('2026-07-04T09:00:00Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 24 * 60 * 60 * 1000);

const base = (over: Partial<RediscoveryCheck> = {}): RediscoveryCheck => ({
  analysisStatus: 'ready',
  deletedAt: null,
  isExcluded: false,
  suppressedUntil: null,
  lastSurfacedAt: null,
  timeSensitivity: 'evergreen',
  expiresAt: null,
  linkAlive: true,
  embedding: [0.1, 0.2],
  ...over,
});

describe('rediscovery 후보 자격 (§4.1)', () => {
  it('기본 ready memory는 후보', () => {
    expect(isEligibleRediscovery(base(), NOW)).toBe(true);
  });

  it('21일 쿨다운: 20일 전 노출은 제외, 22일 전은 후보', () => {
    expect(isEligibleRediscovery(base({ lastSurfacedAt: daysAgo(20) }), NOW)).toBe(false);
    expect(isEligibleRediscovery(base({ lastSurfacedAt: daysAgo(22) }), NOW)).toBe(true);
  });

  it('never 피드백(is_excluded)은 영구 제외', () => {
    expect(isEligibleRediscovery(base({ isExcluded: true }), NOW)).toBe(false);
  });

  it('not_today 억제 기간 중에는 제외, 지나면 복귀', () => {
    expect(isEligibleRediscovery(base({ suppressedUntil: daysAgo(-1) }), NOW)).toBe(false);
    expect(isEligibleRediscovery(base({ suppressedUntil: daysAgo(1) }), NOW)).toBe(true);
  });

  it('dated + expires_at 경과는 제외, 미래면 후보', () => {
    expect(
      isEligibleRediscovery(base({ timeSensitivity: 'dated', expiresAt: daysAgo(1) }), NOW),
    ).toBe(false);
    expect(
      isEligibleRediscovery(base({ timeSensitivity: 'dated', expiresAt: daysAgo(-1) }), NOW),
    ).toBe(true);
  });

  it('분석 미완료·삭제·죽은 링크·임베딩 없음은 제외', () => {
    expect(isEligibleRediscovery(base({ analysisStatus: 'pending' }), NOW)).toBe(false);
    expect(isEligibleRediscovery(base({ deletedAt: NOW }), NOW)).toBe(false);
    expect(isEligibleRediscovery(base({ linkAlive: false }), NOW)).toBe(false);
    expect(isEligibleRediscovery(base({ embedding: null }), NOW)).toBe(false);
  });
});
