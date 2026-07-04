import { Readability } from '@mozilla/readability';
import { safeFetch, safeFetchText } from '@rudy/shared';
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
  const res = await safeFetch(
    `https://www.youtube.com/oembed?url=${encodeURIComponent(rawUrl)}&format=json`,
  );
  if (!res.ok) return {};
  const data = (await res.json()) as {
    title?: string;
    thumbnail_url?: string;
    author_name?: string;
  };
  return {
    title: data.title,
    thumbnailUrl: data.thumbnail_url,
    body: data.author_name ? `YouTube channel: ${data.author_name}` : undefined,
  };
}

async function extractWeb(rawUrl: string): Promise<Extracted> {
  const html = await safeFetchText(rawUrl);
  const dom = new JSDOM(html, { url: rawUrl });
  const doc = dom.window.document;
  // Readability는 doc를 변형하므로 OG 태그를 먼저 읽는다.
  const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ?? undefined;
  const ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') ?? undefined;
  const article = new Readability(doc).parse();
  const title = ogTitle ?? article?.title ?? doc.title ?? undefined;
  const body = article?.textContent?.trim().slice(0, 3000) || undefined;
  return { title, thumbnailUrl: ogImage, body };
}

/** 콘텐츠 추출. 이미지(M4)는 아직 비활성 — 빈 결과 반환. */
export async function extractContent(input: ExtractInput): Promise<Extracted> {
  if (input.type === 'thought') return { body: input.rawText ?? '' };
  if (input.type === 'image' || !input.sourceUrl) return {};

  const url = new URL(input.sourceUrl);
  return isYouTube(url) ? extractYouTube(input.sourceUrl) : extractWeb(input.sourceUrl);
}
