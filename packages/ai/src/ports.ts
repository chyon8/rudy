export type Locale = 'en' | 'ko';

export interface AnalyzeInput {
  title?: string;
  body?: string;
  userNote?: string;
  savedAt: string; // ISO
  locale: Locale;
}

export interface LlmAnalysis {
  summary: string;
  contentType: 'video' | 'article' | 'product' | 'place' | 'idea' | 'other';
  topics: string[];
  inferredIntent: 'learn' | 'do' | 'go' | 'buy' | 'remember' | 'inspire';
  timeSensitivity: 'evergreen' | 'seasonal' | 'dated' | 'event_bound';
  expiresAt: string | null;
}

export interface BriefCopyCard {
  title: string;
  summary?: string;
  userNote?: string;
  reasonCode: string;
  cardType: string;
  ageDays: number;
}

export interface BriefCopyInput {
  locale: Locale;
  userName?: string;
  /** 사용자 로컬 날짜·요일 라벨 (예: "Friday, July 4"). */
  dateLabel: string;
  cards: BriefCopyCard[];
  /** 톤 가이드 규칙 — 호출자가 locale별 규칙(shared config)을 넘긴다. */
  styleRules: string[];
  /** curation_reason 최대 길이. */
  reasonMaxLen: number;
}

export interface BriefCopy {
  greeting: string;
  closing: string;
  /** cards와 같은 순서의 curation_reason. */
  reasons: string[];
}

/** LLM 분석(ingestion)·문구 생성(brief)을 담당. 제공자 교체 가능하도록 추상화. */
export interface LlmPort {
  analyzeMemory(input: AnalyzeInput): Promise<LlmAnalysis>;
  writeBriefCopy(input: BriefCopyInput): Promise<BriefCopy>;
}

/** 임베딩 생성. 차원은 구현체가 env로 주입받는다 (기본 1024). */
export interface EmbeddingPort {
  embed(text: string): Promise<number[]>;
}
