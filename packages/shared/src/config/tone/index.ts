import type { Locale } from '../../contracts';
import { toneEn } from './en';
import { toneKo } from './ko';
import type { ToneGuide } from './types';

export type { ReasonCode, ToneGuide } from './types';

export function getTone(locale: Locale): ToneGuide {
  return locale === 'ko' ? toneKo : toneEn;
}

/** 금지어 검사 — 매칭된 패턴 문자열을 반환, 통과하면 null. */
export function findToneViolation(text: string, locale: Locale): string | null {
  for (const re of getTone(locale).forbidden) {
    if (re.test(text)) return re.source;
  }
  return null;
}

/** curation_reason 유효성: 금지어 없음 + 길이 제한 이내. */
export function isValidReason(text: string, locale: Locale): boolean {
  const tone = getTone(locale);
  return text.length > 0 && text.length <= tone.reasonMaxLen && findToneViolation(text, locale) === null;
}
