import { getCalendars } from 'expo-localization';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, loadToken, setToken, type User } from './api';
import { currentLocale, setAppLocale } from './i18n';
import { registerPushToken } from './push';

type Stage = 'loading' | 'signedOut' | 'needsOnboarding' | 'ready';

interface Session {
  stage: Stage;
  user: User | null;
  signIn: (email: string) => Promise<void>;
  signInWithApple: (identityToken: string, displayName?: string) => Promise<void>;
  completeOnboarding: () => void;
  refreshUser: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<Session | null>(null);

export function deviceTimezone(): string {
  return getCalendars()[0]?.timeZone ?? 'UTC';
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [stage, setStage] = useState<Stage>('loading');
  const [user, setUser] = useState<User | null>(null);

  const bootstrap = useCallback(async () => {
    const token = await loadToken();
    if (!token) {
      setStage('signedOut');
      return;
    }
    try {
      const me = await api.getMe();
      setUser(me);
      await setAppLocale(me.locale);
      const { items } = await api.getInterests();
      setStage(items.length > 0 ? 'ready' : 'needsOnboarding');
      void registerPushToken(); // 앱 실행 시 토큰 동기화 (H8 복구 경로)
    } catch {
      // 토큰 만료 등 — 로그인부터 다시.
      await setToken(null);
      setStage('signedOut');
    }
  }, []);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const finishSignIn = useCallback(async (token: string, me: User) => {
    await setToken(token);
    setUser(me);
    const { items } = await api.getInterests();
    setStage(items.length > 0 ? 'ready' : 'needsOnboarding');
    void registerPushToken();
  }, []);

  const signIn = useCallback(
    async (email: string) => {
      const { token, user: me } = await api.devLogin(email, deviceTimezone(), currentLocale());
      await finishSignIn(token, me);
    },
    [finishSignIn],
  );

  const signInWithApple = useCallback(
    async (identityToken: string, displayName?: string) => {
      const { token, user: me } = await api.appleLogin(identityToken, displayName, deviceTimezone(), currentLocale());
      await finishSignIn(token, me);
    },
    [finishSignIn],
  );

  const completeOnboarding = useCallback(() => setStage('ready'), []);

  const refreshUser = useCallback(async () => {
    const me = await api.getMe();
    setUser(me);
    await setAppLocale(me.locale);
  }, []);

  const signOut = useCallback(async () => {
    await setToken(null);
    setUser(null);
    setStage('signedOut');
  }, []);

  const value = useMemo(
    () => ({ stage, user, signIn, signInWithApple, completeOnboarding, refreshUser, signOut }),
    [stage, user, signIn, signInWithApple, completeOnboarding, refreshUser, signOut],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
