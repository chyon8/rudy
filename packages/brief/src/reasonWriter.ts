import type { BriefCopyCard, LlmPort } from '@rudy/ai';
import { findToneViolation, getTone, isValidReason, type Locale, type ReasonCode } from '@rudy/shared';

export interface CopyRequest {
  locale: Locale;
  userName: string | null;
  dateLabel: string;
  cards: (BriefCopyCard & { reasonCode: ReasonCode })[];
}

export interface CopyResult {
  greeting: string;
  closing: string;
  reasons: string[];
}

function isValidCopy(req: CopyRequest, copy: CopyResult): boolean {
  if (copy.reasons.length !== req.cards.length) return false;
  if (findToneViolation(copy.greeting, req.locale) || findToneViolation(copy.closing, req.locale)) {
    return false;
  }
  return copy.reasons.every((r) => isValidReason(r, req.locale));
}

/**
 * 문구 생성 (docs/spec.md §4.4): 단일 프롬프트 배치 → 금지어 필터 실패 시 1회 재생성 →
 * 또 실패하면 실패한 조각만 reason_code별 템플릿으로 교체. LLM 자체가 죽어도 템플릿으로
 * 항상 결과를 낸다 (문구 실패가 브리핑 생성을 막지 않는다).
 */
export async function writeCopy(llm: LlmPort, req: CopyRequest): Promise<CopyResult> {
  const tone = getTone(req.locale);
  let last: CopyResult | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      last = await llm.writeBriefCopy({
        locale: req.locale,
        userName: req.userName ?? undefined,
        dateLabel: req.dateLabel,
        cards: req.cards,
        styleRules: tone.styleRules,
        reasonMaxLen: tone.reasonMaxLen,
      });
    } catch {
      break; // LLM 실패 → 템플릿 폴백
    }
    if (isValidCopy(req, last)) return last;
  }

  return {
    greeting:
      last && !findToneViolation(last.greeting, req.locale)
        ? last.greeting
        : tone.templates.greeting(req.userName),
    closing:
      last && !findToneViolation(last.closing, req.locale) ? last.closing : tone.templates.closing,
    reasons: req.cards.map((card, i) => {
      const candidate = last?.reasons[i];
      return candidate && isValidReason(candidate, req.locale)
        ? candidate
        : tone.templates.reasons[card.reasonCode];
    }),
  };
}
