export type ReasonCode =
  | 'timing'
  | 'rising_interest'
  | 'maturity'
  | 'connection'
  | 'surprise'
  | 'cold_start';

/** 결정적 reason의 재료 — 스코어링이 계산해 둔 사실. 문구는 이 사실만 말한다. */
export interface ReasonFacts {
  /** 저장 후 경과일 (내림). */
  ageDays: number;
  /** rising_interest 매칭 시 관심사 이름. */
  interestName?: string | null;
}

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
    /**
     * '왜 오늘'의 뼈대 (docs/spec.md §4.4) — reason_code + 사실로 만드는 결정적 문구.
     * 주어는 항상 사용자(너의 시간·행동·관심)이며 콘텐츠 묘사를 하지 않는다. LLM은 hero 1장만.
     */
    reasonFor: (code: ReasonCode, facts: ReasonFacts) => string;
    /** 오늘 카드에 지배적 관심사가 있는 날의 서사 인사말 — 억지 테마 금지, 있는 날만. */
    narrativeGreeting: (interestName: string) => string;
    /** discovery 카드용 일반 이유 (관심사 라벨을 모를 때). */
    discoveryReason: string;
    coldstartDiscoveryReason: (interestLabel: string) => string;
    /** 푸시: hero 카드 예고 1문장 (§4.6). */
    pushPreview: (heroTitle: string) => string;
    /** 푸시: 잠금화면 내용 숨김 시 문구. */
    pushHidden: string;
  };
}
