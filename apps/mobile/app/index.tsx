import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { colors } from '../lib/theme';
import { useSession } from '../lib/session';

/** 진입 게이트: 세션 상태에 따라 로그인 / 온보딩 / Home으로. */
export default function Index() {
  const { stage } = useSession();

  if (stage === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.muted} />
      </View>
    );
  }
  if (stage === 'signedOut') return <Redirect href="/login" />;
  if (stage === 'needsOnboarding') return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)/home" />;
}
