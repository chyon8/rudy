import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AppTextInput, PrimaryButton, useTypo } from '../components/ui';
import { flushCaptureQueue, submitCapture, toCapture } from '../lib/captureQueue';
import { colors, rounded, spacing } from '../lib/theme';

/**
 * Quick Capture (PRD S4) — 낙관적 UI: 저장 버튼 즉시 토스트+닫기,
 * 전송 실패는 로컬 큐가 재시도. 분류/태그 UI 없음 (Product Rule 5).
 */
export default function Capture() {
  const { t } = useTranslation();
  const typo = useTypo();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const save = () => {
    const capture = toCapture(text);
    if (!text.trim()) return;
    // 낙관적: 결과를 기다리지 않는다. 실패 시 큐 적재 → 다음 기회에 flush.
    void submitCapture(capture).then((sent) => {
      if (sent) void flushCaptureQueue();
    });
    setToast(t('capture.gotIt'));
    setTimeout(() => router.back(), 700);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.canvas }}
    >
      <View
        style={{
          flex: 1,
          paddingHorizontal: spacing.base,
          paddingTop: insets.top + spacing.base,
          paddingBottom: insets.bottom + spacing.lg,
        }}
      >
        <Pressable hitSlop={8} onPress={() => router.back()}>
          <Text style={[typo.bodyMd, { color: colors.ink }]}>{t('common.cancel')}</Text>
        </Pressable>
        <AppTextInput
          value={text}
          onChangeText={setText}
          placeholder={t('capture.placeholder')}
          multiline
          autoFocus
          style={{ flex: 1, marginTop: spacing.lg, textAlignVertical: 'top', borderWidth: 0, backgroundColor: colors.canvas }}
        />
        {toast && (
          <View
            style={{
              backgroundColor: colors.primary,
              borderRadius: rounded.sm,
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.base,
              marginBottom: spacing.sm,
            }}
          >
            <Text style={[typo.bodyMd, { color: colors.onPrimary }]}>{toast}</Text>
          </View>
        )}
        <PrimaryButton label={t('common.save')} onPress={save} disabled={!text.trim()} />
      </View>
    </KeyboardAvoidingView>
  );
}
