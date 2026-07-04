import { Readability } from '@mozilla/readability';
import { extractYouTubeVideoId, safeFetch, safeFetchText } from '@rudy/shared';
import { JSDOM } from 'jsdom';

export interface Extracted {
  title?: string;
  thumbnailUrl?: string;
  body?: string;
}

export interface ExtractInput {
  type: 'link' | 'thought' | 'image';
  sourceUrl: string | null;
  rawText: string | null;
}

function isYouTube(url: URL): boolean {
  const h = url.hostname.replace(/^www\./, '');
  return h === 'youtube.com' || h === 'youtu.be' || h === 'm.youtube.com';
}

async function extractYouTube(rawUrl: string): Promise<Extracted> {
  // videoId 기반 썸네일은 oEmbed가 죽어도 항상 존재 — 유튜브 카드에 썸네일이 비지 않게.
  const videoId = extractYouTubeVideoId(rawUrl);
  const fallbackThumb = videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : undefined;

  const res = await safeFetch(
    `https://www.youtube.com/oembed?url=${encodeURIComponent(rawUrl)}&format=json`,
  );
  if (!res.ok) return { thumbnailUrl: fallbackThumb };
  const data = (await res.json()) as {
    title?: string;
    thumbnail_url?: string;
    author_name?: string;
  };
  return {
    title: data.title,
    thumbnailUrl: data.thumbnail_url ?? fallbackThumb,
    body: data.author_name ? `YouTube channel: ${data.author_name}` : undefined,
  };
}

async function extractWeb(rawUrl: string): Promise<Extracted> {
  const html = await safeFetchText(rawUrl);
  const dom = new JSDOM(html, { url: rawUrl });
  const doc = dom.window.document;
  // Readability는 doc를 변형하므로 메타 태그를 먼저 읽는다. og → twitter 순 폴백.
  const meta = (sel: string) => doc.querySelector(sel)?.getAttribute('content') ?? undefined;
  const metaTitle = meta('meta[property="og:title"]') ?? meta('meta[name="twitter:title"]');
  const metaImage = meta('meta[property="og:image"]') ?? meta('meta[name="twitter:image"]');
  const article = new Readability(doc).parse();
  const title = metaTitle ?? article?.title ?? doc.title ?? undefined;
  const body = article?.textContent?.trim().slice(0, 3000) || undefined;
  return { title, thumbnailUrl: metaImage, body };
}

/** 콘텐츠 추출. 이미지(M4)는 아직 비활성 — 빈 결과 반환. */
export async function extractContent(input: ExtractInput): Promise<Extracted> {
  if (input.type === 'thought') return { body: input.rawText ?? '' };
  if (input.type === 'image' || !input.sourceUrl) return {};

  const url = new URL(input.sourceUrl);
  return isYouTube(url) ? extractYouTube(input.sourceUrl) : extractWeb(input.sourceUrl);
}
