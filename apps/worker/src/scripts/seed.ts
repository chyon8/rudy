/**
 * 데모 시드 (dev 전용): 백데이트한 memory를 주입하고 인라인으로 ingestion을 돌린 뒤,
 * 오늘 브리핑을 삭제하고 정식 엔진으로 재생성한다 — "재발견이 채워진 Home"을 바로 보기 위한 도구.
 * 프로덕션 규칙(하루 1회)을 우회하므로 오직 데모/개발 용도로만 쓴다.
 *
 * 사용법: pnpm -F @rudy/worker seed [email]  (email 생략 시 dev 유저가 1명일 때 자동 선택)
 */
import { createOpenAiAdapters } from '@rudy/ai';
import { createDb, dailyBriefs, memories, users } from '@rudy/db';
import { createStorage, loadEnv, normalizeUrl } from '@rudy/shared';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { generateBriefForUser } from '@rudy/brief';
import { ingestMemory } from '../ingest/pipeline';
import { runInterestEngineForUser } from '../interest/engine';

const env = loadEnv();
const db = createDb(env.DATABASE_URL);
const { llm, embedding } = createOpenAiAdapters(env);
const storage = createStorage(env);

interface SeedItem {
  daysAgo: number;
  type: 'link' | 'thought';
  url?: string;
  text?: string;
}

// 30건 — 형식(유튜브/아티클/생각)·주제·시점을 섞는다. 최근 열흘에 러닝 관련 저장이
// 몰려 있어 Interest Engine의 rising 감지와 reflection 카드까지 검증 가능하다.
const SEEDS: SeedItem[] = [
  // ── 최근 러닝 클러스터 (rising 재료) ──
  { daysAgo: 1, type: 'thought', text: '오늘 처음으로 5km를 안 쉬고 뛰었다. 무릎은 아직 괜찮은 듯.' },
  { daysAgo: 2, type: 'link', url: 'https://www.youtube.com/watch?v=brFHyOtTwH4' },
  { daysAgo: 3, type: 'thought', text: '러닝화 카본화 vs 데일리화 — 초보는 쿠션 좋은 데일리화부터라던데.' },
  { daysAgo: 5, type: 'link', url: 'https://www.runnersworld.com/beginner/a20812270/how-to-start-running-today/' },
  { daysAgo: 6, type: 'thought', text: '10월 하프마라톤 접수 열리면 바로 신청하기. 목표 2시간 15분.' },
  { daysAgo: 8, type: 'thought', text: '사이드 프로젝트 아이디어: 동네 러닝 코스를 기록하고 공유하는 앱' },
  { daysAgo: 9, type: 'link', url: 'https://www.youtube.com/watch?v=_kGESn8ArrU' },
  // ── 배움/생산성 ──
  { daysAgo: 4, type: 'link', url: 'https://www.paulgraham.com/greatwork.html' },
  { daysAgo: 12, type: 'link', url: 'https://nesslabs.com/mindful-productivity' },
  { daysAgo: 15, type: 'link', url: 'https://jamesclear.com/atomic-habits' },
  { daysAgo: 22, type: 'link', url: 'https://jamesclear.com/goals-systems' },
  { daysAgo: 30, type: 'link', url: 'https://fs.blog/mental-models/' },
  { daysAgo: 38, type: 'link', url: 'https://www.youtube.com/watch?v=arj7oStGLkU' },
  { daysAgo: 55, type: 'link', url: 'https://calnewport.com/blog' },
  { daysAgo: 70, type: 'link', url: 'https://www.youtube.com/watch?v=UF8uR6Z6KLc' },
  { daysAgo: 28, type: 'link', url: 'https://waitbutwhy.com/2015/01/artificial-intelligence-revolution-1.html' },
  { daysAgo: 85, type: 'link', url: 'https://waitbutwhy.com/2014/05/life-weeks.html' },
  // ── 생각/아이디어 ──
  { daysAgo: 7, type: 'thought', text: '주말에 홈카페 라떼아트 연습해보기. 우유 스티밍부터.' },
  { daysAgo: 13, type: 'thought', text: '읽은 책을 한 줄로 요약해서 모아두면 연말에 재밌겠다.' },
  { daysAgo: 21, type: 'thought', text: '제주 한 달 살기 하면 뭐부터 할까. 동쪽 vs 서쪽?' },
  { daysAgo: 35, type: 'thought', text: '회의 없는 수요일을 팀에 제안해볼까. 오전만이라도.' },
  { daysAgo: 48, type: 'thought', text: '베란다에 방울토마토 키우기 — 5월이 적기라고 함.' },
  { daysAgo: 60, type: 'thought', text: '부모님 결혼기념일 선물 알아보기 — 여행 상품권이 나으려나' },
  { daysAgo: 95, type: 'thought', text: '영어 회화, 인풋만 늘리지 말고 일주일에 한 번은 말하기 세션.' },
  // ── 여행/음식/문화 ──
  { daysAgo: 18, type: 'link', url: 'https://www.youtube.com/watch?v=9bZkp7q19f0' },
  { daysAgo: 32, type: 'link', url: 'https://www.atlasobscura.com/places' },
  { daysAgo: 45, type: 'link', url: 'https://www.seriouseats.com' },
  { daysAgo: 52, type: 'link', url: 'https://www.sprudge.com' },
  { daysAgo: 90, type: 'link', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
  { daysAgo: 110, type: 'link', url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw' },
];

async function main() {
  const emailArg = process.argv[2];
  const userRows = emailArg
    ? await db.select().from(users).where(and(eq(users.authProvider, 'dev'), eq(users.authId, emailArg)))
    : await db.select().from(users).where(eq(users.authProvider, 'dev'));
  const user = userRows[0];
  if (!user || (userRows.length > 1 && !emailArg)) {
    console.error('사용법: pnpm -F @rudy/worker seed <email> — dev 유저를 특정할 수 없습니다.');
    process.exit(1);
  }
  console.log(`[seed] user: ${user.authId} (${user.locale}, ${user.timezone})`);

  // 1. 백데이트 저장물 주입 (재실행 안전 — 링크는 URL 유니크, thought는 본문 일치로 스킵).
  const inserted: string[] = [];
  for (const item of SEEDS) {
    const createdAt = new Date(Date.now() - item.daysAgo * 24 * 60 * 60 * 1000);
    if (item.text) {
      const dupe = await db
        .select({ id: memories.id })
        .from(memories)
        .where(and(eq(memories.userId, user.id), eq(memories.rawText, item.text), isNull(memories.deletedAt)))
        .limit(1);
      if (dupe[0]) continue;
    }
    const rows = await db
      .insert(memories)
      .values({
        userId: user.id,
        type: item.type,
        sourceUrl: item.url ?? null,
        sourceUrlNormalized: item.url ? normalizeUrl(item.url) : null,
        rawText: item.text ?? null,
        createdAt,
        updatedAt: createdAt,
      })
      .onConflictDoNothing()
      .returning({ id: memories.id });
    if (rows[0]) inserted.push(rows[0].id);
  }
  console.log(`[seed] inserted ${inserted.length} memories`);

  // 2. 분석 안 된 memory 전부 인라인 ingestion (pending + 과거 실패한 degraded 재시도).
  const pendingRows = await db
    .select({ id: memories.id })
    .from(memories)
    .where(
      and(
        eq(memories.userId, user.id),
        isNull(memories.deletedAt),
        inArray(memories.analysisStatus, ['pending', 'degraded']),
      ),
    );
  console.log(`[seed] analyzing ${pendingRows.length} memories…`);
  for (const [i, row] of pendingRows.entries()) {
    try {
      await ingestMemory(row.id, { db, llm, embedding, storage });
      console.log(`  (${i + 1}/${pendingRows.length}) ready`);
    } catch (err) {
      console.error(`  (${i + 1}/${pendingRows.length}) failed:`, err instanceof Error ? err.message : err);
    }
  }

  // 3. Interest Engine 즉시 실행 — 관심사 클러스터·rising까지 만들어 검증 상태 완성.
  console.log('[seed] running interest engine…');
  await runInterestEngineForUser({ db, llm }, { id: user.id, locale: user.locale });

  // 4. 오늘 브리핑 삭제 후 정식 엔진으로 재생성 (데모 전용 — 하루 1회 규칙 우회).
  const local = DateTime.now().setZone(user.timezone || 'UTC');
  const briefDate = local.toISODate()!;
  await db.delete(dailyBriefs).where(and(eq(dailyBriefs.userId, user.id), eq(dailyBriefs.briefDate, briefDate)));
  const result = await generateBriefForUser({ db, llm }, user, briefDate, local);
  console.log(`[seed] brief regenerated: ${result} (${briefDate})`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
