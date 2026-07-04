import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import type { Env } from '@rudy/shared';
import type {
  AnalyzeInput,
  BriefCopy,
  BriefCopyInput,
  DescribeImageInput,
  EmbeddingPort,
  LlmAnalysis,
  LlmPort,
  NameInterestInput,
} from './ports';

const AnalysisSchema = z.object({
  summary: z.string(),
  contentType: z.enum(['video', 'article', 'product', 'place', 'idea', 'other']),
  topics: z.array(z.string()),
  inferredIntent: z.enum(['learn', 'do', 'go', 'buy', 'remember', 'inspire']),
  timeSensitivity: z.enum(['evergreen', 'seasonal', 'dated', 'event_bound']),
  // dated일 때만 채워지고, 아니면 null.
  expiresAt: z.string().nullable(),
});

const BriefCopySchema = z.object({
  greeting: z.string(),
  closing: z.string(),
  reasons: z.array(z.string()),
});

const InterestNameSchema = z.object({ name: z.string() });

function systemPrompt(locale: AnalyzeInput['locale']): string {
  const lang = locale === 'ko' ? 'Korean' : 'English';
  return [
    `You analyze a saved item and return structured understanding in ${lang}.`,
    'summary: one plain, warm sentence describing what this is (no evaluation of the user).',
    'topics: 3–6 normalized topic tags.',
    'inferredIntent: why the user likely saved it.',
    'timeSensitivity: evergreen | seasonal | dated | event_bound.',
    'expiresAt: an ISO date only when the item is time-bound (dated/event_bound), else null.',
  ].join('\n');
}

export function createOpenAiAdapters(env: Env): { llm: LlmPort; embedding: EmbeddingPort } {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required for AI adapters');
  }
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  const llm: LlmPort = {
    async analyzeMemory(input: AnalyzeInput): Promise<LlmAnalysis> {
      const userContent = [
        input.title ? `Title: ${input.title}` : null,
        input.body ? `Content excerpt: ${input.body}` : null,
        input.userNote ? `User note: ${input.userNote}` : null,
        `Saved at: ${input.savedAt}`,
      ]
        .filter(Boolean)
        .join('\n');

      const completion = await client.beta.chat.completions.parse({
        model: env.OPENAI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt(input.locale) },
          { role: 'user', content: userContent },
        ],
        response_format: zodResponseFormat(AnalysisSchema, 'analysis'),
      });

      const parsed = completion.choices[0]?.message.parsed;
      if (!parsed) {
        throw new Error('LLM analysis returned no parsed content');
      }
      return parsed;
    },

    // 브리핑 문구 배치 생성 — 카드 전체 + greeting/closing을 단일 프롬프트로 (사용자·일당 1회).
    async writeBriefCopy(input: BriefCopyInput): Promise<BriefCopy> {
      const lang = input.locale === 'ko' ? 'Korean' : 'English';
      const system = [
        `You are Rudy, a personal AI curator. Write the daily brief copy in ${lang}.`,
        "For each card, write a curation reason: why THIS item is worth the user's attention TODAY.",
        "Ground every reason in the card's concrete content — its topic, title, how long ago it was saved, or its user note.",
        'Never write generic sentiment, vague encouragement, or filler that could apply to any item.',
        `Each reason must be at most ${input.reasonMaxLen} characters.`,
        `Return exactly ${input.cards.length} reasons, in the same order as the cards.`,
        'greeting: one short plain sentence — the cards are the point, not the greeting. closing: one short sentence marking the end of the brief.',
        ...input.styleRules,
      ].join('\n');

      const cardLines = input.cards.map((c, i) =>
        [
          `Card ${i + 1} (${c.cardType}, reason type: ${c.reasonCode}, saved ${c.ageDays} days ago)`,
          `  Title: ${c.title}`,
          c.summary ? `  Summary: ${c.summary}` : null,
          c.topics?.length ? `  Topics: ${c.topics.join(', ')}` : null,
          c.userNote ? `  User note: ${c.userNote}` : null,
        ]
          .filter(Boolean)
          .join('\n'),
      );
      const userContent = [
        `Date: ${input.dateLabel}`,
        input.userName ? `User name: ${input.userName}` : null,
        ...cardLines,
      ]
        .filter(Boolean)
        .join('\n');

      const completion = await client.beta.chat.completions.parse({
        model: env.OPENAI_MODEL_REASON,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userContent },
        ],
        response_format: zodResponseFormat(BriefCopySchema, 'brief_copy'),
      });

      const parsed = completion.choices[0]?.message.parsed;
      if (!parsed) {
        throw new Error('Brief copy generation returned no parsed content');
      }
      return parsed;
    },

    // 이미지 한 줄 설명 — gpt-4o-mini vision (M4).
    async describeImage(input: DescribeImageInput): Promise<string> {
      const lang = input.locale === 'ko' ? 'Korean' : 'English';
      const completion = await client.chat.completions.create({
        model: env.OPENAI_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Describe what this saved image is about in one plain ${lang} sentence. If it contains text (screenshot, poster), include the key text content.`,
              },
              {
                type: 'image_url',
                image_url: { url: `data:${input.mimeType};base64,${input.imageBase64}` },
              },
            ],
          },
        ],
        max_tokens: 200,
      });
      const text = completion.choices[0]?.message.content?.trim();
      if (!text) throw new Error('Vision returned no description');
      return text;
    },

    // 신규 interest 클러스터 이름 (M5) — locale별 명사구 규칙 (docs/spec.md §5).
    async nameInterest(input: NameInterestInput): Promise<string> {
      const rule =
        input.locale === 'ko'
          ? 'a Korean noun phrase, 2 to 6 characters'
          : 'an English noun phrase, 1 to 3 words';
      const system = [
        'You name a cluster of items a user saved, as a short interest label.',
        `The name must be ${rule}. No punctuation, no quotes, no sentence.`,
      ].join('\n');
      const userContent = input.samples
        .map((s) => `- ${s.title}${s.topics.length > 0 ? ` (${s.topics.join(', ')})` : ''}`)
        .join('\n');

      const completion = await client.beta.chat.completions.parse({
        model: env.OPENAI_MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userContent },
        ],
        response_format: zodResponseFormat(InterestNameSchema, 'interest_name'),
      });

      const name = completion.choices[0]?.message.parsed?.name.trim();
      if (!name) throw new Error('Interest naming returned no name');
      return name;
    },
  };

  const embedding: EmbeddingPort = {
    async embed(text: string): Promise<number[]> {
      const res = await client.embeddings.create({
        model: env.OPENAI_EMBEDDING_MODEL,
        input: text,
        dimensions: env.EMBEDDING_DIMENSIONS,
      });
      const vector = res.data[0]?.embedding;
      if (!vector) {
        throw new Error('Embedding API returned no vector');
      }
      return vector;
    },
  };

  return { llm, embedding };
}
