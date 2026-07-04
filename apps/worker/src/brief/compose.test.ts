import { describe, expect, it } from 'vitest';
import { composeBrief, type ComposeCandidate } from './compose';

const cand = (over: Partial<ComposeCandidate> & { key: string }): ComposeCandidate => ({
  cardType: 'rediscovery',
  memoryId: over.key,
  externalContent: null,
  score: 0.5,
  breakdown: null,
  reasonCode: 'timing',
  interestId: null,
  ...over,
});

describe('구성 규칙 (§4.3)', () => {
  it('hero(0번)는 최고점 rediscovery — discovery 점수가 더 높아도', () => {
    const result = composeBrief([
      cand({ key: 'd1', cardType: 'discovery', memoryId: null, score: 0.9 }),
      cand({ key: 'r1', score: 0.6 }),
      cand({ key: 'r2', score: 0.4 }),
    ]);
    expect(result[0]?.key).toBe('r1');
  });

  it('rediscovery 0건이면 discovery가 hero', () => {
    const result = composeBrief([
      cand({ key: 'd1', cardType: 'discovery', memoryId: null, score: 0.3 }),
      cand({ key: 'd2', cardType: 'discovery', memoryId: null, score: 0.5 }),
    ]);
    expect(result[0]?.key).toBe('d2');
  });

  it('최대 5장', () => {
    const many = Array.from({ length: 10 }, (_, i) => cand({ key: `r${i}`, score: i / 10 }));
    expect(composeBrief(many)).toHaveLength(5);
  });

  it('후보가 3장 미만이면 있는 만큼 (최소 1장)', () => {
    expect(composeBrief([cand({ key: 'r1' })])).toHaveLength(1);
  });

  it('reflection ≤ 1장', () => {
    const result = composeBrief([
      cand({ key: 'r1', score: 0.9 }),
      cand({ key: 'r2', score: 0.8 }),
      cand({ key: 'ref1', cardType: 'reflection', memoryId: null, score: 0.7 }),
      cand({ key: 'ref2', cardType: 'reflection', memoryId: null, score: 0.6 }),
    ]);
    expect(result.filter((c) => c.cardType === 'reflection')).toHaveLength(1);
  });

  it('같은 interest ≤ 2장', () => {
    const result = composeBrief([
      cand({ key: 'a1', interestId: 'A', score: 0.9 }),
      cand({ key: 'a2', interestId: 'A', score: 0.8 }),
      cand({ key: 'a3', interestId: 'A', score: 0.7 }),
      cand({ key: 'b1', interestId: 'B', score: 0.1 }),
    ]);
    expect(result.filter((c) => c.interestId === 'A')).toHaveLength(2);
    expect(result.map((c) => c.key)).toContain('b1');
  });

  it('rediscovery가 있으면 비-rediscovery가 과반을 넘지 않는다 (≥50%)', () => {
    const result = composeBrief([
      cand({ key: 'r1', score: 0.9 }),
      cand({ key: 'd1', cardType: 'discovery', memoryId: null, score: 0.8 }),
      cand({ key: 'd2', cardType: 'discovery', memoryId: null, score: 0.7 }),
      cand({ key: 'd3', cardType: 'discovery', memoryId: null, score: 0.6 }),
    ]);
    const redis = result.filter((c) => c.cardType === 'rediscovery').length;
    expect(redis * 2).toBeGreaterThanOrEqual(result.length);
  });
});
