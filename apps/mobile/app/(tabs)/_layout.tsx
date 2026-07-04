import { Feather } from '@expo/vector-icons';
import { Tabs, router } from 'expo-router';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, rounded } from '../../lib/theme';

/** tab-bar — 3개(Home / Capture / Library), 뱃지 카운트 없음 (Product Rule 2). */
export default function TabsLayout() {
  const { t } = useTranslation();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.canvas },
        tabBarStyle: { backgroundColor: colors.canvas, borderTopColor: colors.hairline, height: 84 },
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.mutedSoft,
        tabBarLabelStyle: { fontSize: 11 },
        tabBarBadge: undefined,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ color }) => <Feather name="sunrise" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="capture"
        options={{
          title: '',
          // Capture 탭은 raised ink 원형 버튼 — 탭 전환 대신 풀스크린 모달을 연다.
          tabBarIcon: () => (
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: rounded.full,
                backgroundColor: colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: -12,
              }}
            >
              <Feather name="plus" size={24} color={colors.onPrimary} />
            </View>
          ),
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.push('/capture');
          },
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: t('tabs.library'),
          tabBarIcon: ({ color }) => <Feather name="archive" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
