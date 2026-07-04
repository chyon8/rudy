/**
 * 캡처 로컬 큐 — 낙관적 UI의 뒷단. POST 실패 시 큐에 남기고, 다음 flush(앱 재개·다음 캡처)에서
 * 재시도한다. 저장은 유실되지 않는다 (Product Rule 7).
 * Share Extension(M4)도 같은 큐를 쓴다 — App Group AsyncStorage로 메인 앱과 공유.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, uploadImage } from './api';

const QUEUE_KEY = 'rudy.captureQueue';

export interface PendingCapture {
  localId: string;
  type: 'link' | 'thought' | 'image';
  source_url?: string;
  raw_text?: string;
  user_note?: string;
  /** image 타입: App Group 컨테이너의 파일 경로 (Share Extension이 적재). */
  file_uri?: string;
}

async function readQueue(): Promise<PendingCapture[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? (JSON.parse(raw) as PendingCapture[]) : [];
}

async function writeQueue(queue: PendingCapture[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function enqueueCapture(capture: PendingCapture): Promise<void> {
  const queue = await readQueue();
  await writeQueue([...queue, capture]);
}

const FULL_URL_RE = /^https?:\/\/\S+$/i;
const BARE_URL_RE = /^(www\.)?[a-z0-9-]+(\.[a-z0-9-]{2,})+(\/\S*)?$/i;
const URL_IN_TEXT_RE = /https?:\/\/\S+/i;

/**
 * 형식 자동 인식 (규칙 기반, AI 아님):
 * URL 단독 → link / 스킴 없는 도메인("youtube.com/…") → link / 본문 속 URL → link + 나머지는 메모 /
 * 그 외 → thought. 이미지는 Share Extension 경로에서 type='image'로 들어온다.
 */
export function toCapture(text: string): PendingCapture {
  const trimmed = text.trim();
  const localId = `${Date.now()}`;
  if (FULL_URL_RE.test(trimmed)) return { localId, type: 'link', source_url: trimmed };
  if (BARE_URL_RE.test(trimmed)) return { localId, type: 'link', source_url: `https://${trimmed}` };
  const inText = trimmed.match(URL_IN_TEXT_RE);
  if (inText) {
    const note = trimmed.replace(inText[0], '').trim();
    return { localId, type: 'link', source_url: inText[0], user_note: note || undefined };
  }
  return { localId, type: 'thought', raw_text: trimmed };
}

async function send(capture: PendingCapture): Promise<void> {
  if (capture.type === 'image') {
    if (!capture.file_uri) return;
    const { url } = await uploadImage(capture.file_uri);
    await api.createMemory({ type: 'image', image_url: url, user_note: capture.user_note });
    return;
  }
  await api.createMemory({
    type: capture.type,
    source_url: capture.source_url,
    raw_text: capture.raw_text,
    user_note: capture.user_note,
  });
}

/** 저장 시도 — 실패하면 큐에 적재하고 false 반환 (UI는 이미 성공으로 처리). */
export async function submitCapture(capture: PendingCapture): Promise<boolean> {
  try {
    await send(capture);
    return true;
  } catch {
    await enqueueCapture(capture);
    return false;
  }
}

/** 큐에 남은 저장 재시도. 성공한 것만 제거. */
export async function flushCaptureQueue(): Promise<void> {
  const queue = await readQueue();
  if (queue.length === 0) return;
  const remaining: PendingCapture[] = [];
  for (const item of queue) {
    try {
      await send(item);
    } catch {
      remaining.push(item);
    }
  }
  await writeQueue(remaining);
}
