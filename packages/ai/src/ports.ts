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
  /** reason의 구체성 재료 — 콘텐츠 근거 없는 감성 문구 방지. */
  topics?: string[];
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

export interface DescribeImageInput {
  imageBase64: string;
  mimeType: string;
  locale: Locale;
}

export interface NameInterestInput {
  locale: Locale;
  /** 클러스터 대표 memory들의 제목·토픽 샘플 (최대 10개). */
  samples: { title: string; topics: string[] }[];
}

/** LLM 분석(ingestion)·문구 생성(brief)을 담당. 제공자 교체 가능하도록 추상화. */
export interface LlmPort {
  analyzeMemory(input: AnalyzeInput): Promise<LlmAnalysis>;
  writeBriefCopy(input: BriefCopyInput): Promise<BriefCopy>;
  /** 이미지 한 줄 설명 (M4 vision) — 결과는 analyzeMemory의 본문 입력으로 쓰인다. */
  describeImage(input: DescribeImageInput): Promise<string>;
  /** 신규 interest 클러스터 이름 (M5) — ko "2~6자 명사구" / en "1~3단어 명사구". */
  nameInterest(input: NameInterestInput): Promise<string>;
}

/** 임베딩 생성. 차원은 구현체가 env로 주입받는다 (기본 1024). */
export interface EmbeddingPort {
  embed(text: string): Promise<number[]>;
}
