/**
 * i18n — en 원문 우선(H7), ko 대응 번역. 정적 UI 카피의 단일 소스.
 * 톤: 담백, 죄책감 프레임 금지, 이모지 금지 (docs/spec.md §9).
 */
import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import type { AppLocale } from './theme';

const en = {
  common: {
    cancel: 'Cancel',
    save: 'Save',
    continue: 'Continue',
    retry: 'Try again',
  },
  login: {
    title: 'Rudy',
    subtitle: 'Save anywhere. Rediscover here.',
    emailPlaceholder: 'Email',
    button: 'Start',
  },
  onboarding: {
    welcomeTitle: 'Save anywhere.\nRediscover with Rudy.',
    welcomeBody:
      'Rudy reads what you save and brings back the right thing at the right moment — one small brief, every morning.',
    welcomeCta: 'Begin',
    interestsTitle: 'What are you into these days?',
    interestsBody: 'Pick at least three. Rudy uses these to understand your first saves.',
    interestsAddPlaceholder: 'Add your own',
    firstSaveTitle: 'Plant your first memory',
    firstSaveBody: 'Paste a link you have been meaning to get back to, or write down a thought.',
    firstSavePlaceholder: 'Paste a link or write a thought',
    firstSaveCta: 'Plant it',
    planting: 'Rudy is reading your first memory…',
  },
  home: {
    stillReading: 'Rudy is still reading this one',
    discoveryLabel: 'Something new',
    reflectionLabel: 'Lately you',
    savedToday: 'Saved today',
    savedDaysAgo: 'Saved {{count}}d ago',
    closing: "That's all for today. I'll have more ready tomorrow.",
    open: 'Open',
    like: 'Like',
    notToday: 'Not today',
    stopShowing: 'Stop showing this',
    stopShowingConfirm: 'Rudy will not bring this memory back again.',
    offline: 'Showing your last brief — the network seems away for a moment.',
  },
  capture: {
    placeholder: 'Paste a link or write a thought',
    gotIt: 'Got it.',
    queued: 'Saved — will sync when back online.',
  },
  library: {
    all: 'All',
    interests: 'Interests',
    search: 'Search',
    searchPlaceholder: 'Find that thing you saved…',
    emptyAll: 'Things you save will gather here.',
    emptyInterests: 'Your interests will take shape as you save.',
    emptySearch: 'Nothing matched that. Another word might.',
    memoriesCount: '{{count}} memories',
    linkGone: 'This link no longer opens',
  },
  memory: {
    notePlaceholder: 'Add a note to your future self',
    connected: 'Connected memories',
    savedOn: 'Saved {{date}}',
    openOriginal: 'Open original',
  },
  settings: {
    title: 'Settings',
    notifyTime: 'Morning brief time',
    language: 'Language',
    hideLockScreen: 'Hide content on lock screen',
    account: 'Account',
    logout: 'Log out',
    deleteAccount: 'Delete account',
    deleteConfirm: 'This deletes your account and memories. There is no undo.',
  },
  tabs: { home: 'Home', library: 'Library' },
};

// ko: en 카피의 대응 번역 (원문은 en).
const ko: typeof en = {
  common: { cancel: '취소', save: '저장', continue: '계속', retry: '다시 시도' },
  login: {
    title: 'Rudy',
    subtitle: '저장은 어디서든, 재발견은 Rudy에서.',
    emailPlaceholder: '이메일',
    button: '시작하기',
  },
  onboarding: {
    welcomeTitle: '저장은 어디서든,\n재발견은 Rudy에서.',
    welcomeBody:
      'Rudy가 저장한 것들을 읽고, 알맞은 순간에 다시 건네요 — 매일 아침 작은 브리핑 하나로.',
    welcomeCta: '시작하기',
    interestsTitle: '요즘 어떤 것에 마음이 가나요?',
    interestsBody: '세 개 이상 골라주세요. 첫 저장물을 이해하는 데 쓰여요.',
    interestsAddPlaceholder: '직접 입력',
    firstSaveTitle: '첫 기억을 심어주세요',
    firstSaveBody: '다시 보려던 링크를 붙여넣거나, 지금 떠오른 생각을 적어도 좋아요.',
    firstSavePlaceholder: '링크를 붙여넣거나 생각을 적어주세요',
    firstSaveCta: '심기',
    planting: 'Rudy가 첫 기억을 읽고 있어요…',
  },
  home: {
    stillReading: 'Rudy가 아직 읽고 있어요',
    discoveryLabel: '새로운 발견',
    reflectionLabel: '요즘의 나',
    savedToday: '오늘 저장',
    savedDaysAgo: '{{count}}일 전 저장',
    closing: '오늘은 여기까지예요. 내일 또 준비해둘게요.',
    open: '열기',
    like: '좋아요',
    notToday: '오늘은 아니에요',
    stopShowing: '그만 보기',
    stopShowingConfirm: '이 기억은 다시 꺼내오지 않을게요.',
    offline: '마지막 브리핑을 보여드리고 있어요 — 네트워크가 잠시 자리를 비웠네요.',
  },
  capture: {
    placeholder: '링크를 붙여넣거나 생각을 적어주세요',
    gotIt: '잘 받았어요.',
    queued: '저장했어요 — 연결되면 자동으로 보낼게요.',
  },
  library: {
    all: '전체',
    interests: '관심사',
    search: '검색',
    searchPlaceholder: '저장해둔 그것, 찾아드릴게요',
    emptyAll: '저장한 것들이 여기에 모여요.',
    emptyInterests: '저장할수록 관심사가 모양을 갖춰가요.',
    emptySearch: '딱 맞는 게 없었어요. 다른 말로 찾아볼까요?',
    memoriesCount: '{{count}}개 기억',
    linkGone: '이 링크는 더 이상 열리지 않아요',
  },
  memory: {
    notePlaceholder: '미래의 나에게 메모 남기기',
    connected: '이어진 기억',
    savedOn: '{{date}} 저장',
    openOriginal: '원본 열기',
  },
  settings: {
    title: '설정',
    notifyTime: '아침 브리핑 시간',
    language: '언어',
    hideLockScreen: '잠금화면 내용 숨기기',
    account: '계정',
    logout: '로그아웃',
    deleteAccount: '계정 삭제',
    deleteConfirm: '계정과 기억이 모두 삭제돼요. 되돌릴 수 없어요.',
  },
  tabs: { home: '홈', library: '서재' },
};

export function deviceLocale(): AppLocale {
  return getLocales()[0]?.languageCode === 'ko' ? 'ko' : 'en';
}

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ko: { translation: ko } },
  lng: deviceLocale(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export function currentLocale(): AppLocale {
  return i18n.language === 'ko' ? 'ko' : 'en';
}

export async function setAppLocale(locale: AppLocale): Promise<void> {
  await i18n.changeLanguage(locale);
}

export default i18n;
