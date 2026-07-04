import { useMemo, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, rounded, spacing, typography, type AppLocale } from '../lib/theme';

export function useTypo() {
  const { i18n } = useTranslation();
  const locale: AppLocale = i18n.language === 'ko' ? 'ko' : 'en';
  return useMemo(() => typography(locale), [locale]);
}

/** button-primary — 앱의 유일한 CTA 색 (ink pill). */
export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const typo = useTypo();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.primary,
        pressed && { backgroundColor: colors.primaryActive },
        (disabled || loading) && { opacity: 0.4 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={typo.button}>{label}</Text>}
    </Pressable>
  );
}

/** button-outline — 투명 배경 + hairline-strong 보더. */
export function OutlineButton({
  label,
  onPress,
  style,
}: {
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const typo = useTypo();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.outline, pressed && { opacity: 0.6 }, style]}>
      <Text style={[typo.button, { color: colors.ink }]}>{label}</Text>
    </Pressable>
  );
}

/** text-input — surface-card 배경, hairline-strong 보더. */
export function AppTextInput(props: TextInputProps) {
  const typo = useTypo();
  return (
    <TextInput
      placeholderTextColor={colors.mutedSoft}
      {...props}
      style={[styles.input, typo.bodyMd, { color: colors.ink }, props.style]}
    />
  );
}

/**
 * Hero orb — 단일 radial bloom의 근사: 겹친 반투명 원 3장 (opacity 합 ≤ 0.5).
 * card-hero 전용 (DESIGN §Decorative Depth). 다른 곳에 쓰지 않는다.
 */
export function Orb({ color, size = 220 }: { color: string; size?: number }) {
  const layer = (scale: number, opacity: number) => ({
    position: 'absolute' as const,
    width: size * scale,
    height: size * scale,
    borderRadius: (size * scale) / 2,
    backgroundColor: color,
    opacity,
  });
  return (
    <View pointerEvents="none" style={[styles.orbWrap, { width: size, height: size }]}>
      <View style={layer(1, 0.14)} />
      <View style={layer(0.72, 0.16)} />
      <View style={layer(0.45, 0.2)} />
    </View>
  );
}

/** onboarding-chip — 선택 시 ink 반전. */
export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  const typo = useTypo();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { backgroundColor: selected ? colors.primary : colors.surfaceStrong }]}
    >
      <Text style={[typo.bodySm, { color: selected ? colors.onPrimary : colors.ink }]}>{label}</Text>
    </Pressable>
  );
}

/** 스켈레톤 블록 — Home 로딩 1종 (PLAN #10c). */
export function Skeleton({ height, style }: { height: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height, backgroundColor: colors.surfaceStrong, borderRadius: rounded.md }, style]} />;
}

export function Hairline({ soft }: { soft?: boolean }) {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: soft ? colors.hairlineSoft : colors.hairline }} />;
}

export function EmptyState({ children }: { children: ReactNode }) {
  const typo = useTypo();
  return (
    <View style={{ paddingVertical: spacing.section, alignItems: 'center' }}>
      <Text style={[typo.bodySm, { textAlign: 'center' }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  primary: {
    backgroundColor: colors.primary,
    borderRadius: rounded.pill,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderRadius: rounded.pill,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderRadius: rounded.sm,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    minHeight: 44,
  },
  orbWrap: { alignItems: 'center', justifyContent: 'center' },
  chip: {
    borderRadius: rounded.pill,
    paddingHorizontal: 14,
    paddingVertical: spacing.xs,
  },
});
