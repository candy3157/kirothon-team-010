import { describe, expect, it } from 'vitest';
import {
  SampleShowtimeProvider,
  type MovieShowtimesResult,
  type ShowtimeProvider,
} from '../src/data/provider.js';
import { SAMPLE_CINEMAS } from '../src/data/sample.js';
import { MockRouteProvider } from '../src/routing/mock.js';
import { recommend, resort } from '../src/services/recommend.js';
import { ResultStore } from '../src/services/resultStore.js';
import type { RecommendationRequest } from '../src/types.js';

/** 백엔드 통합 테스트: 서비스 계층(recommend/resort) + 샘플 공급자 + mock 경로 공급자. */

const NOW = new Date('2026-11-14T13:58:00+09:00');
const ORIGIN = { latitude: 37.5, longitude: 127.03 };

type RouteOpts = ConstructorParameters<typeof MockRouteProvider>[0];

function setup(opts: { routes?: RouteOpts; now?: () => Date; showtimes?: (now: () => Date) => ShowtimeProvider } = {}) {
  const now = opts.now ?? (() => NOW);
  const routes = new MockRouteProvider({
    fixedMinutes: {
      cin_gangnam: { transit: 25, car: 15 },
      cin_jamsil: { transit: 30, car: 12 },
      cin_suwon: { transit: 65, car: 40 },
    },
    ...opts.routes,
  });
  const store = new ResultStore({ now });
  const showtimes = opts.showtimes ? opts.showtimes(now) : new SampleShowtimeProvider({ now });
  return { routes, store, deps: { showtimes, routes, store, now } };
}

const req = (over: Partial<RecommendationRequest> = {}): RecommendationRequest => ({
  movieId: 'movie_001',
  origin: ORIGIN,
  transportMode: 'transit',
  departureTime: '2026-11-14T14:00:00+09:00',
  ...over,
});

describe('AT-08 영화관당 경로 1회 호출', () => {
  it('같은 영화관의 여러 회차(14:40, 16:30)에 경로 결과를 재사용한다', async () => {
    const { routes, deps } = setup();
    const r = await recommend(deps, req());
    expect(routes.callCountFor('cin_gangnam')).toBe(1);
    expect(routes.callCount).toBe(3); // 후보 영화관 수와 같다
    const g = r.cinemas.find((c) => c.cinemaId === 'cin_gangnam')!;
    const byId = Object.fromEntries(g.showtimes.map((s) => [s.showtimeId, s]));
    expect(byId['st_gangnam_1430']!.verdict).toBe('unarrivable');
    expect(byId['st_gangnam_1440']!.verdict).toBe('arrivable');
    expect(byId['st_gangnam_1630']!.verdict).toBe('arrivable');
    expect(g.travelMinutes).toBe(25);
  });
});

describe('AT-09 상영 중이나 도착 가능 회차 없음', () => {
  it('미상영이 아니라 no_feasible_showtime으로 구분한다', async () => {
    const at = () => new Date('2026-11-14T08:50:00+09:00');
    const { deps } = setup({ now: at });
    const late = await recommend(deps, req({ movieId: 'movie_002', transportMode: 'car', departureTime: '2026-11-14T11:45:00+09:00' }));
    expect(late.meta.outcome).toBe('no_feasible_showtime');
    expect(late.meta.outcome).not.toBe('not_showing');
    expect(late.cinemas).toEqual([]);
    expect(late.unreachableCinemas.length).toBeGreaterThan(0);
  });

  it('유효 회차가 없는 영화는 not_showing이고 경로를 호출하지 않는다', async () => {
    const { routes, deps } = setup();
    const r = await recommend(deps, req({ movieId: 'movie_003' }));
    expect(r.meta.outcome).toBe('not_showing');
    expect(routes.callCount).toBe(0);
  });
});

describe('AT-10 이동수단 변경 시 재계산', () => {
  it('이동시간과 대기·여유가 바뀐 값으로 다시 계산된다', async () => {
    const { deps } = setup();
    const transit = await recommend(deps, req({ transportMode: 'transit' }));
    const car = await recommend(deps, req({ transportMode: 'car' }));
    expect(car.meta.resultId).not.toBe(transit.meta.resultId);
    expect(car.meta.transportMode).toBe('car');

    const tG = transit.cinemas.find((c) => c.cinemaId === 'cin_gangnam')!;
    const cG = car.cinemas.find((c) => c.cinemaId === 'cin_gangnam')!;
    expect(tG.travelMinutes).toBe(25);
    expect(cG.travelMinutes).toBe(15);
    // 자차는 14:30 회차도 관람 가능해진다: 도착 14:15, 준비 완료 14:25, 대기 15분, 여유 5분.
    expect(tG.showtimes.find((s) => s.showtimeId === 'st_gangnam_1430')!.verdict).toBe('unarrivable');
    const c1430 = cG.showtimes.find((s) => s.showtimeId === 'st_gangnam_1430')!;
    expect(c1430).toMatchObject({ verdict: 'arrivable', waitMinutes: 15, spareMinutes: 5 });
    expect(cG.representativeShowtimeId).toBe('st_gangnam_1430');
    expect(tG.representativeShowtimeId).toBe('st_gangnam_1440');
  });
});

describe('AT-11 일부 경로 실패 분리', () => {
  it('실패 영화관은 unroutable로 분리하고 나머지는 정상 추천한다', async () => {
    const { deps } = setup({ routes: { failures: { cin_jamsil: 'route_timeout' } } });
    const r = await recommend(deps, req());
    expect(r.meta.outcome).toBe('recommended');
    expect(r.meta.partialFailure).toBe(true);
    expect(r.unroutableCinemas.map((c) => [c.cinemaId, c.routeStatus])).toEqual([['cin_jamsil', 'route_timeout']]);
    expect(r.cinemas.map((c) => c.cinemaId)).not.toContain('cin_jamsil');
    expect(r.unreachableCinemas.map((c) => c.cinemaId)).not.toContain('cin_jamsil'); // 도착 불가와 구분
    expect(r.cinemas.length).toBeGreaterThan(0);
  });
});

describe('AT-13 부분 데이터 표시', () => {
  it('일부 영화관만 수집된 경우 partial_coverage 알림과 coverage를 전달한다', async () => {
    const partial = (now: () => Date): ShowtimeProvider => {
      const inner = new SampleShowtimeProvider({ now });
      return {
        searchMovies: (q) => inner.searchMovies(q),
        async getMovieShowtimes(movieId): Promise<MovieShowtimesResult> {
          const r = await inner.getMovieShowtimes(movieId);
          return { ...r, coverage: 'partial' };
        },
      };
    };
    const { deps } = setup({ showtimes: partial });
    const r = await recommend(deps, req());
    expect(r.meta.coverage).toBe('partial');
    expect(r.meta.notices.map((n) => n.code)).toContain('partial_coverage');
  });

  it('공급자 실패는 미상영이 아니라 availability_unknown으로 알린다', async () => {
    const { routes, deps } = setup();
    const failing = {
      ...deps,
      showtimes: {
        searchMovies: deps.showtimes.searchMovies.bind(deps.showtimes),
        getMovieShowtimes: async () => {
          throw new Error('provider down');
        },
      },
    };
    const r = await recommend(failing, req());
    expect(r.meta.outcome).toBe('availability_unknown');
    expect(r.meta.outcome).not.toBe('not_showing');
    expect(r.meta.notices.length).toBeGreaterThan(0);
    expect(routes.callCount).toBe(0);
  });

  it('샘플 데이터는 source와 sample_data 알림으로 구분된다', async () => {
    const { deps } = setup();
    const r = await recommend(deps, req());
    expect(r.meta.source).toBe('sample');
    expect(r.meta.notices.map((n) => n.code)).toContain('sample_data');
  });
});

describe('AT-14 예매 가능 단정 금지', () => {
  it('좌석·예매 정보가 없으면 bookingUrl은 null이고 판정은 도착 기준 값만 쓴다', async () => {
    const { deps } = setup();
    const r = await recommend(deps, req());
    const all = [...r.cinemas.flatMap((c) => c.showtimes), ...r.unreachableCinemas.flatMap((c) => c.showtimes)];
    // 예매 링크가 없는 회차(잠실 15:00)는 null.
    const jamsil = r.cinemas.find((c) => c.cinemaId === 'cin_jamsil')!;
    expect(jamsil.showtimes.every((s) => s.bookingUrl === null)).toBe(true);
    // 도착 불가 회차는 링크를 내보내지 않는다.
    const t1430 = all.find((s) => s.showtimeId === 'st_gangnam_1430')!;
    expect(t1430.bookingUrl).toBeNull();
    for (const s of all) expect(['arrivable', 'unarrivable']).toContain(s.verdict);
  });

  it('응답에 좌석·예매 가능을 뜻하는 필드나 문구가 없다', async () => {
    const { deps } = setup();
    const json = JSON.stringify(await recommend(deps, req()));
    expect(json).not.toMatch(/seat|bookable|예매 가능|좌석 있음|잔여/i);
  });
});

describe('AT-17 정렬 변경 시 경로 호출 횟수 불변', () => {
  it('resort는 경로 공급자를 다시 호출하지 않고 순위만 갱신한다', async () => {
    const { routes, deps } = setup();
    const first = await recommend(deps, req());
    const calls = routes.callCount;
    expect(calls).toBeGreaterThan(0);
    for (const sortBy of ['travel', 'earliest', 'balanced'] as const) {
      const r = resort(deps, first.meta.resultId, sortBy);
      expect(r.meta.sortBy).toBe(sortBy);
      expect(r.meta.resultId).toBe(first.meta.resultId);
      expect(r.cinemas.map((c) => c.rank)).toEqual(r.cinemas.map((_, i) => i + 1));
      expect(routes.callCount).toBe(calls);
    }
    const travel = resort(deps, first.meta.resultId, 'travel');
    const earliest = resort(deps, first.meta.resultId, 'earliest');
    expect(travel.cinemas[0]!.travelMinutes).toBe(25);
    expect(earliest.cinemas[0]!.representativeShowtimeId).toBe('st_gangnam_1440');
  });
});

describe('AT-18 도착 불가 하한 판정', () => {
  const at = () => new Date('2026-11-14T20:50:00+09:00');
  const busan = SAMPLE_CINEMAS.find((c) => c.cinemaId === 'cin_busan')!;
  const lateProvider = (): ShowtimeProvider => ({
    async searchMovies() {
      return { status: 'ok', coverage: 'supported_cinemas', lastUpdatedAt: null, source: 'sample', movies: [] };
    },
    async getMovieShowtimes(movieId): Promise<MovieShowtimesResult> {
      return {
        status: 'ok',
        coverage: 'supported_cinemas',
        lastUpdatedAt: null,
        source: 'sample',
        movie: { movieId, title: '야간 영화', originalTitle: null, posterUrl: null, runtimeMinutes: 100 },
        cinemas: [{ ...busan }],
        showtimes: [
          { showtimeId: 'st_busan_2300', movieId, cinemaId: busan.cinemaId, businessDate: '2026-11-14', businessTime: '23:00', screenName: null, bookingUrl: null },
        ],
        businessDate: '2026-11-14',
      };
    },
  });

  it('출발 21:00, 300km, 마지막 회차 23:00이면 경로 호출 없이 도착 불가', async () => {
    const { routes, deps } = setup({ now: at, showtimes: lateProvider });
    const r = await recommend(deps, req({ movieId: 'movie_late', transportMode: 'car', departureTime: '2026-11-14T21:00:00+09:00' }));
    expect(routes.callCount).toBe(0);
    expect(r.unreachableCinemas).toHaveLength(1);
    expect(r.unreachableCinemas[0]).toMatchObject({ cinemaId: 'cin_busan', reason: 'lower_bound', travelMinutes: null });
    expect(r.unroutableCinemas).toEqual([]);
    expect(r.cinemas).toEqual([]);
    expect(r.meta.outcome).toBe('no_feasible_showtime');
    expect(r.meta.partialFailure).toBe(false);
    expect(r.meta.notices.map((n) => n.code)).not.toContain('route_unconfirmed');
  });

  it('하한을 넘지 않으면 직선거리가 멀어도 제외하지 않고 경로를 조회한다', async () => {
    const { routes, deps } = setup({ now: at, showtimes: lateProvider, routes: { fixedMinutes: { cin_busan: { transit: 170 } } } });
    const r = await recommend(deps, req({ movieId: 'movie_late', transportMode: 'transit', departureTime: '2026-11-14T21:00:00+09:00' }));
    expect(routes.callCountFor('cin_busan')).toBe(1);
    expect(r.unreachableCinemas.every((c) => c.reason !== 'lower_bound')).toBe(true);
  });
});

describe('AT-19 25:10 심야 회차', () => {
  it.each([
    ['2026-11-14T23:30:00', '2026-11-15T00:10:00', '2026-11-15T01:10:00+09:00'],
    ['2026-11-15T00:00:00', '2026-11-15T00:10:00', '2026-11-15T01:10:00+09:00'],
    ['2026-11-14T14:00:00', '2026-11-21T00:10:00', '2026-11-21T01:10:00+09:00'],
  ])('현재 %s에서 %s 출발 시 같은 영업일의 심야 회차를 사용한다', async (now, departure, start) => {
    const { deps } = setup({ now: () => new Date(`${now}+09:00`) });
    const r = await recommend(deps, req({ departureTime: `${departure}+09:00`, transportMode: 'car' }));
    const suwon = r.cinemas.find(c => c.cinemaId === 'cin_suwon');
    expect(suwon).toBeDefined();
    expect(suwon?.showtimes.find(s => s.businessTime === '25:10')).toMatchObject({ startTime: start, verdict: 'arrivable' });
  });

  it('오늘 영업일 회차로 포함하고 다음 날 01:10으로 계산한다', async () => {
    const at = () => new Date('2026-11-14T22:50:00+09:00');
    const { deps } = setup({ now: at });
    const r = await recommend(deps, req({ departureTime: '2026-11-14T23:00:00+09:00' }));
    const suwon = r.cinemas.find((c) => c.cinemaId === 'cin_suwon')!;
    expect(suwon).toBeDefined();
    const late = suwon.showtimes.find((s) => s.businessTime === '25:10')!;
    expect(late.startTime).toBe('2026-11-15T01:10:00+09:00');
    expect(late.verdict).toBe('arrivable');
    // 23:00 출발 + 65분 = 00:05 도착, 준비 완료 00:15. 대기 = 01:10 - 00:05 = 65분, 여유 55분.
    expect(suwon.arrivalTime).toBe('2026-11-15T00:05:00+09:00');
    expect(late.waitMinutes).toBe(65);
    expect(late.spareMinutes).toBe(55);
    expect(suwon.representativeShowtimeId).toBe(late.showtimeId);
  });

  it('자정이 지나도(00:00 요청) 04시 전까지는 같은 영업일로 25:10 회차를 본다', async () => {
    const at = () => new Date('2026-11-15T00:00:00+09:00');
    const { deps } = setup({ now: at });
    const r = await recommend(deps, req());
    const suwon = [...r.cinemas, ...r.unreachableCinemas].find((c) => c.cinemaId === 'cin_suwon');
    expect(suwon?.showtimes.some((s) => s.businessTime === '25:10')).toBe(true);
    // 04시 이후는 다음 영업일의 시간표를 사용하며 7일 조회 범위 안에서는 허용한다.
    const next = await recommend(deps, req({ departureTime: '2026-11-15T04:30:00+09:00' }));
    expect(next.meta.departureTime).toBe('2026-11-15T04:30:00+09:00');
    expect(next.cinemas.length).toBeGreaterThan(0);
    expect(next.cinemas.flatMap(c => c.showtimes).some(s => s.startTime === '2026-11-16T01:10:00+09:00')).toBe(true);
  });
});
