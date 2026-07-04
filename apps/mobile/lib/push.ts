/**
 * 푸시 토큰 등록 (M4): 권한 요청 → Expo push token → PATCH /me.
 * Expo Go(SDK 53+)는 원격 푸시를 지원하지 않아 dev build에서만 실제로 등록된다 —
 * 실패는 조용히 무시 (앱 기능에 영향 없음).
 */
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { api } from './api';

export async function registerPushToken(): Promise<void> {
  try {
    if (!Device.isDevice) return;
    const { status } = await Notifications.getPermissionsAsync();
    const granted =
      status === 'granted' || (await Notifications.requestPermissionsAsync()).status === 'granted';
    if (!granted) return;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? undefined;
    const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
    await api.patchMe({ expo_push_token: token });
  } catch {
    // Expo Go/시뮬레이터 등 미지원 환경 — 무시.
  }
}
