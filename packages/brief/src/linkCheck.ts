import { safeFetch } from '@rudy/shared';

/** 4xx(405·416 제외)만 dead 판정 — 5xx는 서버 문제로 보고 살려둔다 (PLAN #6). */
function isDeadStatus(status: number): boolean {
  return status >= 400 && status < 500 && status !== 405 && status !== 416;
}

/**
 * 링크 생존 확인: HEAD → 실패 시 GET + Range: bytes=0-0 폴백 (safeFetch 경유, timeout 3s).
 * 네트워크 오류도 dead. 최종 선정 카드에만 호출한다.
 */
export async function checkUrlAlive(url: string): Promise<boolean> {
  try {
    const head = await safeFetch(url, { method: 'HEAD' });
    if (head.status >= 200 && head.status < 300) return true;
    if (!isDeadStatus(head.status) && head.status < 400) return true;
  } catch {
    // HEAD 거부/실패 → GET 폴백으로 진행.
  }
  try {
    const res = await safeFetch(url, { headers: { range: 'bytes=0-0' } });
    return !isDeadStatus(res.status);
  } catch {
    return false;
  }
}
