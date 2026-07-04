import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AppTextInput, Chip, Orb, PrimaryButton, useTypo } from '../components/ui';
import { api } from '../lib/api';
import { toCapture } from '../lib/captureQueue';
import { PRESET_INTERESTS } from '../lib/presets';
import { useSession } from '../lib/session';
import { colors, spacing, type AppLocale } from '../lib/theme';

type Step = 'welcome' | 'interests' | 'firstSave' | 'planting';

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_MS = 16000;

/** 온보딩 3단계 (PRD S8) — 관심사 최소 3개, 첫 기억 1건 필수. */
export default function Onboarding() {
  const { t, i18n } = useTranslation();
  const typo = useTypo();
  const insets = useSafeAreaInsets();
  const { completeOnboarding } = useSession();
  const locale: AppLocale = i18n.language === 'ko' ? 'ko' : 'en';

  const [step, setStep] = useState<Step>('welcome');
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [customs, setCustoms] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState('');
  const [firstSave, setFirstSave] = useState('');
  const [busy, setBusy] = useState(false);

  const selectedCount = selectedKeys.length + customs.length;

  const toggleKey = (key: string) =>
    setSelectedKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const addCustom = () => {
    const label = customInput.trim();
    if (label && !customs.includes(label)) setCustoms((prev) => [...prev, label]);
    setCustomInput('');
  };

  const submitInterests = async () => {
    setBusy(true);
    try {
      const interests = [
        ...selectedKeys.map((key) => ({
          key,
          label: PRESET_INTERESTS.find((p) => p.key === key)?.label[locale] ?? key,
        })),
        ...customs.map((label) => ({ label })),
      ];
      await api.onboard(interests);
      setStep('firstSave');
    } catch (err) {
      Alert.alert(t('common.retry'), err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  // 첫 저장 → "심는 중" 폴링 (2초 간격, 최대 16초) → 첫 Home (H2).
  const submitFirstSave = async () => {
    const capture = toCapture(firstSave);
    setBusy(true);
    try {
      const { id } = await api.createMemory({
        type: capture.type,
        source_url: capture.source_url,
        raw_text: capture.raw_text,
      });
      setStep('planting');
      const deadline = Date.now() + POLL_MAX_MS;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        try {
          const mem = await api.getMemory(id);
          if (mem.analysis_status !== 'pending') break;
        } catch {
          break;
        }
      }
      completeOnboarding();
      router.replace('/(tabs)/home');
    } catch (err) {
      setStep('firstSave');
      Alert.alert(t('common.retry'), err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const pad = {
    paddingHorizontal: spacing.base,
    paddingTop: insets.top + spacing.xl,
    paddingBottom: insets.bottom + spacing.lg,
  };

  if (step === 'welcome') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.canvas }}>
        <View style={[pad, { flex: 1, justifyContent: 'center', gap: spacing.lg }]}>
          {/* onboarding-illustration — Hero 밖에서 orb를 쓰는 유일한 예외 (gradient-sky) */}
          <Orb color={colors.gradientSky} size={260} />
          <Text style={typo.displayLg}>{t('onboarding.welcomeTitle')}</Text>
          <Text style={typo.bodyMd}>{t('onboarding.welcomeBody')}</Text>
        </View>
        <View style={{ paddingHorizontal: spacing.base, paddingBottom: insets.bottom + spacing.lg }}>
          <PrimaryButton label={t('onboarding.welcomeCta')} onPress={() => setStep('interests')} />
        </View>
      </View>
    );
  }

  if (step === 'interests') {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, backgroundColor: colors.canvas }}
      >
        <ScrollView contentContainerStyle={[pad, { gap: spacing.lg }]}>
          <Text style={typo.displayLg}>{t('onboarding.interestsTitle')}</Text>
          <Text style={typo.bodyMd}>{t('onboarding.interestsBody')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {PRESET_INTERESTS.map((p) => (
              <Chip
                key={p.key}
                label={p.label[locale]}
                selected={selectedKeys.includes(p.key)}
                onPress={() => toggleKey(p.key)}
              />
            ))}
            {customs.map((label) => (
              <Chip
                key={label}
                label={label}
                selected
                onPress={() => setCustoms((prev) => prev.filter((c) => c !== label))}
              />
            ))}
          </View>
          <AppTextInput
            value={customInput}
            onChangeText={setCustomInput}
            placeholder={t('onboarding.interestsAddPlaceholder')}
            onSubmitEditing={addCustom}
            returnKeyType="done"
          />
        </ScrollView>
        <View style={{ paddingHorizontal: spacing.base, paddingBottom: insets.bottom + spacing.lg }}>
          <PrimaryButton
            label={t('common.continue')}
            onPress={submitInterests}
            disabled={selectedCount < 3}
            loading={busy}
          />
        </View>
      </KeyboardAvoidingView>
    );
  }

  if (step === 'planting') {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.canvas,
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.lg,
          paddingHorizontal: spacing.xl,
        }}
      >
        <Orb color={colors.gradientSky} size={200} />
        <ActivityIndicator color={colors.muted} />
        <Text style={[typo.bodyMd, { textAlign: 'center' }]}>{t('onboarding.planting')}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.canvas }}
    >
      <View style={[pad, { flex: 1, gap: spacing.lg }]}>
        <Text style={typo.displayLg}>{t('onboarding.firstSaveTitle')}</Text>
        <Text style={typo.bodyMd}>{t('onboarding.firstSaveBody')}</Text>
        <AppTextInput
          value={firstSave}
          onChangeText={setFirstSave}
          placeholder={t('onboarding.firstSavePlaceholder')}
          multiline
          autoFocus
          style={{ minHeight: 96, textAlignVertical: 'top' }}
        />
      </View>
      <View style={{ paddingHorizontal: spacing.base, paddingBottom: insets.bottom + spacing.lg }}>
        <PrimaryButton
          label={t('onboarding.firstSaveCta')}
          onPress={submitFirstSave}
          disabled={firstSave.trim().length === 0}
          loading={busy}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
