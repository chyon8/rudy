const TRACKING_PARAM_PATTERNS: RegExp[] = [
  /^utm_/i,
  /^fbclid$/i,
  /^gclid$/i,
  /^dclid$/i,
  /^msclkid$/i,
  /^igshid$/i,
  /^mc_(cid|eid)$/i,
  /^ref$/i,
  /^ref_src$/i,
  /^si$/i,
  /^spm$/i,
];

function extractYouTubeId(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, '');
  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0];
    return id || null;
  }
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    if (url.pathname === '/watch') return url.searchParams.get('v');
    const m = url.pathname.match(/^\/(shorts|embed|v)\/([^/?]+)/);
    if (m) return m[2] ?? null;
  }
  return null;
}

/**
 * URL을 dedup·딥링크 변환 공용 정규형으로 만든다.
 * - youtu.be / watch / shorts / embed 변형을 canonical watch URL로 통일
 * - utm·추적 파라미터 제거, hash 제거, 남은 쿼리 정렬, trailing slash 제거
 * 파싱 불가한 입력은 trim만 해서 그대로 반환한다.
 */
export function normalizeUrl(input: string): string {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return input.trim();
  }

  url.hostname = url.hostname.toLowerCase();

  const youTubeId = extractYouTubeId(url);
  if (youTubeId) {
    return `https://www.youtube.com/watch?v=${youTubeId}`;
  }

  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAM_PATTERNS.some((re) => re.test(key))) {
      url.searchParams.delete(key);
    }
  }
  url.searchParams.sort();
  url.hash = '';

  let pathname = url.pathname;
  if (pathname !== '/' && pathname.endsWith('/')) {
    pathname = pathname.replace(/\/+$/, '');
  }

  const search = url.searchParams.toString();
  return `${url.protocol}//${url.host}${pathname}${search ? `?${search}` : ''}`;
}
