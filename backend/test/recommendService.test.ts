import { describe, expect, it } from 'vitest';
import { SampleShowtimeProvider } from '../src/data/provider.js';
import { MockRouteProvider } from '../src/routing/mock.js';
import { recommend, RecommendError, resort } from '../src/services/recommend.js';
import { ResultStore } from '../src/services/resultStore.js';
import type { RecommendationRequest } from '../src/types.js';

const NOW = new Date('2026-11-14T13:58:00+09:00');
const ORIGIN = { latitude: 37.5, longitude: 127.03 };

function setup(routeOpts: ConstructorParameters<typeof MockRouteProvider>[0] = {}, nowFn = () => NOW) {
  const routes = new MockRouteProvider({
    fixedMinutes: { cin_gangnam: { transit: 25 }, cin_suwon: { transit: 65 }, cin_jamsil: { transit: 30 } },
    ...routeOpts,
  });
  const store = new ResultStore({ now: nowFn });
  const deps = { showtimes: new SampleShowtimeProvider({ now: nowFn }), routes, store, now: nowFn };
  return { routes, store, deps };
}

const req = (over: Partial<RecommendationRequest> = {}): RecommendationRequest => ({
  movieId: 'movie_001',
  origin: ORIGIN,
  transportMode: 'transit',
  departureTime: '2026-11-14T14:00:00+09:00',
  ...over,
});

describe('recommend', () => {
  it('영화관당 경로를 1회만 조회하고 대표 회차를 고른다', async () => {
    const { routes, deps } = setup();
    const r = await recommend(deps, req());
    expect(routes.callCount).toBe(3);
    expect(routes.callCountFor('cin_gangnam')).toBe(1);
    expect(r.meta.outcome).toBe('recommended');
    const g = r.cinemas.find((c) => c.cinemaId === 'cin_gangnam')!;
    const t1430 = g.showtimes.find((s) => s.showtimeId === 'st_gangnam_1430')!;
    const t1440 = g.showtimes.find((s) => s.showtimeId === 'st_gangnam_1440')!;
    expect(t1430.verdict).toBe('unarrivable');
    expect(t1440).toMatchObject({ verdict: 'arrivable', waitMinutes: 15, spareMinutes: 5, isRepresentative: true });
    expect(g.representativeShowtimeId).toBe('st_gangnam_1440');
    expect(g.rank).toBe(1);
    expect(r.meta.expiresAt).toBe('2026-11-14T14:28:00+09:00');
  });

  it('경로 실패 영화관은 unroutable로 분리한다', async () => {
    const { deps } = setup({ failures: { cin_jamsil: 'route_failed' } });
    const r = await recommend(deps, req());
    expect(r.unroutableCinemas.map((c) => c.cinemaId)).toEqual(['cin_jamsil']);
    expect(r.cinemas.map((c) => c.cinemaId)).not.toContain('cin_jamsil');
    expect(r.meta.partialFailure).toBe(true);
    expect(r.meta.notices.map((n) => n.code)).toContain('route_unconfirmed');
  });

  it('모든 경로가 실패하면 no_route_confirmed', async () => {
    const { deps } = setup({ failures: { cin_gangnam: 'route_failed', cin_jamsil: 'route_timeout', cin_suwon: 'route_failed' } });
    const r = await recommend(deps, req());
    expect(r.meta.outcome).toBe('no_route_confirmed');
  });

  it('상영 중이나 도착 가능 회차가 없으면 no_feasible_showtime', async () => {
    const at = () => new Date('2026-11-14T08:50:00+09:00');
    const { deps } = setup({ fixedMinutes: { cin_gangnam: { car: 20 }, cin_jamsil: { car: 20 } } }, at);
    const ok = await recommend(deps, req({ movieId: 'movie_002', transportMode: 'car', departureTime: '2026-11-14T08:55:00+09:00' }));
    expect(ok.meta.outcome).toBe('recommended');
    const late = await recommend(deps, req({ movieId: 'movie_002', transportMode: 'car', departureTime: '2026-11-14T11:45:00+09:00' }));
    expect(late.meta.outcome).toBe('no_feasible_showtime');
    expect(late.cinemas).toEqual([]);
    expect(late.unreachableCinemas.map((c) => [c.cinemaId, c.reason])).toEqual([['cin_jamsil', 'lower_bound'], ['cin_gangnam', 'all_showtimes_missed']]);
  });
  it('하한 판정 영화관은 경로를 호출하지 않는다', async () => {
    const { routes, deps } = setup();
    const r = await recommend(deps, req({ movieId: 'movie_004', departureTime: '2026-11-14T14:00:00+09:00' }));
    // 부산 15:30 마지막 회차: 서울에서 300km+ / 350km/h 하한 + 10분 -> 14:00 + 약 52분 < 15:30 이므로 하한으로는 제외되지 않는다.
    expect(r.unreachableCinemas.length + r.cinemas.length + r.unroutableCinemas.length).toBe(1);
    const walk = await recommend(deps, req({ movieId: 'movie_004', transportMode: 'walk' }));
    expect(walk.unreachableCinemas[0]).toMatchObject({ reason: 'lower_bound', travelMinutes: null });
    expect(routes.callCountFor('cin_busan')).toBe(1);
  });

  it('미상영·상영시간표 실패는 경로를 호출하지 않는다', async () => {
    const { routes, deps } = setup();
    const r = await recommend(deps, req({ movieId: 'movie_003' }));
    expect(r.meta.outcome).toBe('not_showing');
    expect(routes.callCount).toBe(0);
    const failing = {
      ...deps,
      showtimes: { searchMovies: deps.showtimes.searchMovies.bind(deps.showtimes), getMovieShowtimes: async () => { throw new Error('x'); } },
    };
    const u = await recommend(failing, req());
    expect(u.meta.outcome).toBe('availability_unknown');
    expect(routes.callCount).toBe(0);
  });

  it('다른 날·마지막 회차 이후 출발과 알 수 없는 영화는 거부한다', async () => {
    const { deps } = setup();
    await expect(recommend(deps, req({ departureTime: '2026-11-15T09:00:00+09:00' }))).rejects.toMatchObject({
      code: 'departure_out_of_range',
    });
    await expect(recommend(deps, req({ departureTime: '2026-11-14T23:30:00+09:00' }))).resolves.toBeDefined();
    await expect(recommend(deps, req({ departureTime: 'nope' }))).rejects.toMatchObject({ code: 'invalid_request' });
    await expect(recommend(deps, req({ movieId: 'movie_999' }))).rejects.toMatchObject({ code: 'movie_not_found' });
    const early = setup({}, () => new Date('2026-11-14T08:50:00+09:00')).deps;
    await expect(recommend(early, req({ movieId: 'movie_002', departureTime: '2026-11-14T12:30:00+09:00' }))).rejects.toBeInstanceOf(RecommendError);
  });
});

describe('resort / resultStore', () => {
  it('재정렬은 경로 공급자를 호출하지 않고 저장 결과만 쓴다', async () => {
    const { routes, deps } = setup();
    const first = await recommend(deps, req());
    const calls = routes.callCount;
    const byEarliest = resort(deps, first.meta.resultId, 'earliest');
    const byTravel = resort(deps, first.meta.resultId, 'travel');
    expect(routes.callCount).toBe(calls);
    expect(byEarliest.meta.sortBy).toBe('earliest');
    expect(byEarliest.meta.expiresAt).toBe(first.meta.expiresAt);
    expect(byEarliest.cinemas[0]!.cinemaId).toBe('cin_gangnam');
    expect(byTravel.cinemas[0]!.travelMinutes).toBe(25);
  });

  it('TTL이 지나면 result_expired', async () => {
    let t = NOW;
    const { deps } = setup({}, () => t);
    const r = await recommend(deps, req());
    t = new Date(NOW.getTime() + 31 * 60_000);
    expect(() => resort(deps, r.meta.resultId, 'travel')).toThrowError(RecommendError);
    expect(() => resort(deps, 'res_unknown', 'travel')).toThrowError(/만료/);
  });

  it('최대 개수를 넘으면 오래된 항목을 제거하고, 출발 좌표를 저장하지 않는다', async () => {
    const { deps } = setup();
    const store = new ResultStore({ maxEntries: 2, now: () => NOW });
    const d = { ...deps, store };
    const a = await recommend(d, req());
    await recommend(d, req());
    await recommend(d, req());
    expect(store.size).toBe(2);
    expect(store.get(a.meta.resultId)).toBeUndefined();
    const last = await recommend(d, req({ origin: { latitude: 36.123456, longitude: 128.654321 } }));
    const json = JSON.stringify(store.get(last.meta.resultId));
    expect(json).not.toContain('36.123456');
    expect(json).not.toContain('128.654321');
  });
});


