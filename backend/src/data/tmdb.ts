import type { Movie } from '../types.js';

/**
 * TMDB 현재 상영작 목록(now_playing, region=KR)과 상세(러닝타임·포스터).
 * 문서: https://developer.themoviedb.org/reference/movie-now-playing-list
 *       https://developer.themoviedb.org/reference/movie-details
 *       https://developer.themoviedb.org/docs/image-basics
 * 키는 헤더(읽기 토큰) 또는 api_key 쿼리로만 보내고, 응답·로그·오류에 담지 않는다.
 */

export interface TmdbConfig {
  /** 예: https://api.themoviedb.org/3 */
  apiUrl: string;
  /** 포스터 앞부분. 예: https://image.tmdb.org/t/p/w342 */
  imageUrl: string;
  /** v4 읽기 토큰(eyJ…) 또는 v3 API 키 */
  apiKey: string;
}

export type FetchJson = (url: string, init: { headers: Record<string, string>; signal: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export interface CatalogSnapshot {
  movies: Movie[];
  /** 마지막으로 성공한 시각(ISO) */
  fetchedAt: string;
}

const LIST_TTL_MS = 10 * 60_000;
const DETAIL_TTL_MS = 24 * 3600_000;
const TIMEOUT_MS = 5000;
const PAGES = 2; // 페이지당 20편
const DETAIL_CONCURRENCY = 6;

interface ListItem {
  id?: unknown;
  title?: unknown;
  original_title?: unknown;
  poster_path?: unknown;
}
interface Detail {
  runtime?: unknown;
  poster_path?: unknown;
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export class TmdbMovieCatalog {
  private readonly fetch: FetchJson;
  private readonly now: () => Date;
  private snapshot: (CatalogSnapshot & { at: number }) | null = null;
  private inflight: Promise<CatalogSnapshot | null> | null = null;
  private readonly details = new Map<number, { at: number; runtime: number | null; poster: string }>();

  constructor(
    private readonly cfg: TmdbConfig,
    opts: { fetch?: FetchJson; now?: () => Date } = {},
  ) {
    this.fetch = opts.fetch ?? ((url, init) => globalThis.fetch(url, init));
    this.now = opts.now ?? (() => new Date());
  }

  /** 상영작 목록. 실패하면 남은 캐시를, 캐시도 없으면 null. 동시 호출은 한 번으로 합친다. */
  async list(): Promise<CatalogSnapshot | null> {
    const t = this.now().getTime();
    if (this.snapshot && t - this.snapshot.at < LIST_TTL_MS) return this.snapshot;
    if (!this.inflight) {
      this.inflight = this.refresh().finally(() => {
        this.inflight = null;
      });
    }
    return this.inflight;
  }

  private async refresh(): Promise<CatalogSnapshot | null> {
    const items: ListItem[] = [];
    for (let page = 1; page <= PAGES; page++) {
      const body = (await this.get('/movie/now_playing', { language: 'ko-KR', region: 'KR', page: String(page) })) as {
        results?: unknown;
        total_pages?: unknown;
      } | null;
      if (!body || !Array.isArray(body.results)) {
        if (page === 1) return this.snapshot; // 첫 페이지 실패 = 전체 실패
        break;
      }
      items.push(...(body.results as ListItem[]));
      if (typeof body.total_pages === 'number' && page >= body.total_pages) break;
    }

    const seen = new Set<number>();
    const unique = items.filter((it) => {
      const id = Number(it.id);
      if (!Number.isInteger(id) || id <= 0 || seen.has(id) || !str(it.title)) return false;
      seen.add(id);
      return true;
    });

    const movies: Movie[] = new Array(unique.length);
    let next = 0;
    const worker = async () => {
      while (next < unique.length) {
        const i = next++;
        movies[i] = await this.toMovie(unique[i]!);
      }
    };
    await Promise.all(Array.from({ length: Math.min(DETAIL_CONCURRENCY, unique.length) }, worker));

    const at = this.now().getTime();
    this.snapshot = { movies, fetchedAt: this.now().toISOString(), at };
    return this.snapshot;
  }

  private async toMovie(it: ListItem): Promise<Movie> {
    const id = Number(it.id);
    const d = await this.detail(id);
    const title = str(it.title);
    const original = str(it.original_title);
    const poster = d?.poster || str(it.poster_path);
    return {
      movieId: `tmdb_${id}`,
      title,
      originalTitle: original && original !== title ? original : null,
      posterUrl: poster.startsWith('/') ? `${this.cfg.imageUrl.replace(/\/$/, '')}${poster}` : null,
      runtimeMinutes: d?.runtime ?? null,
    };
  }

  private async detail(id: number): Promise<{ runtime: number | null; poster: string } | null> {
    const t = this.now().getTime();
    const hit = this.details.get(id);
    if (hit && t - hit.at < DETAIL_TTL_MS) return hit;
    const body = (await this.get(`/movie/${id}`, { language: 'ko-KR' })) as Detail | null;
    if (!body) return hit ?? null;
    const runtime = Number(body.runtime);
    const v = { at: t, runtime: Number.isInteger(runtime) && runtime > 0 ? runtime : null, poster: str(body.poster_path) };
    this.details.set(id, v);
    return v;
  }

  /** 실패(네트워크·타임아웃·2xx 아님·JSON 아님)는 null */
  private async get(path: string, params: Record<string, string>): Promise<unknown | null> {
    const url = new URL(this.cfg.apiUrl.replace(/\/$/, '') + path);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (this.cfg.apiKey.startsWith('eyJ')) headers.Authorization = `Bearer ${this.cfg.apiKey}`;
    else url.searchParams.set('api_key', this.cfg.apiKey);
    try {
      const res = await this.fetch(url.toString(), { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }
}
