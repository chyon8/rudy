/**
 * Interest Engine 순수 로직 (docs/spec.md §5) — k-means 클러스터링, reconcile 매칭,
 * strength/momentum/status 계산. DB·LLM 접근은 engine.ts가 담당한다.
 */

export interface MemoryPoint {
  id: string;
  embedding: number[];
  createdAt: Date;
}

export interface Cluster {
  centroid: number[];
  memberIds: string[];
}

export interface ExistingInterest {
  id: string;
  centroid: number[] | null;
}

export interface Reconciled {
  /** cosine ≥ 0.8로 기존 interest와 매칭된 클러스터 — in-place 갱신 (F6). */
  matched: { interestId: string; cluster: Cluster }[];
  /** 미매칭 클러스터 — 신규 생성 (이름은 LLM). */
  created: Cluster[];
  /** 어떤 클러스터와도 매칭 안 된 기존 interest — 삭제 대신 dormant (F6). */
  orphanedIds: string[];
}

const MIN_CLUSTER_SIZE = 3;
const MAX_K = 10;
const RECONCILE_THRESHOLD = 0.8;
const MAX_ITERATIONS = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function meanVector(vectors: number[][]): number[] {
  const out = new Array<number>(vectors[0]!.length).fill(0);
  for (const v of vectors) {
    for (let i = 0; i < v.length; i++) out[i] = out[i]! + v[i]!;
  }
  return out.map((x) => x / vectors.length);
}

/**
 * k-means (k=⌈n/8⌉ 최대 10, min cluster size 3). 초기 centroid는 id 정렬 후
 * 균등 간격 샘플 — 시드 랜덤 없이 결정적이라 테스트가 재현 가능하다.
 */
export function clusterMemories(points: MemoryPoint[]): Cluster[] {
  if (points.length < MIN_CLUSTER_SIZE) return [];
  const k = Math.min(Math.ceil(points.length / 8), MAX_K);

  const sorted = [...points].sort((a, b) => a.id.localeCompare(b.id));
  let centroids = Array.from(
    { length: k },
    (_, i) => sorted[Math.floor((i * sorted.length) / k)]!.embedding,
  );

  let assignment: number[] = [];
  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const next = sorted.map((p) => {
      let best = 0;
      let bestSim = -Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const sim = cosineSimilarity(p.embedding, centroids[c]!);
        if (sim > bestSim) {
          bestSim = sim;
          best = c;
        }
      }
      return best;
    });
    if (next.every((v, i) => v === assignment[i])) break;
    assignment = next;
    centroids = centroids.map((prev, c) => {
      const members = sorted.filter((_, i) => assignment[i] === c);
      return members.length === 0 ? prev : meanVector(members.map((m) => m.embedding));
    });
  }

  const clusters: Cluster[] = [];
  for (let c = 0; c < centroids.length; c++) {
    const memberIds = sorted.filter((_, i) => assignment[i] === c).map((p) => p.id);
    if (memberIds.length >= MIN_CLUSTER_SIZE) {
      clusters.push({ centroid: centroids[c]!, memberIds });
    }
  }
  return clusters;
}

/** 클러스터 ↔ 기존 interest를 유사도 내림차순 그리디 1:1 매칭 (cosine ≥ 0.8). */
export function reconcile(clusters: Cluster[], existing: ExistingInterest[]): Reconciled {
  const pairs: { clusterIdx: number; interestId: string; similarity: number }[] = [];
  for (let i = 0; i < clusters.length; i++) {
    for (const interest of existing) {
      if (!interest.centroid) continue;
      const similarity = cosineSimilarity(clusters[i]!.centroid, interest.centroid);
      if (similarity >= RECONCILE_THRESHOLD) {
        pairs.push({ clusterIdx: i, interestId: interest.id, similarity });
      }
    }
  }
  pairs.sort((a, b) => b.similarity - a.similarity);

  const matched: Reconciled['matched'] = [];
  const usedClusters = new Set<number>();
  const usedInterests = new Set<string>();
  for (const p of pairs) {
    if (usedClusters.has(p.clusterIdx) || usedInterests.has(p.interestId)) continue;
    usedClusters.add(p.clusterIdx);
    usedInterests.add(p.interestId);
    matched.push({ interestId: p.interestId, cluster: clusters[p.clusterIdx]! });
  }

  return {
    matched,
    created: clusters.filter((_, i) => !usedClusters.has(i)),
    orphanedIds: existing.filter((e) => !usedInterests.has(e.id)).map((e) => e.id),
  };
}

export interface InterestStats {
  memoryCount: number;
  /** Σ exp(−age_days/60) — 정규화 전 원값. 사용자 interest 전체의 max로 나눠 0~1. */
  strengthRaw: number;
  /** (최근 14일 신규) / (이전 14일 신규 + 1), 0~1 클리핑. */
  momentum: number;
}

export function computeStats(memberCreatedAts: Date[], now: Date): InterestStats {
  let strengthRaw = 0;
  let recent = 0;
  let prev = 0;
  for (const createdAt of memberCreatedAts) {
    const ageDays = (now.getTime() - createdAt.getTime()) / DAY_MS;
    strengthRaw += Math.exp(-ageDays / 60);
    if (ageDays < 14) recent++;
    else if (ageDays < 28) prev++;
  }
  return {
    memoryCount: memberCreatedAts.length,
    strengthRaw,
    momentum: Math.min(1, recent / (prev + 1)),
  };
}

export function statusOf(momentum: number, strength: number): 'rising' | 'stable' | 'dormant' {
  if (momentum >= 0.5) return 'rising';
  if (strength < 0.1) return 'dormant';
  return 'stable';
}
