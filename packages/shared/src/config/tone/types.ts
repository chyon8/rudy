export type ReasonCode =
  | 'timing'
  | 'rising_interest'
  | 'maturity'
  | 'connection'
  | 'surprise'
  | 'cold_start';

export interface ToneGuide {
  /** curation_reason 최대 길이 (en 120 / ko 60). */
  reasonMaxLen: number;
  /** 죄책감 유발 금지어 — 하나라도 매칭되면 필터 실패. */
  forbidden: RegExp[];
  /** reason writer 시스템 프롬프트에 그대로 들어가는 스타일 규칙. */
  styleRules: string[];
  templates: {
    greeting: (name: string | null) => string;
    fallbackGreeting: string;
    closing: string;
    /** 금지어 필터 2회 실패 시 쓰는 reason_code별 정적 템플릿. */
    reasons: Record<ReasonCode, string>;
    /** fallback 브리핑 카드용 정적 이유 — 카드마다 회전시켜 같은 문장 반복을 막는다. */
    fallbackReasons: string[];
    coldstartDiscoveryReason: (interestLabel: string) => string;
    /** 푸시: hero 카드 예고 1문장 (§4.6). */
    pushPreview: (heroTitle: string) => string;
    /** 푸시: 잠금화면 내용 숨김 시 문구. */
    pushHidden: string;
  };
}
