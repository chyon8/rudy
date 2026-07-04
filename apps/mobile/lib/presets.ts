import type { AppLocale } from './theme';

/**
 * 온보딩 관심사 칩 프리셋 — packages/shared/src/config/coldstartSources.ts의
 * PRESET_INTERESTS와 key가 일치해야 한다 (coldstart 매칭 기준, H4).
 */
export const PRESET_INTERESTS: { key: string; label: Record<AppLocale, string> }[] = [
  { key: 'cooking', label: { en: 'Cooking', ko: '요리' } },
  { key: 'fitness', label: { en: 'Fitness', ko: '운동' } },
  { key: 'tech', label: { en: 'Tech', ko: '테크' } },
  { key: 'design', label: { en: 'Design', ko: '디자인' } },
  { key: 'travel', label: { en: 'Travel', ko: '여행' } },
  { key: 'music', label: { en: 'Music', ko: '음악' } },
  { key: 'reading', label: { en: 'Reading', ko: '책' } },
  { key: 'productivity', label: { en: 'Productivity', ko: '생산성' } },
  { key: 'investing', label: { en: 'Investing', ko: '투자' } },
  { key: 'photography', label: { en: 'Photography', ko: '사진' } },
  { key: 'fashion', label: { en: 'Fashion', ko: '패션' } },
  { key: 'science', label: { en: 'Science', ko: '과학' } },
];
