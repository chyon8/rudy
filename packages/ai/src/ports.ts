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

/** LLM 분석(ingestion)·문구 생성(brief)을 담당. 제공자 교체 가능하도록 추상화. */
export interface LlmPort {
  analyzeMemory(input: AnalyzeInput): Promise<LlmAnalysis>;
}

/** 임베딩 생성. 차원은 구현체가 env로 주입받는다 (기본 1024). */
export interface EmbeddingPort {
  embed(text: string): Promise<number[]>;
}
