import type { ToneGuide } from './types';

/** 한국어 톤 가이드 (docs/spec.md §9 — 담백하고 따뜻한 존댓말, 죄책감 프레임 금지). */
export const toneKo: ToneGuide = {
  reasonMaxLen: 60,
  forbidden: [
    /아직/,
    /안 봤/,
    /밀려/,
    /잊고/,
    /벌써/,
    /이번엔 꼭/,
    /\d+\s*일째/,
    /쌓여/,
  ],
  styleRules: [
    '담백하고 따뜻한 존댓말. 이모지 금지. 느낌표는 전체에서 최대 1개.',
    '과거 저장물은 항상 자산/선물 프레임: "그때 남겨둔", "지금 보면 좋을 타이밍".',
    '제안형 어미를 쓴다: "~어때요?", "~해도 좋겠어요". 명령·재촉 금지.',
    '미확인 수, 경과 일수 등 죄책감이나 의무감을 주는 표현을 절대 쓰지 않는다.',
    '각 큐레이션 이유는 1~2문장, 60자 이내.',
  ],
  templates: {
    greeting: (name) =>
      name
        ? `좋은 아침이에요, ${name}님. 오늘 다시 보면 좋을 것들을 골라봤어요.`
        : '좋은 아침이에요. 오늘 다시 보면 좋을 것들을 골라봤어요.',
    fallbackGreeting: '최근에 남겨둔 것들을 모아봤어요.',
    closing: '오늘은 여기까지예요. 내일 또 만나요.',
    reasons: {
      timing: '지금 다시 보기 좋은 타이밍이에요.',
      rising_interest: '요즘 이 주제에 마음이 가 있는 것 같아요.',
      maturity: '시간이 지난 지금 보면 새롭게 읽힐 거예요.',
      connection: '남겨둔 다른 기억들과 이어져 있어요.',
      surprise: '조금 결이 다른 걸 하나 골라봤어요.',
      cold_start: '방금 남긴 기억이에요. Rudy가 이렇게 이해했어요.',
    },
    fallbackReasons: [
      '최근에 남겨둔 기억이에요. 다시 봐도 좋겠어요.',
      '저장해두고 지나쳤던 것, 지금 보면 새로울 거예요.',
      '얼마 전의 내가 골라둔 것이에요.',
    ],
    coldstartDiscoveryReason: (interestLabel) => `${interestLabel}에 관심이 있다고 하셔서 골라봤어요.`,
    pushPreview: (heroTitle) => `아침 브리핑이 준비됐어요 — "${heroTitle}"부터 볼까요.`,
    pushHidden: '오늘의 Home이 준비됐어요.',
  },
};
