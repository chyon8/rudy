import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AppTextInput, PrimaryButton, Skeleton, useTypo } from '../../components/ui';
import { api, type MemoryDetail } from '../../lib/api';
import { colors, rounded, spacing } from '../../lib/theme';

/** Card Detail (PRD S2) — 모달 시트. 이해 레이어 + 메모 편집 + 이어진 기억. */
export default function MemoryScreen() {
  const { id, reason } = useLocalSearchParams<{ id: string; reason?: string }>();
  const { t, i18n } = useTranslation();
  const typo = useTypo();
  const insets = useSafeAreaInsets();
  const [mem, setMem] = useState<MemoryDetail | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!id) return;
    api
      .getMemory(id)
      .then((m) => {
        setMem(m);
        setNote(m.raw_text ?? '');
      })
      .catch(() => router.back());
  }, [id]);

  const saveNote = () => {
    if (mem && note !== (mem.raw_text ?? '')) {
      api.updateMemoryNote(mem.id, note).catch(() => undefined);
    }
  };

  const openOriginal = () => {
    if (mem?.source_url) void Linking.openURL(mem.source_url).catch(() => undefined);
  };

  if (!mem) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.canvas, padding: spacing.base, gap: spacing.sm }}>
        <Skeleton height={200} style={{ borderRadius: rounded.lg, marginTop: spacing.xl }} />
        <Skeleton height={28} />
        <Skeleton height={80} />
      </View>
    );
  }

  const savedDate = new Date(mem.created_at).toLocaleDateString(i18n.language === 'ko' ? 'ko-KR' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const domain = (() => {
    if (!mem.source_url) return null;
    try {
      return new URL(mem.source_url).hostname.replace(/^www\./, '');
    } catch {
      return null;
    }
  })();
  // 분석 전이어도 화면이 비지 않게 — 제목은 도메인/본문 첫 줄까지 폴백.
  const title = mem.title ?? domain ?? mem.raw_text?.split('\n')[0] ?? '';

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.base, paddingBottom: spacing.section, gap: spacing.base }}
      >
        {mem.thumbnail_url && (
          <Image
            source={{ uri: mem.thumbnail_url }}
            style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: rounded.lg }}
          />
        )}
        <View style={{ gap: spacing.xxs }}>
          <Text style={typo.displayMd}>{title}</Text>
          <Text style={typo.caption}>
            {[domain, t('memory.savedOn', { date: savedDate })].filter(Boolean).join(' · ')}
          </Text>
        </View>

        {mem.summary ? (
          <Text style={typo.bodyMd}>{mem.summary}</Text>
        ) : (
          <Text style={typo.bodySm}>{t('home.stillReading')}</Text>
        )}

        {mem.topics.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {mem.topics.map((topic) => (
              <View
                key={topic}
                style={{
                  backgroundColor: colors.surfaceStrong,
                  borderRadius: rounded.pill,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: spacing.xxs,
                }}
              >
                <Text style={typo.caption}>{topic}</Text>
              </View>
            ))}
          </View>
        )}

        {reason ? (
          <Text style={[typo.bodySm, { fontStyle: 'italic' }]}>{reason}</Text>
        ) : null}

        <AppTextInput
          value={note}
          onChangeText={setNote}
          onBlur={saveNote}
          placeholder={t('memory.notePlaceholder')}
          multiline
          style={{ minHeight: 72, textAlignVertical: 'top' }}
        />

        {mem.linked_memories.length > 0 && (
          <View style={{ gap: spacing.xs }}>
            <Text style={typo.captionUppercase}>{t('memory.connected')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs }}>
              {mem.linked_memories.map((linked) => (
                <Pressable
                  key={linked.id}
                  onPress={() => router.push({ pathname: '/memory/[id]', params: { id: linked.id } })}
                  style={{
                    width: 96,
                    backgroundColor: colors.surfaceStrong,
                    borderRadius: rounded.md,
                    padding: spacing.xs,
                    gap: spacing.xxs,
                  }}
                >
                  {linked.thumbnail_url && (
                    <Image
                      source={{ uri: linked.thumbnail_url }}
                      style={{ width: '100%', height: 48, borderRadius: rounded.xs }}
                    />
                  )}
                  <Text style={typo.caption} numberOfLines={1}>
                    {linked.title ?? ''}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {mem.source_url && (
        <View
          style={{
            paddingHorizontal: spacing.base,
            paddingBottom: insets.bottom + spacing.base,
            paddingTop: spacing.sm,
            backgroundColor: colors.canvas,
          }}
        >
          <PrimaryButton label={t('memory.openOriginal')} onPress={openOriginal} />
        </View>
      )}
    </View>
  );
}
