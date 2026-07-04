import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AppTextInput, PrimaryButton, useTypo } from '../components/ui';
import { colors, rounded, spacing } from '../lib/theme';
import { useSession } from '../lib/session';

/** 로그인 — Apple(M4) 우선, dev 이메일 로그인은 개발용. */
export default function Login() {
  const { t } = useTranslation();
  const typo = useTypo();
  const insets = useSafeAreaInsets();
  const { signIn, signInWithApple } = useSession();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false));
    }
  }, []);

  const submitApple = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) return;
      const name = [credential.fullName?.givenName, credential.fullName?.familyName]
        .filter(Boolean)
        .join(' ');
      await signInWithApple(credential.identityToken, name || undefined);
      router.replace('/');
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'ERR_REQUEST_CANCELED') return;
      Alert.alert(t('common.retry'), err instanceof Error ? err.message : 'Login failed');
    }
  };

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
        {appleAvailable && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={rounded.pill}
            style={{ height: 48 }}
            onPress={submitApple}
          />
        )}
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
