import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import * as Linking from 'expo-linking';
import { useCallback, useRef, useState } from 'react';
import { ActionSheetIOS, Alert, Image, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TFunction } from 'i18next';
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

function domainOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/** "언제 저장했나" — 카드의 즉물적 맥락. 도메인과 함께 메타 라인을 만든다. */
function metaLine(card: BriefCard, t: TFunction): string | null {
  const parts: string[] = [];
  const domain = domainOf(card.memory?.source_url ?? card.external_content?.url);
  if (domain) parts.push(domain);
  if (card.memory) {
    const days = Math.floor((Date.now() - new Date(card.memory.created_at).getTime()) / 86400000);
    parts.push(days <= 0 ? t('home.savedToday') : t('home.savedDaysAgo', { count: days }));
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

/** 카드 시각 포맷 — 콘텐츠 종류를 규칙으로 판별 (DESIGN.md card variants). */
type CardKind = 'video' | 'thought' | 'article' | 'discovery' | 'reflection';

function kindOf(card: BriefCard): CardKind {
  if (card.card_type === 'discovery') return 'discovery';
  if (card.card_type === 'reflection') return 'reflection';
  const m = card.memory;
  if (m?.type === 'thought') return 'thought';
  const domain = domainOf(m?.source_url);
  if (m?.content_type === 'video' || domain === 'youtube.com' || domain === 'youtu.be' || domain === 'm.youtube.com') {
    return 'video';
  }
  return 'article';
}

/** 비디오 썸네일 위 재생 배지 (DESIGN.md play-badge). */
function PlayBadge() {
  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: 'rgba(28,23,18,0.72)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Feather name="play" size={16} color="#ffffff" style={{ marginLeft: 2 }} />
      </View>
    </View>
  );
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
      {/* home-header — 날짜가 먼저, 인사말은 한 줄 보조. 주인공은 카드다. */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, paddingRight: spacing.base }}>
          <Text style={typo.captionUppercase}>{dateLabel}</Text>
          <Text style={[typo.bodyMd, { marginTop: spacing.xxs, color: colors.muted }]}>
            {brief?.greeting ?? ' '}
          </Text>
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

      {/* card-hero — 콘텐츠 종류별 변형 (DESIGN.md card variants) */}
      {!loading &&
        hero &&
        (() => {
          const kind = kindOf(hero);
          const thumb = hero.memory?.thumbnail_url ?? hero.external_content?.thumbnail_url;
          const meta = metaLine(hero, t);
          const { title, summary } = cardTitle(hero, t('home.stillReading'));
          return (
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
              {kind === 'discovery' && (
                <Text style={[typo.captionUppercase, { marginBottom: spacing.xs }]}>
                  {t('home.discoveryLabel')}
                  {hero.external_content?.source ? ` · ${hero.external_content.source}` : ''}
                </Text>
              )}
              {kind === 'thought' ? (
                <>
                  <Text style={typo.displayMd}>“{hero.memory?.raw_text ?? title}”</Text>
                  {meta && <Text style={[typo.caption, { marginTop: spacing.xs }]}>{meta}</Text>}
                </>
              ) : (
                <>
                  {thumb && (
                    <View style={{ marginBottom: spacing.base }}>
                      <Image
                        source={{ uri: thumb }}
                        style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: rounded.md }}
                      />
                      {kind === 'video' && <PlayBadge />}
                    </View>
                  )}
                  <Text style={typo.displayMd}>{title}</Text>
                  {meta && <Text style={[typo.caption, { marginTop: spacing.xxs }]}>{meta}</Text>}
                  {summary && (
                    <Text style={[typo.bodyMd, { marginTop: spacing.xs }]} numberOfLines={3}>
                      {summary}
                    </Text>
                  )}
                </>
              )}
              {hero.curation_reason && (
                <Text style={[typo.bodySm, { marginTop: spacing.xs, fontStyle: 'italic' }]}>
                  {hero.curation_reason}
                </Text>
              )}
              <PrimaryButton label={t('home.open')} onPress={() => openPrimary(hero)} style={{ marginTop: spacing.base }} />
              {feedbackRow(hero)}
            </Pressable>
          );
        })()}

      {/* card-support — 비디오/생각 인용/아티클/발견/회고 변형 */}
      {!loading && supports.length > 0 && (
        <View style={{ marginTop: spacing.section, gap: spacing.sm }}>
          {supports.map((card) => {
            const kind = kindOf(card);
            const { title, summary } = cardTitle(card, t('home.stillReading'));
            const thumb = card.memory?.thumbnail_url ?? card.external_content?.thumbnail_url;
            const domain = domainOf(card.memory?.source_url ?? card.external_content?.url);
            const meta = metaLine(card, t);
            const reason = card.curation_reason;
            const base = {
              backgroundColor: colors.surfaceCard,
              borderRadius: rounded.md,
              borderWidth: 1,
              borderColor: colors.hairline,
              padding: spacing.base,
            };
            const reasonLine = reason ? (
              <Text style={[typo.bodySm, { marginTop: spacing.xxs, fontStyle: 'italic' }]} numberOfLines={2}>
                {reason}
              </Text>
            ) : null;

            if (kind === 'thought') {
              return (
                <Pressable key={card.id} onPress={() => openCard(card)} style={base}>
                  <Text style={[typo.displayMd, { fontSize: 18, lineHeight: 26 }]} numberOfLines={4}>
                    “{card.memory?.raw_text ?? title}”
                  </Text>
                  {meta && <Text style={[typo.caption, { marginTop: spacing.xs }]}>{meta}</Text>}
                  {reasonLine}
                  {feedbackRow(card)}
                </Pressable>
              );
            }

            if (kind === 'video') {
              return (
                <Pressable key={card.id} onPress={() => openCard(card)} style={base}>
                  {thumb && (
                    <View style={{ marginBottom: spacing.sm }}>
                      <Image
                        source={{ uri: thumb }}
                        style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: rounded.sm }}
                      />
                      <PlayBadge />
                    </View>
                  )}
                  <Text style={typo.titleSm} numberOfLines={2}>
                    {title}
                  </Text>
                  {meta && <Text style={[typo.caption, { marginTop: 2 }]}>{meta}</Text>}
                  {summary && (
                    <Text style={[typo.bodySm, { marginTop: spacing.xxs, color: colors.body }]} numberOfLines={2}>
                      {summary}
                    </Text>
                  )}
                  {reasonLine}
                  {feedbackRow(card)}
                </Pressable>
              );
            }

            // article / discovery / reflection — 가로형. 썸네일 없으면 도메인 이니셜 타일.
            return (
              <Pressable key={card.id} onPress={() => openCard(card)} style={base}>
                {kind === 'discovery' && (
                  <Text style={[typo.captionUppercase, { marginBottom: spacing.xs }]}>
                    {t('home.discoveryLabel')}
                    {card.external_content?.source ? ` · ${card.external_content.source}` : ''}
                  </Text>
                )}
                {kind === 'reflection' && (
                  <Text style={[typo.captionUppercase, { marginBottom: spacing.xs }]}>
                    {t('home.reflectionLabel')}
                  </Text>
                )}
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  {thumb ? (
                    <Image source={{ uri: thumb }} style={{ width: 64, height: 64, borderRadius: rounded.sm }} />
                  ) : kind !== 'reflection' && domain ? (
                    <View
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: rounded.sm,
                        backgroundColor: colors.surfaceStrong,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={typo.displayMd}>{domain[0]?.toUpperCase()}</Text>
                    </View>
                  ) : null}
                  <View style={{ flex: 1 }}>
                    <Text style={typo.titleSm} numberOfLines={2}>
                      {title}
                    </Text>
                    {meta && <Text style={[typo.caption, { marginTop: 2 }]}>{meta}</Text>}
                    {summary && (
                      <Text style={[typo.bodySm, { marginTop: spacing.xxs, color: colors.body }]} numberOfLines={2}>
                        {summary}
                      </Text>
                    )}
                    {reasonLine}
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
