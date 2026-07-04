/**
 * iOS 공유시트 (M4, PRD S3): 어떤 앱에서든 공유 → App Group 공유 큐에 적재 →
 * 온라인이면 즉시 전송 시도. 오프라인이어도 큐에 남아 메인 앱 실행 시 flush된다
 * (RCTAsyncStorageAppGroup으로 메인 앱과 같은 저장소를 쓴다).
 * 분류/태그 UI 없음 (Product Rule 5). 저장은 유실되지 않는다 (Rule 7).
 */
import { close, type InitialProps } from 'expo-share-extension';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { loadToken } from '../lib/api';
import { enqueueCapture, submitCapture, type PendingCapture } from '../lib/captureQueue';
// 디자인 토큰 (DESIGN.md) — 확장은 폰트 로딩이 제한돼 시스템 폰트를 쓴다.
import { colors, rounded, spacing } from '../lib/theme';

function buildCapture(props: InitialProps): PendingCapture | null {
  if (props.url) return { localId: `${Date.now()}`, type: 'link', source_url: props.url };
  const image = props.images?.[0];
  if (image) return { localId: `${Date.now()}`, type: 'image', file_uri: image };
  if (props.text) return { localId: `${Date.now()}`, type: 'thought', raw_text: props.text };
  return null;
}

export default function ShareExtension(props: InitialProps) {
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);
  const capture = useRef(buildCapture(props)).current;

  useEffect(() => {
    if (!capture) close();
  }, [capture]);

  const save = async () => {
    if (!capture || saved) return;
    setSaved(true);
    const withNote = { ...capture, user_note: note.trim() || undefined };
    try {
      await loadToken();
      const sent = await submitCapture(withNote); // 실패 시 내부에서 큐 적재 (오프라인 flush 경로)
      void sent;
    } catch {
      await enqueueCapture(withNote).catch(() => undefined);
    }
    setTimeout(() => close(), 700);
  };

  if (!capture) return null;

  const preview = capture.source_url ?? capture.raw_text ?? 'Image';

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Rudy</Text>
      <Text numberOfLines={2} style={styles.preview}>
        {preview}
      </Text>
      <TextInput
        style={styles.input}
        value={note}
        onChangeText={setNote}
        placeholder="Add a note (optional)"
        placeholderTextColor={colors.mutedSoft}
      />
      <Pressable style={[styles.button, saved && { opacity: 0.5 }]} onPress={save} disabled={saved}>
        <Text style={styles.buttonLabel}>{saved ? 'Got it.' : 'Save to Rudy'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas, padding: spacing.md, gap: spacing.sm },
  title: { fontSize: 15, fontWeight: '600', color: colors.ink },
  preview: { fontSize: 13, color: colors.muted },
  input: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderRadius: rounded.sm,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xs,
    minHeight: 40,
    color: colors.ink,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: rounded.pill,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: { color: colors.onPrimary, fontSize: 15, fontWeight: '500' },
});
