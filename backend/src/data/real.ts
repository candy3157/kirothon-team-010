import type { Movie, RawShowtime } from '../types.js';
import { todayBusinessDate } from '../time.js';
import type { CinemaRecord } from './cinemaCsv.js';
import type { MovieSearchResult, MovieShowtimesResult, ProviderMeta, ProviderStatus, ShowtimeProvider } from './provider.js';
import type { CatalogSnapshot } from './tmdb.js';

/**
 * 실제 영화(TMDB) + 실제 영화관(인허가 CSV) + **데모 회차**.
 * 상영시간표는 공개 출처가 없어서, 영화관·영화·영업일로 정해지는 가짜 회차를 만든다.
 * 회차가 가짜이므로 응답 source는 'sample'로 둔다(실제 상영 정보로 오해하지 않게).
 */

export interface MovieCatalog {
  list(): Promise<CatalogSnapshot | null>;
}

/** FNV-1a 32bit */
export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const FIRST_START = 9 * 60; // 09:00
const LAST_START = 25 * 60 + 30; // 25:30 (다음 날 01:30)
const DEFAULT_RUNTIME = 120;

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** 영화관이 이 영화를 트는지 (영업일과 무관하게 고정). 순위가 높을수록 많은 곳에서 튼다. */
function screens(cinema: CinemaRecord, movieId: string, rank: number): boolean {
  const big = cinema.brand !== 'other';
  const pct = big ? (rank < 5 ? 90 : rank < 10 ? 60 : rank < 20 ? 30 : 12) : rank < 5 ? 30 : rank < 15 ? 10 : 4;
  return hash32(`${cinema.cinemaId}|${movieId}`) % 100 < pct;
}

/** 한 영화관·영화·영업일의 데모 회차 */
export function demoShowtimes(cinema: CinemaRecord, movie: Movie, businessDate: string): RawShowtime[] {
  const h = hash32(`${cinema.cinemaId}|${movie.movieId}|${businessDate}`);
  const runtime = movie.runtimeMinutes ?? DEFAULT_RUNTIME;
  const gap = Math.ceil((runtime + 20 + (h % 4) * 10) / 5) * 5; // 상영 + 정리 20~50분
  const count = 2 + (h % Math.min(5, Math.max(1, cinema.screens)));
  const out: RawShowtime[] = [];
  let t = FIRST_START + ((h >>> 3) % 18) * 10; // 09:00~11:50 시작
  for (let i = 0; i < count && t <= LAST_START; i++, t += gap) {
    const time = hhmm(t);
    out.push({
      showtimeId: `st_${hash32(`${cinema.cinemaId}|${movie.movieId}|${businessDate}|${time}`).toString(36)}`,
      movieId: movie.movieId,
      cinemaId: cinema.cinemaId,
      businessDate,
      businessTime: time,
      screenName: `${1 + ((h >>> 7) % Math.max(1, cinema.screens))}관`,
      bookingUrl: null,
    });
  }
  return out;
}

export class RealShowtimeProvider implements ShowtimeProvider {
  private readonly now: () => Date;

  constructor(
    private readonly catalog: MovieCatalog,
    private readonly cinemas: readonly CinemaRecord[],
    opts: { now?: () => Date } = {},
  ) {
    this.now = opts.now ?? (() => new Date());
  }

  private meta(status: ProviderStatus, snap: CatalogSnapshot | null): ProviderMeta {
    return {
      status,
      coverage: status === 'unavailable' ? 'none' : 'supported_cinemas',
      lastUpdatedAt: snap?.fetchedAt ?? null,
      source: 'sample',
    };
  }

  /** 이 영화를 트는 영화관 (영업일과 무관) */
  private cinemasFor(movieId: string, rank: number): CinemaRecord[] {
    return this.cinemas.filter((c) => screens(c, movieId, rank));
  }

  async searchMovies(query?: string): Promise<MovieSearchResult> {
    const snap = await this.catalog.list();
    if (!snap) return { ...this.meta('unavailable', null), movies: [] };
    const q = (query ?? '').trim().toLowerCase();
    const movies = snap.movies
      .map((m, rank) => ({ m, rank }))
      .filter(
        ({ m }) => q === '' || m.title.toLowerCase().includes(q) || (m.originalTitle ?? '').toLowerCase().includes(q),
      )
      .map(({ m, rank }) => ({ ...m, isShowingToday: this.cinemas.some((c) => screens(c, m.movieId, rank)) }));
    return { ...this.meta('ok', snap), movies };
  }

  async getMovieShowtimes(movieId: string, date?: string): Promise<MovieShowtimesResult> {
    const businessDate = date ?? todayBusinessDate(this.now());
    const snap = await this.catalog.list();
    if (!snap) return { ...this.meta('unavailable', null), movie: null, cinemas: [], showtimes: [], businessDate };
    const rank = snap.movies.findIndex((m) => m.movieId === movieId);
    if (rank < 0) return { ...this.meta('not_found', snap), movie: null, cinemas: [], showtimes: [], businessDate };
    const movie = snap.movies[rank]!;
    const list = this.cinemasFor(movieId, rank);
    const showtimes = list.flatMap((c) => demoShowtimes(c, movie, businessDate));
    const cinemas = list.map(({ cinemaId, name, address, location }) => ({ cinemaId, name, address, location: { ...location } }));
    return { ...this.meta('ok', snap), movie: { ...movie }, cinemas, showtimes, businessDate };
  }
}
