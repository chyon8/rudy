import type { LlmPort } from '@rudy/ai';
import { describe, expect, it } from 'vitest';
import {
  type MemoryPoint,
  clusterMemories,
  computeStats,
  cosineSimilarity,
  reconcile,
  statusOf,
} from './cluster';
import { nameCluster } from './engine';

const NOW = new Date('2026-07-05T00:00:00Z');
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 시드 30건 (PLAN.md M5 verify) — 4개 그룹, 결정적 임베딩(dim 8, 그룹별 직교 축 + 미세 오프셋).
 * coffee 10건(오래됨) / running 9건(최근 몰림 → rising) / reading 8건 / travel 3건(아주 오래됨 → dormant).
 */
interface Seed extends MemoryPoint {
  group: string;
  topics: string[];
}

function embed(axis: number, i: number): number[] {
  const v = new Array<number>(8).fill(0);
  v[axis] = 1;
  v[4] = 0.05 * (i % 5);
  v[5] = 0.03 * (i % 3);
  return v;
}

const GROUPS: Record<string, { axis: number; ages: number[] }> = {
  coffee: { axis: 0, ages: [30, 35, 40, 45, 50, 55, 60, 65, 70, 75] },
  running: { axis: 1, ages: [2, 4, 6, 8, 10, 12, 15, 20, 40] },
  reading: { axis: 2, ages: [20, 30, 40, 50, 60, 70, 80, 90] },
  travel: { axis: 3, ages: [150, 160, 170] },
};

// id 정렬 순서가 곧 k-means 초기 centroid 샘플 위치 — idx 0/7/15/22가 서로 다른 그룹이 되게 배치.
const ORDER = [
  'coffee', 'coffee', 'coffee', 'coffee', 'coffee', 'coffee', 'coffee', // 0-6
  'running', 'coffee', 'coffee', 'coffee', 'running', 'running', 'running', 'running', // 7-14
  'reading', 'running', 'running', 'running', 'running', 'reading', 'reading', // 15-21
  'travel', 'reading', 'reading', 'reading', 'reading', 'reading', 'travel', 'travel', // 22-29
];

function makeSeeds(): Seed[] {
  const used: Record<string, number> = {};
  return ORDER.map((group, i) => {
    const j = used[group] ?? 0;
    used[group] = j + 1;
    const { axis, ages } = GROUPS[group]!;
    return {
      id: `m${String(i).padStart(2, '0')}`,
      group,
      topics: [group],
      embedding: embed(axis, i),
      createdAt: new Date(NOW.getTime() - ages[j]! * DAY_MS),
    };
  });
}

function dominantGroup(seeds: Seed[], memberIds: string[]): string {
  const byId = new Map(seeds.map((s) => [s.id, s.group]));
  const counts = new Map<string, number>();
  for (const id of memberIds) {
    const g = byId.get(id)!;
    counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
}

describe('Interest Engine — 시드 30건 (docs/spec.md §5)', () => {
  const seeds = makeSeeds();
  const clusters = clusterMemories(seeds);

  it('k=⌈30/8⌉=4 클러스터가 그룹 그대로 생성된다', () => {
    const summary = clusters
      .map((c) => ({ group: dominantGroup(seeds, c.memberIds), size: c.memberIds.length }))
      .sort((a, b) => b.size - a.size);
    expect(summary).toEqual([
      { group: 'coffee', size: 10 },
      { group: 'running', size: 9 },
      { group: 'reading', size: 8 },
      { group: 'travel', size: 3 },
    ]);
  });

  it('reconcile: 기존 coffee interest는 in-place 매칭, 미매칭 3개 신규, 고아는 dormant 대상', () => {
    const existing = [
      { id: 'existing-coffee', centroid: embed(0, 1) },
      { id: 'orphan-old', centroid: embed(6, 0) }, // 어떤 클러스터와도 안 맞는 방향
    ];
    const r = reconcile(clusters, existing);
    expect(r.matched.map((m) => m.interestId)).toEqual(['existing-coffee']);
    expect(dominantGroup(seeds, r.matched[0]!.cluster.memberIds)).toBe('coffee');
    expect(r.created).toHaveLength(3);
    expect(r.orphanedIds).toEqual(['orphan-old']);
  });

  it('running은 rising, coffee·reading은 stable, travel은 낮은 strength로 dormant', () => {
    const stats = clusters.map((c) => {
      const dates = seeds.filter((s) => c.memberIds.includes(s.id)).map((s) => s.createdAt);
      return { group: dominantGroup(seeds, c.memberIds), ...computeStats(dates, NOW) };
    });
    const maxRaw = Math.max(...stats.map((s) => s.strengthRaw));
    const statuses = Object.fromEntries(
      stats.map((s) => [s.group, statusOf(s.momentum, s.strengthRaw / maxRaw)]),
    );
    expect(statuses).toEqual({
      coffee: 'stable',
      running: 'rising',
      reading: 'stable',
      travel: 'dormant',
    });
  });

  it('신규 클러스터 이름은 LLM 결과를 쓰고, LLM 실패 시 최빈 topic으로 폴백', async () => {
    const running = clusters.find((c) => dominantGroup(seeds, c.memberIds) === 'running')!;
    const memById = new Map(seeds.map((s) => [s.id, { title: `${s.group} item`, topics: s.topics }]));

    const okLlm = { nameInterest: async () => '러닝' } as unknown as LlmPort;
    await expect(nameCluster(okLlm, 'ko', running, memById)).resolves.toBe('러닝');

    const brokenLlm = { nameInterest: async () => Promise.reject(new Error('down')) } as unknown as LlmPort;
    await expect(nameCluster(brokenLlm, 'ko', running, memById)).resolves.toBe('running');
  });

  it('cosineSimilarity: 같은 그룹 ≈ 1, 다른 그룹 ≈ 0', () => {
    expect(cosineSimilarity(seeds[0]!.embedding, seeds[1]!.embedding)).toBeGreaterThan(0.98);
    expect(cosineSimilarity(seeds[0]!.embedding, seeds[7]!.embedding)).toBeLessThan(0.1);
  });
});
