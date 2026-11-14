import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { SampleShowtimeProvider } from '../src/data/provider.js';
import { MockRouteProvider } from '../src/routing/mock.js';
import { ResultStore } from '../src/services/resultStore.js';

let NOW = new Date('2026-11-14T14:00:00+09:00');
const now = () => NOW;
let app: FastifyInstance;
let routes: MockRouteProvider;

function make(over: Parameters<typeof buildApp>[1] = {}) {
  routes = new MockRouteProvider({
    fixedMinutes: { cin_gangnam: { transit: 25 }, cin_suwon: { transit: 65 }, cin_jamsil: { transit: 30 } },
  });
  app = buildApp(
    {},
    { provider: new SampleShowtimeProvider({ now }), now, routes, store: new ResultStore({ now }), ...over },
  );
  return app;
}

const body = (over: Record<string, unknown> = {}) => ({
  movieId: 'movie_001',
  origin: { latitude: 37.5, longitude: 127.03 },
  transportMode: 'transit',
  departureTime: '2026-11-14T14:00:00+09:00',
  ...over,
});

const post = (a: FastifyInstance, payload: unknown) =>
  a.inject({ method: 'POST', url: '/api/recommendations', payload: payload as object });

afterEach(async () => {
  NOW = new Date('2026-11-14T14:00:00+09:00');
  await app?.close();
});

describe('POST /api/recommendations', () => {
  it('정상 요청은 200과 resultId를 준다', async () => {
    const res = await post(make(), body());
    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.meta.resultId).toMatch(/^res_/);
    expect(json.meta.outcome).toBe('recommended');
    expect(json.meta.sortBy).toBe('balanced');
  });

  it.each([
    ['radiusKm 거부', { radiusKm: 5 }, 'radiusKm'],
    ['알 수 없는 필드 거부', { foo: 1 }, 'foo'],
    ['위도 범위', { origin: { latitude: 91, longitude: 127 } }, 'origin.latitude'],
    ['경도 범위', { origin: { latitude: 37, longitude: -181 } }, 'origin.longitude'],
    ['origin 문자열 좌표', { origin: { latitude: '37', longitude: 127 } }, 'origin.latitude'],
    ['origin 추가 필드', { origin: { latitude: 37, longitude: 127, radiusKm: 3 } }, 'origin.radiusKm'],
    ['transportMode', { transportMode: 'bike' }, 'transportMode'],
    ['오프셋 없는 시각', { departureTime: '2026-11-14T14:00:00' }, 'departureTime'],
    ['없는 날짜', { departureTime: '2026-02-30T10:00:00+09:00' }, 'departureTime'],
    ['sortBy', { sortBy: 'cheapest' }, 'sortBy'],
    ['movieId 형식', { movieId: '../x' }, 'movieId'],
  ])('400: %s', async (_n, over, field) => {
    const res = await post(make(), body(over));
    expect(res.statusCode).toBe(400);
    const json = res.json();
    expect(json.code).toBe('invalid_request');
    expect(json.details.map((d: { field: string }) => d.field)).toContain(field);
    expect(routes.callCount).toBe(0);
  });

  it('필수 필드 누락과 비객체 본문은 400', async () => {
    expect((await post(make(), { movieId: 'movie_001' })).statusCode).toBe(400);
    expect((await post(app, [1])).statusCode).toBe(400);
    const bad = await app.inject({
      method: 'POST',
      url: '/api/recommendations',
      headers: { 'content-type': 'application/json' },
      payload: '{not json',
    });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().code).toBe('invalid_request');
  });

  it('오류 응답에 좌표 값과 내부 정보를 담지 않는다', async () => {
    const res = await post(make(), body({ origin: { latitude: 91.123456, longitude: 127.654321 } }));
    expect(res.body).not.toContain('91.123456');
    expect(res.body).not.toContain('127.654321');
    expect(res.body).not.toMatch(/stack|node_modules|\.ts:/);
  });

  it('없는 영화는 404 movie_not_found', async () => {
    const res = await post(make(), body({ movieId: 'movie_nope' }));
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('movie_not_found');
  });

  it('오늘 영업일이 아닌 출발시각은 400 departure_out_of_range', async () => {
    const res = await post(make(), body({ departureTime: '2026-11-16T10:00:00+09:00' }));
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('departure_out_of_range');
  });

  it('본문이 너무 크면 413', async () => {
    const res = await post(make(), body({ padding: 'x'.repeat(5000) }));
    expect(res.statusCode).toBe(413);
    expect(res.json().code).toBe('payload_too_large');
  });

  it('요청 제한을 넘으면 429 rate_limited와 Retry-After', async () => {
    const a = make({ postLimit: { max: 2, timeWindowMs: 60_000 } });
    expect((await post(a, body())).statusCode).toBe(200);
    expect((await post(a, body())).statusCode).toBe(200);
    const res = await post(a, body());
    expect(res.statusCode).toBe(429);
    expect(res.json().code).toBe('rate_limited');
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
  });
});

describe('GET /api/recommendations/:resultId', () => {
  it('정렬만 바꾸고 경로를 다시 조회하지 않는다 (AT-17)', async () => {
    const a = make();
    const created = (await post(a, body())).json();
    const calls = routes.callCount;
    const res = await a.inject(`/api/recommendations/${created.meta.resultId}?sortBy=earliest`);
    expect(res.statusCode).toBe(200);
    expect(res.json().meta.sortBy).toBe('earliest');
    expect(res.json().meta.resultId).toBe(created.meta.resultId);
    expect(routes.callCount).toBe(calls);
  });

  it('sortBy를 생략하면 만든 요청의 정렬을 쓴다', async () => {
    const a = make();
    const created = (await post(a, body({ sortBy: 'travel' }))).json();
    const res = await a.inject(`/api/recommendations/${created.meta.resultId}`);
    expect(res.json().meta.sortBy).toBe('travel');
  });

  it('잘못된 sortBy·resultId 형식은 400', async () => {
    const a = make();
    const created = (await post(a, body())).json();
    const r1 = await a.inject(`/api/recommendations/${created.meta.resultId}?sortBy=bad`);
    expect(r1.statusCode).toBe(400);
    const r2 = await a.inject('/api/recommendations/x');
    expect(r2.statusCode).toBe(400);
    expect(r2.json().code).toBe('invalid_request');
  });

  it('없는 resultId는 404 result_expired', async () => {
    const res = await make().inject('/api/recommendations/res_doesnotexist');
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('result_expired');
  });

  it('만료된 resultId는 404 result_expired', async () => {
    const a = make();
    const created = (await post(a, body())).json();
    NOW = new Date(NOW.getTime() + 31 * 60_000);
    const res = await a.inject(`/api/recommendations/${created.meta.resultId}`);
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('result_expired');
  });

  it('GET도 요청 제한을 받는다', async () => {
    const a = make({ getLimit: { max: 1, timeWindowMs: 60_000 } });
    expect((await a.inject('/api/recommendations/res_doesnotexist')).statusCode).toBe(404);
    expect((await a.inject('/api/recommendations/res_doesnotexist')).statusCode).toBe(429);
  });
});

describe('좌표 비저장', () => {
  it('로그에 출발 좌표가 남지 않는다', async () => {
    const lines: string[] = [];
    const stream = { write: (s: string) => void lines.push(s) };
    const a = buildApp(
      { logger: { level: 'trace', stream } },
      { provider: new SampleShowtimeProvider({ now }), now, routes: new MockRouteProvider(), store: new ResultStore({ now }) },
    );
    app = a;
    await post(a, body({ origin: { latitude: 37.123456, longitude: 127.654321 } }));
    await post(a, body({ origin: { latitude: 99.123456, longitude: 127.654321 } }));
    const all = lines.join('\n');
    expect(all).not.toContain('37.123456');
    expect(all).not.toContain('127.654321');
  });
});
