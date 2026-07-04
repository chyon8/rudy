import dns from 'node:dns/promises';
import net from 'node:net';

const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 3000;
const MAX_BYTES = 2 * 1024 * 1024;

/** 사설/루프백/링크로컬 IP 차단 (SSRF 방어). */
export function isBlockedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    const [a, b] = parts;
    if (a === undefined || b === undefined) return true;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local (incl. cloud metadata)
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }
  if (net.isIPv6(ip)) {
    const low = ip.toLowerCase();
    if (low === '::1' || low === '::') return true;
    if (low.startsWith('fe80')) return true; // link-local
    if (low.startsWith('fc') || low.startsWith('fd')) return true; // unique-local
    const mapped = low.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped?.[1]) return isBlockedIp(mapped[1]);
    return false;
  }
  return true; // 알 수 없는 형식은 차단
}

async function assertHostAllowed(hostname: string): Promise<void> {
  const results = await dns.lookup(hostname, { all: true });
  if (results.length === 0) throw new Error(`DNS resolution failed: ${hostname}`);
  for (const r of results) {
    if (isBlockedIp(r.address)) {
      throw new Error(`Blocked non-public address for ${hostname}: ${r.address}`);
    }
  }
}

/**
 * SSRF 방어 fetch: http(s)만, redirect ≤3(hop마다 host 재검증), timeout 3s,
 * content-length 2MB cap. ingestion 추출과 링크 체커가 공유한다.
 * (DNS rebinding TOCTOU는 MVP 범위에서 허용 — resolve 후 즉시 fetch.)
 */
export async function safeFetch(rawUrl: string, init: RequestInit = {}): Promise<Response> {
  let current = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = new URL(current);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error(`Blocked non-http(s) protocol: ${url.protocol}`);
    }
    await assertHostAllowed(url.hostname);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(current, { ...init, redirect: 'manual', signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }

    const location = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && location) {
      current = new URL(location, current).toString();
      continue;
    }

    const len = Number(res.headers.get('content-length') ?? '0');
    if (len > MAX_BYTES) {
      throw new Error(`Response too large: ${len} bytes`);
    }
    return res;
  }
  throw new Error(`Too many redirects (> ${MAX_REDIRECTS})`);
}

/** safeFetch 후 본문을 MAX_BYTES까지만 읽어 문자열로 반환. */
export async function safeFetchText(rawUrl: string): Promise<string> {
  const res = await safeFetch(rawUrl, { headers: { accept: 'text/html,*/*' } });
  const reader = res.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_BYTES) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}
