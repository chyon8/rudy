import { describe, expect, it } from 'vitest';
import { canPromote, isInGenerationWindow, timeToMinutes } from './window';

describe('생성 창 (PLAN #9)', () => {
  it("'HH:MM(:SS)' 파싱", () => {
    expect(timeToMinutes('08:00:00')).toBe(480);
    expect(timeToMinutes('08:30')).toBe(510);
  });

  it('[notify−2h, notify) 반열림 창', () => {
    expect(isInGenerationWindow(360, 480)).toBe(true); // 06:00
    expect(isInGenerationWindow(479, 480)).toBe(true); // 07:59
    expect(isInGenerationWindow(480, 480)).toBe(false); // 08:00 — notify 이후 생성 안 함
    expect(isInGenerationWindow(359, 480)).toBe(false); // 05:59
  });

  it('notify가 02:00 이전이면 자정으로 클램프', () => {
    expect(isInGenerationWindow(30, 60)).toBe(true); // notify 01:00, 현재 00:30
    expect(isInGenerationWindow(60, 60)).toBe(false);
  });
});

describe('fallback 승격 규칙 (PLAN #2) — 같은 날 이중 생성 방지의 유일한 예외', () => {
  it('fallback + 피드백 0건만 승격 가능', () => {
    expect(canPromote('fallback', 0)).toBe(true);
  });
  it('피드백(impression 포함)이 있으면 유지', () => {
    expect(canPromote('fallback', 1)).toBe(false);
  });
  it('정식 브리핑은 절대 재생성하지 않는다 (하루 1회 원칙)', () => {
    expect(canPromote('generated', 0)).toBe(false);
  });
});
