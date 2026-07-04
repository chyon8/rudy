/**
 * 디자인 토큰 — DESIGN.md가 유일한 소스. 컴포넌트 코드에 hex 직접 사용 금지.
 */
import type { TextStyle } from 'react-native';

export const colors = {
  primary: '#292420',
  primaryActive: '#1c1712',
  canvas: '#faf6ef',
  canvasSoft: '#fdfbf6',
  surfaceCard: '#ffffff',
  surfaceStrong: '#f1ebdc',
  hairline: '#e9e2d2',
  hairlineSoft: '#f1ebdc',
  hairlineStrong: '#d9cfb8',
  ink: '#1c1712',
  body: '#4a4238',
  bodyStrong: '#292420',
  muted: '#736b5d',
  mutedSoft: '#b7ad9a',
  onPrimary: '#ffffff',
  gradientLavender: '#cbc0e0',
  gradientPeach: '#f1c9a3',
  gradientMint: '#b7decb',
  gradientSky: '#abc7de',
  success: '#4a7a5c',
  error: '#b54b3a',
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  base: 16,
  md: 20,
  lg: 24,
  xl: 32,
  section: 56,
} as const;

export const rounded = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 20,
  pill: 9999,
  full: 9999,
} as const;

/** Hero orb 색 — card_type별 (DESIGN §Atmospheric Gradient Stops). */
export const orbColorByCardType: Record<string, string> = {
  rediscovery: colors.gradientLavender,
  discovery: colors.gradientPeach,
  reflection: colors.gradientMint,
};

export type AppLocale = 'en' | 'ko';

/**
 * locale 페어링 타이포 (F1): en = EB Garamond/Inter, ko = Noto Serif KR/Pretendard.
 * EB Garamond는 300 웨이트가 없어 최경량인 400을 display로 쓴다.
 * Pretendard는 Google Fonts 미제공 — MVP는 시스템 산세리프 폴백 (undefined).
 */
function families(locale: AppLocale) {
  return locale === 'ko'
    ? { display: 'NotoSerifKR_300Light', body: undefined, bodyMedium: undefined, bodySemibold: undefined }
    : {
        display: 'EBGaramond_400Regular',
        body: 'Inter_400Regular',
        bodyMedium: 'Inter_500Medium',
        bodySemibold: 'Inter_600SemiBold',
      };
}

export function typography(locale: AppLocale): Record<string, TextStyle> {
  const f = families(locale);
  return {
    displayLg: { fontFamily: f.display, fontSize: 26, lineHeight: 31, letterSpacing: -0.3, color: colors.ink },
    displayMd: { fontFamily: f.display, fontSize: 22, lineHeight: 28, letterSpacing: -0.2, color: colors.ink },
    titleMd: { fontFamily: f.bodyMedium, fontWeight: '500', fontSize: 17, lineHeight: 23, color: colors.ink },
    titleSm: { fontFamily: f.bodyMedium, fontWeight: '500', fontSize: 15, lineHeight: 21, color: colors.ink },
    bodyMd: { fontFamily: f.body, fontSize: 15, lineHeight: 22, letterSpacing: 0.1, color: colors.body },
    bodyStrong: { fontFamily: f.bodyMedium, fontWeight: '500', fontSize: 15, lineHeight: 22, letterSpacing: 0.1, color: colors.bodyStrong },
    bodySm: { fontFamily: f.body, fontSize: 13, lineHeight: 19, letterSpacing: 0.1, color: colors.muted },
    caption: { fontFamily: f.body, fontSize: 12, lineHeight: 17, color: colors.muted },
    captionUppercase: {
      fontFamily: f.bodySemibold,
      fontWeight: '600',
      fontSize: 11,
      lineHeight: 14,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: colors.muted,
    },
    button: { fontFamily: f.bodyMedium, fontWeight: '500', fontSize: 15, color: colors.onPrimary },
  };
}
