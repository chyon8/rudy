import { describe, expect, it } from 'vitest';
import { findToneViolation, getTone, isValidReason } from './index';

describe('금지어 필터 (en)', () => {
  it('죄책감 유발 표현을 잡는다', () => {
    expect(findToneViolation("you still haven't watched this", 'en')).not.toBeNull();
    expect(findToneViolation('your saves are piling up', 'en')).not.toBeNull();
    expect(findToneViolation("don't forget to read it", 'en')).not.toBeNull();
    expect(findToneViolation("it's been 5 days since you saved it", 'en')).not.toBeNull();
    expect(findToneViolation('this is overdue', 'en')).not.toBeNull();
  });

  it('담백한 문장은 통과한다', () => {
    expect(findToneViolation('A good moment to come back to this one.', 'en')).toBeNull();
  });

  it('길이 제한 120자를 넘으면 invalid', () => {
    expect(isValidReason('a'.repeat(121), 'en')).toBe(false);
    expect(isValidReason('a'.repeat(120), 'en')).toBe(true);
  });
});

describe('금지어 필터 (ko)', () => {
  it('죄책감 유발 표현을 잡는다', () => {
    expect(findToneViolation('아직 안 봤어요', 'ko')).not.toBeNull();
    expect(findToneViolation('저장한 지 5일째예요', 'ko')).not.toBeNull();
    expect(findToneViolation('기억이 쌓여 있어요', 'ko')).not.toBeNull();
    expect(findToneViolation('벌써 일주일이에요', 'ko')).not.toBeNull();
    expect(findToneViolation('이번엔 꼭 보세요', 'ko')).not.toBeNull();
  });

  it('담백한 문장은 통과한다', () => {
    expect(findToneViolation('지금 다시 보기 좋은 타이밍이에요.', 'ko')).toBeNull();
  });

  it('길이 제한 60자를 넘으면 invalid', () => {
    expect(isValidReason('가'.repeat(61), 'ko')).toBe(false);
    expect(isValidReason('가'.repeat(60), 'ko')).toBe(true);
  });
});

describe('템플릿 자체 검증', () => {
  it('모든 폴백 템플릿이 자기 locale 필터를 통과한다', () => {
    for (const locale of ['en', 'ko'] as const) {
      const tone = getTone(locale);
      expect(findToneViolation(tone.templates.greeting('Sam'), locale)).toBeNull();
      expect(findToneViolation(tone.templates.greeting(null), locale)).toBeNull();
      expect(findToneViolation(tone.templates.fallbackGreeting, locale)).toBeNull();
      expect(findToneViolation(tone.templates.closing, locale)).toBeNull();
      expect(isValidReason(tone.templates.fallbackReason, locale)).toBe(true);
      expect(isValidReason(tone.templates.coldstartDiscoveryReason('Cooking'), locale)).toBe(true);
      for (const reason of Object.values(tone.templates.reasons)) {
        expect(isValidReason(reason, locale)).toBe(true);
      }
    }
  });
});
