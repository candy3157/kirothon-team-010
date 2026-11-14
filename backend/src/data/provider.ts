import type { Cinema, Coverage, DataSource, Movie, RawShowtime } from '../types.js';
import {
  SAMPLE_CINEMAS,
  SAMPLE_LAST_UPDATED_AT,
  SAMPLE_MOVIES,
  SAMPLE_SHOWTIMES,
} from './sample.js';

/**
 * 상영시간표 공급자 인터페이스. 구현을 교체할 수 있게 서비스는 이 인터페이스만 쓴다.
 * 실패는 예외 대신 status로 알린다. 서비스는 'unavailable'을 unknown으로 처리한다.
 */
export type ProviderStatus = 'ok' | 'unavailable' | 'not_found';

export interface ProviderMeta {
  status: ProviderStatus;
  coverage: Coverage;
  lastUpdatedAt: string | null;
  source: DataSource;
}

export interface MovieSearchResult extends ProviderMeta {
  movies: Movie[];
}

export interface MovieShowtimesResult extends ProviderMeta {
  movie: Movie | null;
  cinemas: Cinema[];
  /** 조회 기준 영업일의 전체 회차(요청 시점 이후 여부는 서비스가 판정). */
  showtimes: RawShowtime[];
  businessDate: string;
}

export interface ShowtimeProvider {
  /** query가 비어 있으면 전체 목록. */
  searchMovies(query?: string): Promise<MovieSearchResult>;
  /** businessDate를 생략하면 오늘 영업일. */
  getMovieShowtimes(movieId: string, businessDate?: string): Promise<MovieShowtimesResult>;
}

/** 현재 시각 기준 오늘 날짜(Asia/Seoul, YYYY-MM-DD). */
export function todayInSeoul(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}

export interface SampleProviderOptions {
  now?: () => Date;
  /** 고정 영업일(테스트용). */
  businessDate?: string;
}

export class SampleShowtimeProvider implements ShowtimeProvider {
  constructor(private readonly opts: SampleProviderOptions = {}) {}

  private date(): string {
    return this.opts.businessDate ?? todayInSeoul(this.opts.now?.());
  }

  private meta(status: ProviderStatus = 'ok'): ProviderMeta {
    return {
      status,
      coverage: 'supported_cinemas',
      lastUpdatedAt: SAMPLE_LAST_UPDATED_AT,
      source: 'sample',
    };
  }

  async searchMovies(query?: string): Promise<MovieSearchResult> {
    const q = (query ?? '').trim().toLowerCase();
    const showing = new Set(SAMPLE_SHOWTIMES.map((s) => s.movieId));
    const movies = SAMPLE_MOVIES.filter(
      (m) =>
        q === '' ||
        m.title.toLowerCase().includes(q) ||
        (m.originalTitle ?? '').toLowerCase().includes(q),
    ).map((m) => ({ ...m, isShowingToday: showing.has(m.movieId) }));
    return { ...this.meta(), movies };
  }

  async getMovieShowtimes(movieId: string, date?: string): Promise<MovieShowtimesResult> {
    // 샘플 시간표는 날짜와 관계없이 매일 같다고 가정한다.
    const businessDate = date ?? this.date();
    const movie = SAMPLE_MOVIES.find((m) => m.movieId === movieId) ?? null;
    if (!movie) {
      return { ...this.meta('not_found'), movie: null, cinemas: [], showtimes: [], businessDate };
    }
    const showtimes: RawShowtime[] = SAMPLE_SHOWTIMES.filter((s) => s.movieId === movieId).map((s) => ({
      ...s,
      businessDate,
    }));
    const ids = new Set(showtimes.map((s) => s.cinemaId));
    const cinemas = SAMPLE_CINEMAS.filter((c) => ids.has(c.cinemaId)).map((c) => ({ ...c }));
    return { ...this.meta(), movie: { ...movie }, cinemas, showtimes, businessDate };
  }
}

export interface FailingProviderOptions {
  /** 이 영화 ID만 실패시킨다. 생략하면 모든 호출 실패. */
  failMovieIds?: readonly string[];
  /** 검색도 실패시킨다(기본 true, failMovieIds 지정 시 false). */
  failSearch?: boolean;
}

/** 공급자 실패 주입용. 내부 SampleShowtimeProvider에 위임하고 지정한 호출만 'unavailable'로 바꾼다. */
export class FailingShowtimeProvider implements ShowtimeProvider {
  private readonly inner: ShowtimeProvider;
  private readonly failIds: ReadonlySet<string> | null;
  private readonly failSearch: boolean;

  constructor(opts: FailingProviderOptions = {}, inner: ShowtimeProvider = new SampleShowtimeProvider()) {
    this.inner = inner;
    this.failIds = opts.failMovieIds ? new Set(opts.failMovieIds) : null;
    this.failSearch = opts.failSearch ?? this.failIds === null;
  }

  private down(): ProviderMeta {
    return { status: 'unavailable', coverage: 'none', lastUpdatedAt: null, source: 'sample' };
  }

  async searchMovies(query?: string): Promise<MovieSearchResult> {
    if (this.failSearch) return { ...this.down(), movies: [] };
    return this.inner.searchMovies(query);
  }

  async getMovieShowtimes(movieId: string, date?: string): Promise<MovieShowtimesResult> {
    if (this.failIds === null || this.failIds.has(movieId)) {
      return { ...this.down(), movie: null, cinemas: [], showtimes: [], businessDate: date ?? todayInSeoul() };
    }
    return this.inner.getMovieShowtimes(movieId, date);
  }
}
