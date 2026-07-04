import '../lib/i18n';
import { EBGaramond_400Regular } from '@expo-google-fonts/eb-garamond';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { NotoSerifKR_300Light } from '@expo-google-fonts/noto-serif-kr';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { colors } from '../lib/theme';
import { SessionProvider } from '../lib/session';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    EBGaramond_400Regular,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    NotoSerifKR_300Light,
  });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.canvas }} />;
  }

  return (
    <SessionProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.canvas },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="capture" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="memory/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
      </Stack>
    </SessionProvider>
  );
}
