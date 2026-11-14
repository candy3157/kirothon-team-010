import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { brandOf, cinemaName, cinemasFromCsv, decodeCsv, parseCsv, type CinemaRecord } from '../src/data/cinemaCsv.js';
import { epsg5174ToWgs84 } from '../src/data/geo5174.js';
import { RealShowtimeProvider, demoShowtimes } from '../src/data/real.js';
import { TmdbMovieCatalog, type FetchJson } from '../src/data/tmdb.js';
import { parseBusinessTime } from '../src/time.js';

const NOW = new Date('2026-11-14T14:00:00+09:00');
const now = () => NOW;

/** 위경도 두 점 사이 거리(km) */
function km(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const r = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * r;
  const dLon = (b.longitude - a.longitude) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * r) * Math.cos(b.latitude * r) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

describe('EPSG:5174 -> WGS84', () => {
  it('광화문 씨네큐브(새문안로 68) 좌표가 광화문 근처로 바뀐다', () => {
    const p = epsg5174ToWgs84(197482.205329945, 451938.30792481);
    // 흥국생명빌딩 부근(대략값). 큰 오류(좌표계·부호 실수)를 잡기 위한 1km 허용.
    expect(km(p, { latitude: 37.5703, longitude: 126.9725 })).toBeLessThan(1);
  });
  it('부산 서면 근처 좌표도 한국 안에 있다', () => {
    // 부산 좌표는 원점에서 멀다(약 300km). TM 역변환 고차항 확인용.
    const p = epsg5174ToWgs84(386000, 186000);
    expect(p.latitude).toBeGreaterThan(35);
    expect(p.latitude).toBeLessThan(35.4);
    expect(p.longitude).toBeGreaterThan(128.9);
    expect(p.longitude).toBeLessThan(129.2);
  });
});

describe('영화관 CSV', () => {
  it.each([
    ['CGV 대학로 1관', 'CGV 대학로'],
    ['CGV대학로 5관 [CGV아트하우스]', 'CGV 대학로'],
    ['CGV피카디리1958 4관', 'CGV 피카디리1958'],
    ['(주) CGV 강릉지점 6관', 'CGV 강릉'],
    ['메가박스중앙(주) 송도지점 DOLBY CINEMA관', '메가박스 송도'],
    ['메가박스 별내점(제1관)', '메가박스 별내'],
    ['메가박스 검단점 COMFORT 5관', '메가박스 검단'],
    ['롯데시네마청량리 제7관', '롯데시네마 청량리'],
    ['롯데시네마 라페스타(3관)', '롯데시네마 라페스타'],
    ['롯데컬처웍스(주) 도곡1관', '롯데시네마 도곡'],
    ['CGV연남 1관(4DX)', 'CGV 연남'],
    ['독립영화전용관 인디스페이스', '독립영화전용관 인디스페이스'],
  ])('%s -> %s', (raw, want) => {
    expect(cinemaName(raw)).toBe(want);
  });

  it('브랜드를 나눈다', () => {
    expect(brandOf('씨지브이 강남')).toBe('cgv');
    expect(brandOf('롯데컬처웍스(주) 도곡1관')).toBe('lotte');
    expect(brandOf('메가박스중앙(주) 사상지점 7관')).toBe('megabox');
    expect(brandOf('씨네큐브광화문 1관')).toBe('other');
  });

  it('따옴표 안의 쉼표와 "" 를 처리한다', () => {
    expect(parseCsv('a,"b, c","d ""e"""\r\n1,2,3\n')).toEqual([
      ['a', 'b, c', 'd "e"'],
      ['1', '2', '3'],
    ]);
  });

  it('CP949 바이트를 읽는다', () => {
    // "영화" (CP949: BF B5 C8 AD)
    expect(decodeCsv(new Uint8Array([0xbf, 0xb5, 0xc8, 0xad]))).toBe('영화');
  });

  const H = '관리번호,영업상태명,사업장명,도로명주소,지번주소,좌표정보(X),좌표정보(Y)';
  const csv = [
    H,
    '1,영업/정상,CGV 대학로 1관,"서울특별시 종로구 대학로 120, 4층 (명륜4가)",,199966.1 ,453015.2 ',
    '2,영업/정상,CGV대학로 5관 [CGV아트하우스],"서울특별시 종로구 대학로 120, 5층 (명륜4가)",,199966.1 ,453015.2 ',
    '3,영업/정상,허리우드클래식,서울특별시 종로구 삼일대로 428 (낙원동),,198852.9,452253.9',
    '4,영업/정상,낭만극장,"서울특별시 종로구 삼일대로 428, 4층 (낙원동)",,198852.9,452253.9',
    '5,폐업,미로스페이스,서울특별시 종로구 경희궁1길 1,,197428.9,452041.1',
    '6,영업/정상,좌표없음극장,서울특별시 어딘가,,,',
  ].join('\r\n');

  it('상영관 행을 영화관으로 묶고, 폐업·좌표 없음은 뺀다', () => {
    const { cinemas, stats } = cinemasFromCsv(csv);
    expect(stats).toMatchObject({ rows: 6, active: 5, noCoord: 1, cinemas: 3 });
    const cgv = cinemas.find((c) => c.brand === 'cgv')!;
    expect(cgv).toMatchObject({ name: 'CGV 대학로', address: '서울특별시 종로구 대학로 120', screens: 2 });
    expect(cgv.cinemaId).toMatch(/^cin_[0-9a-f]{12}$/);
    // 같은 건물의 다른 독립관은 따로 둔다
    expect(cinemas.filter((c) => c.brand === 'other').map((c) => c.name).sort()).toEqual(['낭만극장', '허리우드클래식']);
    // id는 다시 읽어도 같다
    expect(cinemasFromCsv(csv).cinemas.map((c) => c.cinemaId)).toEqual(cinemas.map((c) => c.cinemaId));
  });

  it('필요한 열이 없으면 오류', () => {
    expect(() => cinemasFromCsv('a,b\n1,2')).toThrow(/필요한 열/);
  });
});

// ---------- TMDB ----------

interface Call {
  url: string;
  headers: Record<string, string>;
}

function tmdbFetch(opts: { fail?: boolean; calls?: Call[] } = {}): FetchJson {
  return async (url, init) => {
    opts.calls?.push({ url, headers: init.headers });
    if (opts.fail) throw new Error('down');
    const u = new URL(url);
    if (u.pathname.endsWith('/movie/now_playing')) {
      const page = Number(u.searchParams.get('page'));
      const results =
        page === 1
          ? [
              { id: 11, title: '영화 하나', original_title: 'Movie One', poster_path: '/one.jpg' },
              { id: 22, title: '영화 둘', original_title: '영화 둘', poster_path: null },
            ]
          : [{ id: 11, title: '영화 하나(중복)' }];
      return { ok: true, status: 200, json: async () => ({ results, total_pages: 2 }) };
    }
    const id = Number(u.pathname.split('/').pop());
    if (id === 22) return { ok: false, status: 500, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ runtime: 131, poster_path: '/one-detail.jpg' }) };
  };
}

const TMDB = { apiUrl: 'https://api.themoviedb.org/3', imageUrl: 'https://image.tmdb.org/t/p/w342', apiKey: 'v3key' };

describe('TmdbMovieCatalog', () => {
  it('상영작을 Movie로 바꾸고 상세로 러닝타임·포스터를 채운다', async () => {
    const c = new TmdbMovieCatalog(TMDB, { fetch: tmdbFetch(), now });
    const snap = await c.list();
    expect(snap?.movies).toEqual([
      {
        movieId: 'tmdb_11',
        title: '영화 하나',
        originalTitle: 'Movie One',
        posterUrl: 'https://image.tmdb.org/t/p/w342/one-detail.jpg',
        runtimeMinutes: 131,
      },
      // 상세 실패: 목록 값만 쓰고, 원제가 같으면 null
      { movieId: 'tmdb_22', title: '영화 둘', originalTitle: null, posterUrl: null, runtimeMinutes: null },
    ]);
  });

  it('v3 키는 api_key 쿼리, v4 토큰은 Authorization 헤더로 보낸다', async () => {
    const calls: Call[] = [];
    await new TmdbMovieCatalog(TMDB, { fetch: tmdbFetch({ calls }), now }).list();
    expect(new URL(calls[0]!.url).searchParams.get('api_key')).toBe('v3key');
    expect(new URL(calls[0]!.url).searchParams.get('region')).toBe('KR');

    const calls4: Call[] = [];
    await new TmdbMovieCatalog({ ...TMDB, apiKey: 'eyJtoken' }, { fetch: tmdbFetch({ calls: calls4 }), now }).list();
    expect(calls4[0]!.headers.Authorization).toBe('Bearer eyJtoken');
    expect(calls4[0]!.url).not.toContain('eyJtoken');
  });

  it('10분 안에는 다시 부르지 않고, 동시 호출은 한 번으로 합친다', async () => {
    const calls: Call[] = [];
    const c = new TmdbMovieCatalog(TMDB, { fetch: tmdbFetch({ calls }), now });
    await Promise.all([c.list(), c.list()]);
    const n = calls.length;
    await c.list();
    expect(calls.length).toBe(n);
  });

  it('실패하면 null, 이전 결과가 있으면 그 결과를 쓴다', async () => {
    expect(await new TmdbMovieCatalog(TMDB, { fetch: tmdbFetch({ fail: true }), now }).list()).toBeNull();

    let t = NOW.getTime();
    let fail = false;
    const f: FetchJson = (url, init) => tmdbFetch({ fail })(url, init);
    const c = new TmdbMovieCatalog(TMDB, { fetch: f, now: () => new Date(t) });
    const first = await c.list();
    fail = true;
    t += 11 * 60_000;
    expect((await c.list())?.movies).toEqual(first?.movies);
  });
});

// ---------- RealShowtimeProvider ----------

const CINEMAS: CinemaRecord[] = Array.from({ length: 30 }, (_, i) => ({
  cinemaId: `cin_${String(i).padStart(12, '0')}`,
  name: `CGV 테스트${i}`,
  address: '서울',
  location: { latitude: 37.5 + i * 0.002, longitude: 127.0 + i * 0.002 },
  brand: 'cgv' as const,
  screens: 6,
}));

const fixedCatalog = (movies = [{ movieId: 'tmdb_11', title: '영화 하나', runtimeMinutes: 131 }]) => ({
  list: async () => ({ movies, fetchedAt: '2026-11-14T13:00:00.000Z' }),
});

describe('RealShowtimeProvider (데모 회차)', () => {
  it('영화 목록은 카탈로그에서, 회차가 있으면 isShowingToday', async () => {
    const p = new RealShowtimeProvider(fixedCatalog(), CINEMAS, { now });
    const r = await p.searchMovies();
    expect(r.source).toBe('sample'); // 회차가 가짜라서
    expect(r.movies[0]).toMatchObject({ movieId: 'tmdb_11', isShowingToday: true });
    expect((await p.searchMovies('없는제목')).movies).toEqual([]);
  });

  it('회차는 영업일마다 같은 값이고, 형식이 맞다', async () => {
    const p = new RealShowtimeProvider(fixedCatalog(), CINEMAS, { now });
    const a = await p.getMovieShowtimes('tmdb_11', '2026-11-14');
    const b = await p.getMovieShowtimes('tmdb_11', '2026-11-14');
    expect(a.status).toBe('ok');
    expect(a.showtimes.length).toBeGreaterThan(0);
    expect(a.showtimes).toEqual(b.showtimes);
    const ids = new Set(a.cinemas.map((c) => c.cinemaId));
    for (const s of a.showtimes) {
      expect(ids.has(s.cinemaId)).toBe(true);
      const m = parseBusinessTime(s.businessTime);
      expect(m).toBeGreaterThanOrEqual(9 * 60);
      expect(m).toBeLessThanOrEqual(25 * 60 + 30);
      expect(s.showtimeId).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it('회차 간격은 러닝타임보다 길다', () => {
    const list = demoShowtimes(CINEMAS[0]!, { movieId: 'tmdb_11', title: 'x', runtimeMinutes: 131 }, '2026-11-14');
    for (let i = 1; i < list.length; i++) {
      expect(parseBusinessTime(list[i]!.businessTime) - parseBusinessTime(list[i - 1]!.businessTime)).toBeGreaterThan(131);
    }
  });

  it('없는 영화는 not_found, 카탈로그 실패는 unavailable', async () => {
    const p = new RealShowtimeProvider(fixedCatalog(), CINEMAS, { now });
    expect((await p.getMovieShowtimes('tmdb_999')).status).toBe('not_found');
    const down = new RealShowtimeProvider({ list: async () => null }, CINEMAS, { now });
    expect((await down.getMovieShowtimes('tmdb_11')).status).toBe('unavailable');
    expect((await down.searchMovies()).status).toBe('unavailable');
  });
});

describe('설정', () => {
  it('잘못된 공급자 이름은 오류지만 값은 메시지에 넣지 않는다', () => {
    expect(() => loadConfig({ ROUTE_PROVIDER: 'secret123' })).toThrow(/ROUTE_PROVIDER/);
    expect(() => loadConfig({ ROUTE_PROVIDER: 'secret123' })).not.toThrow(/secret123/);
    expect(() => loadConfig({ SHOWTIME_PROVIDER: 'secret123' })).not.toThrow(/secret123/);
  });

  it('real에는 TMDB_API_KEY가 필요하다', () => {
    expect(() => loadConfig({ SHOWTIME_PROVIDER: 'real' })).toThrow(/TMDB_API_KEY/);
    const c = loadConfig({ SHOWTIME_PROVIDER: 'real', TMDB_API_KEY: 'k' });
    expect(c.realData?.cinemaCsvPath).toBe('data/cinemas.csv');
    expect(() => loadConfig({ SHOWTIME_PROVIDER: 'real', TMDB_API_KEY: 'k', TMDB_API_URL: 'http://x.test' })).toThrow(/https/);
  });
});

describe('API 통합 (real 공급자)', () => {
  let app: FastifyInstance;
  afterEach(async () => {
    await app?.close();
  });

  it('/api/movies와 /api/recommendations가 동작한다', async () => {
    const provider = new RealShowtimeProvider(fixedCatalog(), CINEMAS, { now });
    app = buildApp({}, { provider, now });
    const movies = await app.inject('/api/movies');
    expect(movies.statusCode).toBe(200);
    expect(movies.json().movies[0].movieId).toBe('tmdb_11');

    const rec = await app.inject({
      method: 'POST',
      url: '/api/recommendations',
      payload: { movieId: 'tmdb_11', origin: { latitude: 37.5, longitude: 127.0 }, transportMode: 'car' },
    });
    expect(rec.statusCode).toBe(200);
    expect(rec.json().meta.outcome).toBeDefined();
  });
});
