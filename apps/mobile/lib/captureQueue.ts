/**
 * Quick Capture 로컬 큐 — 낙관적 UI의 뒷단. POST 실패 시 큐에 남기고,
 * 다음 flush(앱 재개·다음 캡처)에서 재시도한다. 저장은 유실되지 않는다 (Product Rule 7).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';

const QUEUE_KEY = 'rudy.captureQueue';

export interface PendingCapture {
  localId: string;
  type: 'link' | 'thought';
  source_url?: string;
  raw_text?: string;
}

async function readQueue(): Promise<PendingCapture[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? (JSON.parse(raw) as PendingCapture[]) : [];
}

async function writeQueue(queue: PendingCapture[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

const URL_RE = /^https?:\/\/\S+$/i;

export function toCapture(text: string): PendingCapture {
  const trimmed = text.trim();
  return URL_RE.test(trimmed)
    ? { localId: `${Date.now()}`, type: 'link', source_url: trimmed }
    : { localId: `${Date.now()}`, type: 'thought', raw_text: trimmed };
}

/** 저장 시도 — 실패하면 큐에 적재하고 false 반환 (UI는 이미 성공으로 처리). */
export async function submitCapture(capture: PendingCapture): Promise<boolean> {
  try {
    await api.createMemory({ type: capture.type, source_url: capture.source_url, raw_text: capture.raw_text });
    return true;
  } catch {
    const queue = await readQueue();
    await writeQueue([...queue, capture]);
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
      await api.createMemory({ type: item.type, source_url: item.source_url, raw_text: item.raw_text });
    } catch {
      remaining.push(item);
    }
  }
  await writeQueue(remaining);
}
