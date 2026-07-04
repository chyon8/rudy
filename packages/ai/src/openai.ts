import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import type { Env } from '@rudy/shared';
import type { AnalyzeInput, EmbeddingPort, LlmAnalysis, LlmPort } from './ports';

const AnalysisSchema = z.object({
  summary: z.string(),
  contentType: z.enum(['video', 'article', 'product', 'place', 'idea', 'other']),
  topics: z.array(z.string()),
  inferredIntent: z.enum(['learn', 'do', 'go', 'buy', 'remember', 'inspire']),
  timeSensitivity: z.enum(['evergreen', 'seasonal', 'dated', 'event_bound']),
  // dated일 때만 채워지고, 아니면 null.
  expiresAt: z.string().nullable(),
});

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
