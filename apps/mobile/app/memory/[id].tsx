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
        <Text style={typo.displayMd}>{mem.title ?? ''}</Text>
        {mem.summary ? (
          <Text style={typo.bodyMd}>{mem.summary}</Text>
        ) : (
          <Text style={typo.bodySm}>{t('home.stillReading')}</Text>
        )}

        <AppTextInput
          value={note}
          onChangeText={setNote}
          onBlur={saveNote}
          placeholder={t('memory.notePlaceholder')}
          multiline
          style={{ minHeight: 72, textAlignVertical: 'top' }}
        />
        <Text style={typo.caption}>{t('memory.savedOn', { date: savedDate })}</Text>

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

        {reason ? <Text style={typo.bodyMd}>{reason}</Text> : null}
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
