/**
 * API 클라이언트. 타입은 docs/spec.md §2 응답 계약의 수동 미러 —
 * @rudy/shared는 Node 전용 모듈(safeFetch)을 포함해 RN 번들에 못 넣는다.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
const TOKEN_KEY = 'rudy.token';

export type Locale = 'en' | 'ko';

export interface User {
  id: string;
  display_name: string | null;
  locale: Locale;
  notify_time: string;
  timezone: string;
  hide_notification_content: boolean;
}

export interface Memory {
  id: string;
  type: 'link' | 'thought' | 'image';
  source_url: string | null;
  title: string | null;
  thumbnail_url: string | null;
  raw_text: string | null;
  summary: string | null;
  content_type: string | null;
  topics: string[];
  inferred_intent: string | null;
  time_sensitivity: string | null;
  analysis_status: 'pending' | 'ready' | 'degraded' | 'failed';
  link_alive: boolean;
  created_at: string;
  updated_at: string;
}

export interface MemoryDetail extends Memory {
  linked_memories: Memory[];
}

export interface ExternalContent {
  url: string;
  title: string;
  thumbnail_url: string | null;
  source: string;
}

export type FeedbackAction = 'open_external' | 'open_detail' | 'like' | 'not_today' | 'never' | 'impression';

export interface BriefCard {
  id: string;
  card_type: 'rediscovery' | 'discovery' | 'reflection';
  reason_code: string;
  curation_reason: string | null;
  position: number;
  memory: Memory | null;
  external_content: ExternalContent | null;
  primary_action: { type: 'deeplink' | 'detail'; url?: string };
}

export interface Brief {
  id: string;
  brief_date: string;
  status: 'generated' | 'fallback';
  greeting: string | null;
  closing: string | null;
  generated_at: string;
  cards: BriefCard[];
}

export interface Interest {
  id: string;
  name: string;
  memory_count: number;
  status: 'rising' | 'stable' | 'dormant';
}

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

let token: string | null = null;

export async function loadToken(): Promise<string | null> {
  token = await AsyncStorage.getItem(TOKEN_KEY);
  return token;
}

export async function setToken(next: string | null): Promise<void> {
  token = next;
  if (next) await AsyncStorage.setItem(TOKEN_KEY, next);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => null)) as
    | ({ error?: { code: string; message: string } } & Record<string, unknown>)
    | null;
  if (!res.ok) {
    throw new ApiError(data?.error?.code ?? 'unknown', res.status, data?.error?.message ?? 'Request failed');
  }
  return data as T;
}

/** 이미지 업로드 (M4) — RN multipart. Share Extension flush 경로에서 사용. */
export async function uploadImage(fileUri: string): Promise<{ url: string; key: string }> {
  const name = fileUri.split('/').pop() ?? 'image.jpg';
  const ext = name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const mime = ext === 'png' ? 'image/png' : ext === 'heic' ? 'image/heic' : 'image/jpeg';
  const form = new FormData();
  form.append('file', { uri: fileUri, name, type: mime } as unknown as Blob);
  const res = await fetch(`${BASE_URL}/v1/uploads`, {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  if (!res.ok) throw new ApiError('upload_failed', res.status, 'Image upload failed');
  return (await res.json()) as { url: string; key: string };
}

export const api = {
  devLogin: (email: string, timezone: string, locale: Locale) =>
    request<{ token: string; user: User }>('/v1/auth/dev', { method: 'POST', body: { email, timezone, locale } }),
  appleLogin: (identityToken: string, displayName: string | undefined, timezone: string, locale: Locale) =>
    request<{ token: string; user: User }>('/v1/auth/apple', {
      method: 'POST',
      body: { identity_token: identityToken, display_name: displayName, timezone, locale },
    }),
  getMe: () => request<User>('/v1/me'),
  patchMe: (
    patch: Partial<Pick<User, 'notify_time' | 'timezone' | 'display_name' | 'locale' | 'hide_notification_content'>> & {
      expo_push_token?: string | null;
    },
  ) => request<User>('/v1/me', { method: 'PATCH', body: patch }),
  onboard: (interests: { key?: string; label: string }[]) =>
    request<{ interests: { id: string; name: string }[] }>('/v1/me/onboarding', {
      method: 'POST',
      body: { interests },
    }),
  deleteMe: () => request<void>('/v1/me', { method: 'DELETE' }),

  createMemory: (body: {
    type: 'link' | 'thought' | 'image';
    source_url?: string;
    raw_text?: string;
    user_note?: string;
    image_url?: string;
  }) => request<{ id: string; analysis_status: string }>('/v1/memories', { method: 'POST', body }),
  getMemory: (id: string) => request<MemoryDetail>(`/v1/memories/${id}`),
  updateMemoryNote: (id: string, user_note: string) =>
    request<Memory>(`/v1/memories/${id}`, { method: 'PATCH', body: { user_note } }),
  listMemories: (opts: { cursor?: string; interest_id?: string } = {}) => {
    const q = new URLSearchParams();
    if (opts.cursor) q.set('cursor', opts.cursor);
    if (opts.interest_id) q.set('interest_id', opts.interest_id);
    const qs = q.toString();
    return request<{ items: Memory[]; next_cursor: string | null }>(`/v1/memories${qs ? `?${qs}` : ''}`);
  },
  searchMemories: (query: string) =>
    request<{ items: Memory[] }>('/v1/memories/search', { method: 'POST', body: { query } }),

  getInterests: () => request<{ items: Interest[] }>('/v1/interests'),
  getTodayBrief: () => request<Brief>('/v1/briefs/today'),
  sendFeedback: (cardId: string, action: FeedbackAction) =>
    request<void>(`/v1/briefs/cards/${cardId}/feedback`, { method: 'POST', body: { action } }),
};
