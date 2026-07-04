import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import * as Linking from 'expo-linking';
import { useCallback, useRef, useState } from 'react';
import { ActionSheetIOS, Alert, Image, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Orb, PrimaryButton, Skeleton, useTypo } from '../../components/ui';
import { api, type Brief, type BriefCard, type FeedbackAction } from '../../lib/api';
import { flushCaptureQueue } from '../../lib/captureQueue';
import { colors, orbColorByCardType, rounded, spacing } from '../../lib/theme';

const BRIEF_CACHE_KEY = 'rudy.lastBrief';

function cardTitle(card: BriefCard, stillReading: string): { title: string; summary: string | null } {
  if (card.memory) {
    // H2: 분석 전이면 제목=도메인, 요약 자리엔 정적 템플릿.
    if (card.memory.analysis_status === 'pending') {
      const domain = card.memory.source_url ? new URL(card.memory.source_url).hostname.replace(/^www\./, '') : '';
      return { title: card.memory.title ?? domain ?? stillReading, summary: stillReading };
    }
    return { title: card.memory.title ?? '', summary: card.memory.summary };
  }
  return { title: card.external_content?.title ?? '', summary: card.external_content?.source ?? null };
}

/** Home — 하루 1회 브리핑. 당겨서 새로고침·무한스크롤 없음 (Product Rule 3·4). */
export default function Home() {
  const { t, i18n } = useTranslation();
  const typo = useTypo();
  const insets = useSafeAreaInsets();
  const [brief, setBrief] = useState<Brief | null>(null);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const impressionsSent = useRef(new Set<string>());

  const load = useCallback(async () => {
    try {
      const data = await api.getTodayBrief();
      setBrief(data);
      setFromCache(false);
      await AsyncStorage.setItem(BRIEF_CACHE_KEY, JSON.stringify(data));
      // impression은 카드당 1회 (서버도 중복 무시).
      for (const card of data.cards) {
        if (!impressionsSent.current.has(card.id)) {
          impressionsSent.current.add(card.id);
          api.sendFeedback(card.id, 'impression').catch(() => impressionsSent.current.delete(card.id));
        }
      }
    } catch {
      // 네트워크 오류 → 마지막 brief 로컬 캐시 (빈 Home 금지의 클라이언트 구현, PLAN #10c).
      const cached = await AsyncStorage.getItem(BRIEF_CACHE_KEY);
      if (cached) {
        setBrief(JSON.parse(cached) as Brief);
        setFromCache(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void flushCaptureQueue();
      // 이미 오늘 brief를 갖고 있으면 다시 부르지 않는다 (하루 1회).
      if (!brief || fromCache) void load();
    }, [brief, fromCache, load]),
  );

  const sendFeedback = (card: BriefCard, action: FeedbackAction) => {
    api.sendFeedback(card.id, action).catch(() => undefined);
    if (action === 'not_today' || action === 'never') {
      setDismissed((prev) => new Set(prev).add(card.id));
    }
  };

  const openCard = async (card: BriefCard) => {
    if (card.memory) {
      sendFeedback(card, 'open_detail');
      router.push({ pathname: '/memory/[id]', params: { id: card.memory.id, reason: card.curation_reason ?? '' } });
    } else if (card.external_content?.url) {
      sendFeedback(card, 'open_external');
      await Linking.openURL(card.external_content.url).catch(() => undefined);
    }
  };

  const openPrimary = async (card: BriefCard) => {
    const url = card.primary_action.url;
    if (card.primary_action.type === 'detail' || !url) return openCard(card);
    sendFeedback(card, 'open_external');
    try {
      await Linking.openURL(url);
    } catch {
      // youtube:// 등 딥링크 실패 시 https 폴백.
      const fallback = card.memory?.source_url ?? card.external_content?.url;
      if (fallback && fallback !== url) await Linking.openURL(fallback).catch(() => undefined);
    }
  };

  const moreMenu = (card: BriefCard) => {
    const confirmNever = () =>
      Alert.alert(t('home.stopShowing'), t('home.stopShowingConfirm'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('home.stopShowing'), style: 'destructive', onPress: () => sendFeedback(card, 'never') },
      ]);
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [t('common.cancel'), t('home.stopShowing')], destructiveButtonIndex: 1, cancelButtonIndex: 0 },
        (i) => i === 1 && confirmNever(),
      );
    } else {
      confirmNever();
    }
  };

  const dateLabel = new Date().toLocaleDateString(i18n.language === 'ko' ? 'ko-KR' : 'en-US', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  const visibleCards = (brief?.cards ?? []).filter((c) => !dismissed.has(c.id));
  const hero = visibleCards[0];
  const supports = visibleCards.slice(1);

  const feedbackRow = (card: BriefCard) => (
    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md, marginTop: spacing.sm }}>
      <Pressable hitSlop={8} onPress={() => sendFeedback(card, 'like')} accessibilityLabel={t('home.like')}>
        <Feather name="thumbs-up" size={16} color={colors.muted} />
      </Pressable>
      <Pressable hitSlop={8} onPress={() => sendFeedback(card, 'not_today')} accessibilityLabel={t('home.notToday')}>
        <Feather name="x" size={16} color={colors.muted} />
      </Pressable>
      <Pressable hitSlop={8} onPress={() => moreMenu(card)}>
        <Feather name="more-horizontal" size={16} color={colors.muted} />
      </Pressable>
    </View>
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.canvas }}
      contentContainerStyle={{
        paddingHorizontal: spacing.base,
        paddingTop: insets.top + spacing.md,
        paddingBottom: spacing.section,
      }}
    >
      {/* home-header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, paddingRight: spacing.base }}>
          <Text style={typo.displayMd}>{brief?.greeting ?? " "}</Text>
          <Text style={[typo.bodySm, { marginTop: spacing.xxs }]}>{dateLabel}</Text>
        </View>
        <Pressable hitSlop={8} onPress={() => router.push('/settings')}>
          <Feather name="user" size={22} color={colors.ink} />
        </Pressable>
      </View>

      {fromCache && <Text style={[typo.caption, { marginTop: spacing.sm }]}>{t('home.offline')}</Text>}

      {loading && (
        <View style={{ marginTop: spacing.section, gap: spacing.sm }}>
          <Skeleton height={280} style={{ borderRadius: rounded.lg }} />
          <Skeleton height={88} />
          <Skeleton height={88} />
        </View>
      )}

      {/* card-hero */}
      {!loading && hero && (
        <Pressable
          onPress={() => openCard(hero)}
          style={{
            marginTop: spacing.section,
            backgroundColor: colors.surfaceCard,
            borderRadius: rounded.lg,
            borderWidth: 1,
            borderColor: colors.hairline,
            padding: spacing.lg,
            overflow: 'hidden',
          }}
        >
          <View style={{ position: 'absolute', top: -60, right: -40 }}>
            <Orb color={orbColorByCardType[hero.card_type] ?? colors.gradientLavender} />
          </View>
          {(hero.memory?.thumbnail_url ?? hero.external_content?.thumbnail_url) && (
            <Image
              source={{ uri: hero.memory?.thumbnail_url ?? hero.external_content?.thumbnail_url ?? undefined }}
              style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: rounded.md, marginBottom: spacing.base }}
            />
          )}
          <Text style={typo.titleMd}>{cardTitle(hero, t('home.stillReading')).title}</Text>
          {hero.curation_reason && (
            <Text style={[typo.bodyMd, { marginTop: spacing.xs }]}>{hero.curation_reason}</Text>
          )}
          <PrimaryButton label={t('home.open')} onPress={() => openPrimary(hero)} style={{ marginTop: spacing.base }} />
          {feedbackRow(hero)}
        </Pressable>
      )}

      {/* card-support */}
      {!loading && supports.length > 0 && (
        <View style={{ marginTop: spacing.section, gap: spacing.sm }}>
          {supports.map((card) => {
            const { title, summary } = cardTitle(card, t('home.stillReading'));
            const thumb = card.memory?.thumbnail_url ?? card.external_content?.thumbnail_url;
            return (
              <Pressable
                key={card.id}
                onPress={() => openCard(card)}
                style={{
                  backgroundColor: colors.surfaceCard,
                  borderRadius: rounded.md,
                  borderWidth: 1,
                  borderColor: colors.hairline,
                  padding: spacing.base,
                }}
              >
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  {thumb && (
                    <Image source={{ uri: thumb }} style={{ width: 64, height: 64, borderRadius: rounded.sm }} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={typo.titleSm} numberOfLines={2}>
                      {title}
                    </Text>
                    {card.curation_reason ? (
                      <Text style={[typo.bodySm, { marginTop: spacing.xxs }]} numberOfLines={2}>
                        {card.curation_reason}
                      </Text>
                    ) : summary ? (
                      <Text style={[typo.bodySm, { marginTop: spacing.xxs }]} numberOfLines={2}>
                        {summary}
                      </Text>
                    ) : null}
                  </View>
                </View>
                {feedbackRow(card)}
              </Pressable>
            );
          })}
        </View>
      )}

      {/* home-closing — 명시적 끝 (Product Rule 3) */}
      {!loading && brief && (
        <Text style={[typo.bodySm, { textAlign: 'center', paddingTop: spacing.xl, marginTop: spacing.lg }]}>
          {brief.closing ?? t('home.closing')}
        </Text>
      )}
    </ScrollView>
  );
}
