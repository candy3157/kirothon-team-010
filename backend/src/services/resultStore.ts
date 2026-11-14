import { randomBytes } from 'node:crypto';
import { RESULT_TTL_SECONDS } from '../policy.js';
import { addMinutes, toSeoulIso } from '../time.js';
import type {
  Cinema,
  Coverage,
  DataSource,
  Notice,
  Outcome,
  Policy,
  SortBy,
  TransportMode,
  UnreachableCinema,
  UnroutableCinema,
} from '../types.js';

/**
 * 추천 계산 결과 보관소(TTL 메모리, 크기 제한).
 * 회차별 경로·판정 결과만 저장한다. 출발 좌표 원문은 저장하지 않는다(타입에도 필드가 없다).
 * 정렬 변경은 이 저장 결과만으로 다시 계산하며 경로 공급자를 호출하지 않는다.
 */

/** 정렬과 무관하게 고정된 회차 판정. */
export interface StoredShowtime {
  showtimeId: string;
  start: Date;
  /** 오프셋 포함 ISO */
  startTime: string;
  businessTime: string;
  screenName: string | null;
  bookingUrl: string | null;
  feasible: boolean;
  waitMinutes: number;
  spareMinutes: number;
}

/** 경로가 확인된 영화관(도착 가능 회차가 1개 이상). */
export interface StoredRoutedCinema {
  cinema: Cinema;
  travelMinutes: number;
  arrivalTime: string;
  directionsUrl: string | null;
  /** 시작 시각 오름차순. 도착 가능·불가 회차를 모두 담는다. */
  showtimes: StoredShowtime[];
}

/** 정렬 변경 시 그대로 쓰는 고정 부분. */
export interface StoredResult {
  resultId: string;
  movieId: string;
  requestedAt: string;
  departureTime: string;
  transportMode: TransportMode;
  /** 결과를 만든 요청의 정렬. GET에서 sortBy를 생략하면 이 값을 쓴다. */
  sortBy: SortBy;
  outcome: Outcome;
  coverage: Coverage;
  partialFailure: boolean;
  notices: Notice[];
  expiresAt: string;
  source: DataSource;
  lastUpdatedAt: string | null;
  policy: Policy;
  routed: StoredRoutedCinema[];
  unroutableCinemas: UnroutableCinema[];
  unreachableCinemas: UnreachableCinema[];
}

export type NewStoredResult = Omit<StoredResult, 'resultId' | 'expiresAt'>;

export interface ResultStoreOptions {
  ttlSeconds?: number;
  /** 최대 보관 개수. 넘으면 가장 오래된 항목부터 제거한다. */
  maxEntries?: number;
  now?: () => Date;
}

export const DEFAULT_MAX_RESULTS = 1000;

export class ResultStore {
  private readonly ttlSeconds: number;
  private readonly maxEntries: number;
  private readonly now: () => Date;
  /** Map은 삽입 순서를 유지하므로 첫 항목이 가장 오래된 항목이다. */
  private readonly entries = new Map<string, StoredResult>();

  constructor(opts: ResultStoreOptions = {}) {
    this.ttlSeconds = opts.ttlSeconds ?? RESULT_TTL_SECONDS;
    this.maxEntries = Math.max(1, opts.maxEntries ?? DEFAULT_MAX_RESULTS);
    this.now = opts.now ?? (() => new Date());
  }

  get size(): number {
    this.purgeExpired();
    return this.entries.size;
  }

  /** 새 결과를 보관하고 resultId·expiresAt을 채워 돌려준다. */
  put(input: NewStoredResult): StoredResult {
    this.purgeExpired();
    const id = this.newId();
    const stored: StoredResult = {
      ...input,
      resultId: id,
      expiresAt: toSeoulIso(addMinutes(this.now(), this.ttlSeconds / 60)),
    };
    this.entries.set(id, stored);
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
    return stored;
  }

  /** 만료됐거나 없으면 undefined. */
  get(resultId: string): StoredResult | undefined {
    const found = this.entries.get(resultId);
    if (!found) return undefined;
    if (Date.parse(found.expiresAt) <= this.now().getTime()) {
      this.entries.delete(resultId);
      return undefined;
    }
    return found;
  }

  private purgeExpired(): void {
    const t = this.now().getTime();
    for (const [id, r] of this.entries) {
      if (Date.parse(r.expiresAt) <= t) this.entries.delete(id);
    }
  }

  private newId(): string {
    for (;;) {
      const id = `res_${randomBytes(6).toString('hex')}`;
      if (!this.entries.has(id)) return id;
    }
  }
}
