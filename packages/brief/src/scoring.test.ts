import { describe, expect, it } from 'vitest';
import { feedbackRatio, maturity, novelty, pickReasonCode, scoreMemory, timingFit } from './scoring';

describe('timing_fit (§4.2)', () => {
  it('go는 금~일 1.0, 평일 0.4', () => {
    expect(timingFit('go', 5, false)).toBe(1.0); // 금
    expect(timingFit('go', 7, false)).toBe(1.0); // 일
    expect(timingFit('go', 3, false)).toBe(0.4);
  });
  it('learn은 rising 매칭 1.0, 아니면 0.5, 나머지 intent 0.6', () => {
    expect(timingFit('learn', 2, true)).toBe(1.0);
    expect(timingFit('learn', 2, false)).toBe(0.5);
    expect(timingFit('remember', 2, false)).toBe(0.6);
  });
});

describe('maturity 곡선 (§4.2)', () => {
  it('go: 3일 이상 1.0, 미만 0.3', () => {
    expect(maturity('go', 5)).toBe(1.0);
    expect(maturity('go', 1)).toBe(0.3);
  });
  it('learn: 저장 직후 0.5 → 30일 피크 1.0 → 이후 0.5로', () => {
    expect(maturity('learn', 0)).toBeCloseTo(0.5);
    expect(maturity('learn', 30)).toBeCloseTo(1.0);
    expect(maturity('learn', 90)).toBeCloseTo(0.5);
  });
  it('buy: 7~21일 1.0, 이후 0.4', () => {
    expect(maturity('buy', 10)).toBe(1.0);
    expect(maturity('buy', 30)).toBe(0.4);
  });
  it('idea: 14±3 / 30±5 / 90±10 창에서 1.0, 밖 0.3', () => {
    expect(maturity('idea', 16)).toBe(1.0);
    expect(maturity('idea', 33)).toBe(1.0);
    expect(maturity('idea', 95)).toBe(1.0);
    expect(maturity('idea', 50)).toBe(0.3);
  });
});

describe('novelty·feedback·합산', () => {
  it('novelty = 1 − min(surface_count/3, 1)', () => {
    expect(novelty(0)).toBe(1);
    expect(novelty(3)).toBe(0);
    expect(novelty(6)).toBe(0);
  });

  it('피드백 무데이터는 0.5로', () => {
    const { breakdown } = scoreMemory({
      intent: 'learn',
      weekday: 2,
      ageDays: 30,
      surfaceCount: 0,
      interestAlignment: 1,
      risingMatch: true,
      feedbackRatio: null,
      hasLinks: false,
    });
    expect(breakdown.feedback).toBe(0.5);
  });

  it('모든 성분 1.0이면 score 1.0 (가중치 합 = 1)', () => {
    const { score } = scoreMemory({
      intent: 'learn',
      weekday: 2,
      ageDays: 30,
      surfaceCount: 0,
      interestAlignment: 1,
      risingMatch: true,
      feedbackRatio: 1,
      hasLinks: false,
    });
    expect(score).toBeCloseTo(1.0);
  });

  it('feedbackRatio: topic 집계에서 like/open 비율', () => {
    const stats = new Map([
      ['pasta', { pos: 2, imp: 4 }],
      ['seoul', { pos: 0, imp: 0 }],
    ]);
    expect(feedbackRatio(stats, ['pasta'])).toBe(0.5);
    expect(feedbackRatio(stats, ['none'])).toBeNull();
  });
});

describe('reason_code 판정', () => {
  const base = {
    intent: 'learn',
    weekday: 2,
    ageDays: 5,
    surfaceCount: 0,
    interestAlignment: 0.5,
    risingMatch: false,
    feedbackRatio: null,
    hasLinks: false,
  };
  it('rising 매칭이 최우선', () => {
    const input = { ...base, risingMatch: true, interestAlignment: 0.8 };
    const { breakdown } = scoreMemory(input);
    expect(pickReasonCode(input, breakdown)).toBe('rising_interest');
  });
  it('연결도 타이밍도 없으면 surprise', () => {
    const { breakdown } = scoreMemory(base);
    expect(pickReasonCode(base, breakdown)).toBe('surprise');
  });
  it('links 있으면 connection', () => {
    const input = { ...base, hasLinks: true };
    const { breakdown } = scoreMemory(input);
    expect(pickReasonCode(input, breakdown)).toBe('connection');
  });
});
