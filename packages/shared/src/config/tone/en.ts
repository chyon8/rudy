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
    coldstartDiscoveryReason: (interestLabel) => `Picked for your interest in ${interestLabel}.`,
    pushPreview: (heroTitle) => `Your morning brief is ready — starting with "${heroTitle}".`,
    pushHidden: 'Your Home for today is ready.',
  },
};
