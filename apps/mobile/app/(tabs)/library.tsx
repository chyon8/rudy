import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Image, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AppTextInput, EmptyState, Hairline, useTypo } from '../../components/ui';
import { api, type Interest, type Memory } from '../../lib/api';
import { colors, rounded, spacing } from '../../lib/theme';

type Tab = 'all' | 'interests' | 'search';

function domainOf(url: string | null): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** Library (PRD S5~S7) — 전체(무한 스크롤 허용) / 관심사 / 시맨틱 검색. */
export default function Library() {
  const { t } = useTranslation();
  const typo = useTypo();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('all');

  const [items, setItems] = useState<Memory[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [interestFilter, setInterestFilter] = useState<Interest | null>(null);
  const [interests, setInterests] = useState<Interest[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Memory[] | null>(null);

  const loadFirst = useCallback(async () => {
    const page = await api.listMemories().catch(() => ({ items: [], next_cursor: null }));
    setItems(page.items);
    setCursor(page.next_cursor);
  }, []);

  const loadMore = async () => {
    if (!cursor) return;
    const page = await api.listMemories({ cursor }).catch(() => null);
    if (page) {
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.next_cursor);
    }
  };

  // 탭 포커스마다 재조회 — 방금 저장한 memory가 바로 보여야 한다 (저장 신뢰).
  useFocusEffect(
    useCallback(() => {
      if (!interestFilter) void loadFirst();
      api
        .getInterests()
        .then(({ items: list }) => setInterests(list.filter((i) => i.memory_count >= 1))) // H3
        .catch(() => undefined);
    }, [loadFirst, interestFilter]),
  );

  const search = async () => {
    if (!query.trim()) return;
    const res = await api.searchMemories(query.trim()).catch(() => ({ items: [] }));
    setResults(res.items);
  };

  const openInterest = async (interest: Interest) => {
    setInterestFilter(interest);
    const page = await api.listMemories({ interest_id: interest.id }).catch(() => ({ items: [], next_cursor: null }));
    setItems(page.items);
    setCursor(page.next_cursor);
    setTab('all');
  };

  const row = ({ item }: { item: Memory }) => (
    <Pressable
      onPress={() => router.push({ pathname: '/memory/[id]', params: { id: item.id } })}
      style={{ flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.sm, alignItems: 'center' }}
    >
      {item.thumbnail_url ? (
        <Image source={{ uri: item.thumbnail_url }} style={{ width: 48, height: 48, borderRadius: rounded.sm }} />
      ) : (
        <View style={{ width: 48, height: 48, borderRadius: rounded.sm, backgroundColor: colors.surfaceStrong }} />
      )}
      <View style={{ flex: 1 }}>
        <Text style={typo.titleSm} numberOfLines={1}>
          {item.title ?? item.raw_text ?? domainOf(item.source_url)}
        </Text>
        {item.summary && (
          <Text style={typo.bodySm} numberOfLines={1}>
            {item.summary}
          </Text>
        )}
        {item.type === 'link' && !item.link_alive && (
          <Text style={typo.caption}>{t('library.linkGone')}</Text>
        )}
      </View>
      <Text style={typo.caption}>
        {new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
      </Text>
    </Pressable>
  );

  const tabButton = (key: Tab, label: string) => (
    <Pressable key={key} onPress={() => { setTab(key); if (key !== 'all') setInterestFilter(null); }} hitSlop={6}>
      <Text style={[typo.titleSm, { color: tab === key ? colors.ink : colors.mutedSoft }]}>{label}</Text>
    </Pressable>
  );

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.canvas,
        paddingTop: insets.top + spacing.md,
        paddingHorizontal: spacing.base,
      }}
    >
      <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.base }}>
        {tabButton('all', t('library.all'))}
        {tabButton('interests', t('library.interests'))}
        {tabButton('search', t('library.search'))}
      </View>

      {tab === 'all' && (
        <>
          {interestFilter && (
            <Pressable
              onPress={() => {
                setInterestFilter(null);
                void loadFirst();
              }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xxs, marginBottom: spacing.xs }}
            >
              <Feather name="x" size={13} color={colors.muted} />
              <Text style={typo.bodySm}>{interestFilter.name}</Text>
            </Pressable>
          )}
          <FlatList
            data={items}
            keyExtractor={(m) => m.id}
            renderItem={row}
            ItemSeparatorComponent={Hairline}
            onEndReached={loadMore}
            onEndReachedThreshold={0.4}
            ListEmptyComponent={<EmptyState>{t('library.emptyAll')}</EmptyState>}
            contentContainerStyle={{ paddingBottom: spacing.section }}
            showsVerticalScrollIndicator={false}
          />
        </>
      )}

      {tab === 'interests' &&
        (interests.length === 0 ? (
          <EmptyState>{t('library.emptyInterests')}</EmptyState>
        ) : (
          <FlatList
            data={interests}
            keyExtractor={(i) => i.id}
            numColumns={2}
            columnWrapperStyle={{ gap: spacing.sm }}
            contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.section }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => openInterest(item)}
                style={{
                  flex: 1,
                  backgroundColor: colors.surfaceStrong,
                  borderRadius: rounded.md,
                  padding: spacing.md,
                  gap: spacing.xxs,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xxs }}>
                  <Text style={typo.titleSm} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.status === 'rising' && <Feather name="arrow-up-right" size={13} color={colors.primary} />}
                </View>
                <Text style={typo.bodySm}>{t('library.memoriesCount', { count: item.memory_count })}</Text>
              </Pressable>
            )}
          />
        ))}

      {tab === 'search' && (
        <>
          <AppTextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('library.searchPlaceholder')}
            onSubmitEditing={search}
            returnKeyType="search"
            style={{ borderRadius: rounded.pill, height: 40, marginBottom: spacing.base }}
          />
          {results !== null &&
            (results.length === 0 ? (
              <EmptyState>{t('library.emptySearch')}</EmptyState>
            ) : (
              <FlatList
                data={results}
                keyExtractor={(m) => m.id}
                renderItem={row}
                ItemSeparatorComponent={Hairline}
                contentContainerStyle={{ paddingBottom: spacing.section }}
                showsVerticalScrollIndicator={false}
              />
            ))}
        </>
      )}
    </View>
  );
}
