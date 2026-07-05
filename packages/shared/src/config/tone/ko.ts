import type { ToneGuide } from './types';

/**
 * 한국어 톤 가이드 (docs/spec.md §9) — 담백하고 친근한 반말(해체), 죄책감 프레임 금지.
 * Rudy는 콘텐츠를 설명하지 않고, 너와 그것의 관계(시간·행동·관심)를 말한다.
 */
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
    '담백하고 친근한 반말(해체). 이모지 금지. 느낌표는 전체에서 최대 1개.',
    '콘텐츠를 요약하지 말고, 사용자와 그것의 관계를 말한다: "네가 저장한", "요즘 너는".',
    '과거 저장물은 항상 자산/선물 프레임: "그때 남겨둔", "지금 보면 좋을 타이밍".',
    '제안형 어미를 쓴다: "~볼까", "~좋겠어". 명령·재촉 금지.',
    '미확인 수 등 죄책감이나 의무감을 주는 표현을 절대 쓰지 않는다.',
    '각 큐레이션 이유는 1~2문장, 60자 이내.',
  ],
  templates: {
    greeting: (name) =>
      name
        ? `좋은 아침, ${name}. 오늘 다시 볼 만한 걸 골라왔어.`
        : '좋은 아침. 오늘 다시 볼 만한 걸 골라왔어.',
    fallbackGreeting: '최근에 남겨둔 것들을 모아왔어.',
    closing: '오늘은 여기까지. 내일 또 올게.',
    reasons: {
      timing: '지금이 다시 보기 좋은 타이밍이야.',
      rising_interest: '요즘 이 주제에 마음이 가 있잖아.',
      maturity: '시간이 지난 지금 보면 새롭게 읽힐 거야.',
      connection: '네가 남긴 다른 기억들과 이어져 있어.',
      surprise: '일부러 결이 다른 걸 하나 골랐어.',
      cold_start: '방금 남긴 기억이야. Rudy는 이렇게 읽었어.',
    },
    fallbackReasons: [
      '최근에 남겨둔 기억이야. 다시 봐도 좋겠어.',
      '저장해두고 지나쳤던 것. 지금 보면 새로울 거야.',
      '얼마 전의 네가 골라둔 거야.',
    ],
    // 주어는 항상 '너' — 콘텐츠 설명 금지, 너와 그것의 관계만 말한다.
    reasonFor: (code, f) => {
      const d = Math.max(1, Math.floor(f.ageDays));
      switch (code) {
        case 'maturity':
          return `저장한 지 ${d}일. 지금 보면 다르게 읽힐지도.`;
        case 'connection':
          return '네가 남긴 다른 기억들과 이어져 있어.';
        case 'rising_interest':
          return f.interestName
            ? `요즘 ${f.interestName} 쪽으로 마음이 가 있잖아.`
            : '요즘 이 주제 주변을 맴돌고 있잖아.';
        case 'timing':
          return d <= 1
            ? '막 저장한 것. 오늘 한번 제대로 볼까.'
            : `저장한 지 ${d}일. 오늘이 다시 보기 좋은 날이야.`;
        case 'surprise':
          // 경과일을 섞어 같은 문장 반복을 피한다.
          return d > 1 ? `결이 다른 걸 하나. ${d}일 전의 네가 남긴 거야.` : '일부러 결이 다른 걸 하나 골랐어.';
        case 'cold_start':
          return '방금 남긴 것. Rudy는 이렇게 읽었어.';
      }
    },
    narrativeGreeting: (interestName) => `오늘은 ${interestName} 얘기가 유독 많네.`,
    discoveryReason: '네 관심사 근처에서 찾아온, 저장하지 않은 새 거야.',
    coldstartDiscoveryReason: (interestLabel) => `${interestLabel}에 관심 있다고 해서 골라왔어.`,
    pushPreview: (heroTitle) => `아침 브리핑 준비됐어 — "${heroTitle}"부터 볼까.`,
    pushHidden: '오늘의 Home이 준비됐어.',
  },
};
