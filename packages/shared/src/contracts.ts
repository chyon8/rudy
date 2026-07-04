import { z } from 'zod';

export const LocaleSchema = z.enum(['en', 'ko']);
export const MemoryTypeSchema = z.enum(['link', 'thought', 'image']);
export const FeedbackActionSchema = z.enum([
  'open_external',
  'open_detail',
  'like',
  'not_today',
  'never',
  'impression',
]);

export const AuthDevBodySchema = z.object({
  email: z.string().email(),
  timezone: z.string().optional(),
  locale: LocaleSchema.optional(),
});

export const CreateMemoryBodySchema = z
  .object({
    type: MemoryTypeSchema,
    source_url: z.string().url().optional(),
    raw_text: z.string().optional(),
    user_note: z.string().optional(),
    shared_from: z.string().optional(),
  })
  .refine((b) => b.type !== 'link' || Boolean(b.source_url), {
    message: 'source_url is required for link memories',
    path: ['source_url'],
  })
  .refine((b) => b.type !== 'thought' || Boolean(b.raw_text), {
    message: 'raw_text is required for thought memories',
    path: ['raw_text'],
  });

export const UpdateMemoryBodySchema = z.object({
  raw_text: z.string().optional(),
  user_note: z.string().optional(),
});

export const SearchBodySchema = z.object({ query: z.string().min(1) });

export const ListMemoriesQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
  interest_id: z.string().uuid().optional(),
});

export const OnboardingBodySchema = z.object({
  interests: z
    .array(z.object({ key: z.string().optional(), label: z.string().min(1) }))
    .min(3),
});

export const UpdateMeBodySchema = z.object({
  notify_time: z.string().optional(),
  timezone: z.string().optional(),
  display_name: z.string().optional(),
  locale: LocaleSchema.optional(),
  expo_push_token: z.string().nullable().optional(),
  hide_notification_content: z.boolean().optional(),
});

export const FeedbackBodySchema = z.object({ action: FeedbackActionSchema });

export type Locale = z.infer<typeof LocaleSchema>;
export type AuthDevBody = z.infer<typeof AuthDevBodySchema>;
export type CreateMemoryBody = z.infer<typeof CreateMemoryBodySchema>;
export type UpdateMemoryBody = z.infer<typeof UpdateMemoryBodySchema>;
export type SearchBody = z.infer<typeof SearchBodySchema>;
export type ListMemoriesQuery = z.infer<typeof ListMemoriesQuerySchema>;
export type OnboardingBody = z.infer<typeof OnboardingBodySchema>;
export type UpdateMeBody = z.infer<typeof UpdateMeBodySchema>;
export type FeedbackBody = z.infer<typeof FeedbackBodySchema>;

/** 표준 에러 envelope. HTTP 상태코드와 함께 반환. */
export interface ApiErrorBody {
  error: { code: string; message: string };
}
