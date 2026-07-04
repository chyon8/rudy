import { describe, expect, it } from 'vitest';
import { pickColdstartCards, pickFallbackCards } from './brief';

const mem = (id: string, daysAgo: number) => ({
  id,
  createdAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
});

describe('coldstart 조립 (PLAN #7)', () => {
  it('memory 0건이어도 discovery로 카드 ≥ 1 (빈 Home 금지)', () => {
    const cards = pickColdstartCards([], ['cooking'], 'en');
    expect(cards.length).toBeGreaterThanOrEqual(1);
    expect(cards.every((c) => c.cardType === 'discovery')).toBe(true);
    expect(cards.every((c) => c.curationReason.length > 0)).toBe(true);
  });

  it('memory 1건이면 cold_start 카드가 hero(0번) + discovery 2장', () => {
    const cards = pickColdstartCards([mem('m1', 0)], ['cooking', 'fitness'], 'en');
    expect(cards[0]?.memoryId).toBe('m1');
    expect(cards[0]?.reasonCode).toBe('cold_start');
    expect(cards[0]?.position).toBe(0);
    expect(cards.filter((c) => c.cardType === 'discovery')).toHaveLength(2);
  });

  it('관심사 key가 하나도 매칭되지 않아도 전체 풀 폴백으로 카드 ≥ 1', () => {
    expect(pickColdstartCards([], [], 'en').length).toBeGreaterThanOrEqual(1);
    expect(pickColdstartCards([], ['자유입력-비프리셋'], 'ko').length).toBeGreaterThanOrEqual(1);
  });

  it('가장 최근 memory를 고른다', () => {
    const cards = pickColdstartCards([mem('old', 5), mem('new', 0)], ['tech'], 'en');
    expect(cards[0]?.memoryId).toBe('new');
  });
});

describe('fallback 조립 (§4.5)', () => {
  it('최근 memory 3건을 시간 역순으로', () => {
    const cards = pickFallbackCards([mem('a', 3), mem('b', 1), mem('c', 2), mem('d', 0)], 'ko');
    expect(cards.map((c) => c.memoryId)).toEqual(['d', 'b', 'c']);
    expect(cards.every((c) => c.curationReason.length > 0)).toBe(true);
  });

  it('memory가 3건 미만이면 있는 만큼', () => {
    expect(pickFallbackCards([mem('a', 0)], 'en')).toHaveLength(1);
  });
});
