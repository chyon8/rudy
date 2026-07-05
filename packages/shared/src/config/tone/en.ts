import type { ToneGuide } from './types';

/** 영어 톤 가이드 — 타겟 언어라 1순위 (docs/spec.md §6, §9). */
export const toneEn: ToneGuide = {
  reasonMaxLen: 120,
  forbidden: [
    /you still haven'?t/i,
    /piling up/i,
    /don'?t forget/i,
    /overdue/i,
    /backlog/i,
    /it'?s been \d+ days?/i,
    /finally get to/i,
  ],
  styleRules: [
    'Plain, warm, unhurried English. No emoji. At most one exclamation mark total.',
    'Frame past saves as assets or gifts ("something you left for yourself"), never as debt.',
    'Suggest, never command: "might be worth a look", "could be a good moment".',
    'Never mention unread counts, elapsed days, or anything that implies guilt or obligation.',
    'Each curation reason is 1–2 sentences, at most 120 characters.',
  ],
  templates: {
    greeting: (name) =>
      name
        ? `Good morning, ${name}. A few things worth another look today.`
        : 'Good morning. A few things worth another look today.',
    fallbackGreeting: 'Here are a few things you saved recently.',
    closing: "That's all for today. See you tomorrow.",
    reasons: {
      timing: 'A good moment to come back to this one.',
      rising_interest: "You've been circling this topic lately — this fits right in.",
      maturity: 'This one has had time to settle. It may read differently now.',
      connection: "It connects with other things you've saved.",
      surprise: 'Something a little different from your collection.',
      cold_start: 'You saved this just now — here is how Rudy understood it.',
    },
    fallbackReasons: [
      'Something you saved recently, worth another look.',
      'This one has been sitting quietly since you saved it.',
      'A recent save — see if it still sparks something.',
    ],
    // 주어는 항상 '너' — 콘텐츠 설명 금지, 너와 그것의 관계만 말한다.
    reasonFor: (code, f) => {
      const d = Math.max(1, Math.floor(f.ageDays));
      switch (code) {
        case 'maturity':
          return `You saved this ${d} days ago. It might read differently now.`;
        case 'connection':
          return `This ties into other things you've been saving.`;
        case 'rising_interest':
          return f.interestName
            ? `You've been leaning into ${f.interestName} lately — this fits right in.`
            : `You've been circling this topic lately.`;
        case 'timing':
          return d <= 1
            ? 'You saved this just now — a good moment to actually take it in.'
            : `Saved ${d} days ago. Today feels like the right moment.`;
        case 'surprise':
          // 경과일을 섞어 같은 문장 반복을 피한다.
          return d > 1
            ? `A little off your usual path — you left this ${d} days ago.`
            : 'A little off your usual path — on purpose.';
        case 'cold_start':
          return "You saved this recently — here's how Rudy read it.";
      }
    },
    narrativeGreeting: (interestName) => `A lot of ${interestName} in your world today.`,
    discoveryReason: 'Found near your interests — something you did not save.',
    coldstartDiscoveryReason: (interestLabel) => `Picked for your interest in ${interestLabel}.`,
    pushPreview: (heroTitle) => `Your morning brief is ready — starting with "${heroTitle}".`,
    pushHidden: 'Your Home for today is ready.',
  },
};
