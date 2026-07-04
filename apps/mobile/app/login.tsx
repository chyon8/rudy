import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AppTextInput, PrimaryButton, useTypo } from '../components/ui';
import { colors, spacing } from '../lib/theme';
import { useSession } from '../lib/session';

/** dev 로그인 (AUTH_DEV_MODE) — 소셜 로그인은 M4. */
export default function Login() {
  const { t } = useTranslation();
  const typo = useTypo();
  const insets = useSafeAreaInsets();
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.includes('@')) return;
    setBusy(true);
    try {
      await signIn(email.trim());
      router.replace('/');
    } catch (err) {
      Alert.alert(t('common.retry'), err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
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
          paddingTop: insets.top + spacing.section,
          paddingBottom: insets.bottom + spacing.lg,
          justifyContent: 'center',
          gap: spacing.base,
        }}
      >
        <Text style={typo.displayLg}>{t('login.title')}</Text>
        <Text style={[typo.bodyMd, { marginBottom: spacing.lg }]}>{t('login.subtitle')}</Text>
        <AppTextInput
          value={email}
          onChangeText={setEmail}
          placeholder={t('login.emailPlaceholder')}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoFocus
          onSubmitEditing={submit}
        />
        <PrimaryButton label={t('login.button')} onPress={submit} loading={busy} disabled={!email.includes('@')} />
      </View>
    </KeyboardAvoidingView>
  );
}
