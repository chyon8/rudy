import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Hairline, useTypo } from '../components/ui';
import { api } from '../lib/api';
import { setAppLocale } from '../lib/i18n';
import { useSession } from '../lib/session';
import { colors, spacing } from '../lib/theme';

const NOTIFY_TIMES = ['07:00', '08:00', '09:00'];

/** Settings (H5): 알림 시간 / 언어 / 잠금화면 숨기기 / 계정. 끝. */
export default function Settings() {
  const { t } = useTranslation();
  const typo = useTypo();
  const insets = useSafeAreaInsets();
  const { user, refreshUser, signOut } = useSession();
  const [busy, setBusy] = useState(false);

  const patch = async (body: Parameters<typeof api.patchMe>[0]) => {
    if (busy) return;
    setBusy(true);
    try {
      await api.patchMe(body);
      if (body.locale) await setAppLocale(body.locale);
      await refreshUser();
    } catch {
      // 무시 — 다음 시도에 반영.
    } finally {
      setBusy(false);
    }
  };

  const cycleNotifyTime = () => {
    const current = user?.notify_time?.slice(0, 5) ?? '08:00';
    const idx = NOTIFY_TIMES.indexOf(current);
    const next = NOTIFY_TIMES[(idx + 1) % NOTIFY_TIMES.length] ?? '08:00';
    void patch({ notify_time: next });
  };

  const confirmDelete = () =>
    Alert.alert(t('settings.deleteAccount'), t('settings.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.deleteAccount'),
        style: 'destructive',
        onPress: async () => {
          await api.deleteMe().catch(() => undefined);
          await signOut();
          router.replace('/login');
        },
      },
    ]);

  const rowStyle = {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: spacing.base,
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.canvas }}
      contentContainerStyle={{ padding: spacing.base, paddingTop: insets.top + spacing.md }}
    >
      <Text style={[typo.displayMd, { marginBottom: spacing.lg }]}>{t('settings.title')}</Text>

      <Pressable style={rowStyle} onPress={cycleNotifyTime}>
        <Text style={typo.bodyMd}>{t('settings.notifyTime')}</Text>
        <Text style={typo.bodyStrong}>{user?.notify_time?.slice(0, 5) ?? '08:00'}</Text>
      </Pressable>
      <Hairline soft />

      <View style={rowStyle}>
        <Text style={typo.bodyMd}>{t('settings.language')}</Text>
        <View style={{ flexDirection: 'row', gap: spacing.base }}>
          {(['en', 'ko'] as const).map((l) => (
            <Pressable key={l} onPress={() => void patch({ locale: l })} hitSlop={6}>
              <Text style={[typo.bodyStrong, { color: user?.locale === l ? colors.ink : colors.mutedSoft }]}>
                {l === 'en' ? 'English' : '한국어'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <Hairline soft />

      <View style={rowStyle}>
        <Text style={typo.bodyMd}>{t('settings.hideLockScreen')}</Text>
        <Switch
          value={user?.hide_notification_content ?? false}
          onValueChange={(v) => void patch({ hide_notification_content: v })}
          trackColor={{ true: colors.primary, false: colors.hairlineStrong }}
        />
      </View>
      <Hairline soft />

      <Text style={[typo.captionUppercase, { marginTop: spacing.xl, marginBottom: spacing.xs }]}>
        {t('settings.account')}
      </Text>
      <Pressable
        style={rowStyle}
        onPress={async () => {
          await signOut();
          router.replace('/login');
        }}
      >
        <Text style={typo.bodyMd}>{t('settings.logout')}</Text>
      </Pressable>
      <Hairline soft />
      <Pressable style={rowStyle} onPress={confirmDelete}>
        <Text style={[typo.bodyMd, { color: colors.error }]}>{t('settings.deleteAccount')}</Text>
      </Pressable>
    </ScrollView>
  );
}
