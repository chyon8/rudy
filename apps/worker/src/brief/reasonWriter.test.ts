import type { BriefCopy, LlmPort } from '@rudy/ai';
import { getTone } from '@rudy/shared';
import { describe, expect, it } from 'vitest';
import { writeCopy, type CopyRequest } from './reasonWriter';

function fakeLlm(outputs: (BriefCopy | Error)[]): { llm: LlmPort; calls: () => number } {
  let n = 0;
  const llm: LlmPort = {
    analyzeMemory: () => Promise.reject(new Error('unused')),
    writeBriefCopy: () => {
      const out = outputs[Math.min(n++, outputs.length - 1)];
      return out instanceof Error ? Promise.reject(out) : Promise.resolve(out!);
    },
  };
  return { llm, calls: () => n };
}

const req: CopyRequest = {
  locale: 'en',
  userName: 'Sam',
  dateLabel: 'Friday, July 4',
  cards: [
    { title: 'Pasta video', reasonCode: 'timing', cardType: 'rediscovery', ageDays: 10 },
    { title: 'Design post', reasonCode: 'connection', cardType: 'rediscovery', ageDays: 30 },
  ],
};

const good: BriefCopy = {
  greeting: 'Good morning, Sam.',
  closing: 'See you tomorrow.',
  reasons: ['Weekend cooking energy — a good moment for this.', 'It pairs with your other design saves.'],
};

describe('reason writer 폴백 (§4.4)', () => {
  it('유효한 LLM 출력은 그대로 사용', async () => {
    const { llm, calls } = fakeLlm([good]);
    expect(await writeCopy(llm, req)).toEqual(good);
    expect(calls()).toBe(1);
  });

  it('금지어 출력 → 1회 재생성 → 성공하면 재생성본 사용', async () => {
    const bad: BriefCopy = { ...good, reasons: ["you still haven't watched this", good.reasons[1]!] };
    const { llm, calls } = fakeLlm([bad, good]);
    expect(await writeCopy(llm, req)).toEqual(good);
    expect(calls()).toBe(2);
  });

  it('2회 모두 실패하면 실패한 조각만 reason_code별 템플릿으로 교체', async () => {
    const bad: BriefCopy = { ...good, reasons: ['this is overdue', good.reasons[1]!] };
    const { llm } = fakeLlm([bad, bad]);
    const result = await writeCopy(llm, req);
    const tone = getTone('en');
    expect(result.reasons[0]).toBe(tone.templates.reasons.timing);
    expect(result.reasons[1]).toBe(good.reasons[1]); // 유효한 조각은 보존
    expect(result.greeting).toBe(good.greeting);
  });

  it('LLM 자체가 죽어도 템플릿으로 항상 결과를 낸다', async () => {
    const { llm } = fakeLlm([new Error('rate limited')]);
    const result = await writeCopy(llm, req);
    const tone = getTone('en');
    expect(result.greeting).toBe(tone.templates.greeting('Sam'));
    expect(result.reasons).toEqual([tone.templates.reasons.timing, tone.templates.reasons.connection]);
  });
});
