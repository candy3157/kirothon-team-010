import { afterEach, describe, expect, it } from 'vitest';
import { FailingShowtimeProvider, SampleShowtimeProvider } from '../../src/data/provider.js';
import {
  BASE_NOW,
  check,
  declaredStatuses,
  exampleFiles,
  makeApp,
  readExample,
  requestBody,
  spec,
  type Harness,
} from './helpers.js';

let h: Harness;
afterEach(async () => {
  await h?.app.close();
});

const post = (payload: unknown) => h.app.inject({ method: 'POST', url: '/api/recommendations', payload: payload as object });

/** 응답이 명세에 선언된 상태 코드이고, 성공이면 스키마에, 실패면 ErrorResponse에 맞는지 확인한다. */
function expectContract(
  res: { statusCode: number; json: () => unknown },
  path: string,
  method: string,
  okSchema: string,
) {
  expect(declaredStatuses(path, method), `선언되지 않은 상태 코드 ${res.statusCode}`).toContain(String(res.statusCode));
  const errors = check(res.statusCode === 200 ? okSchema : 'ErrorResponse', res.json());
  expect(errors).toEqual([]);
}

describe('명세 자체와 예제', () => {
  it('OpenAPI 3.1 문서이며 필수 엔드포인트가 모두 있다', () => {
    expect(spec.openapi).toMatch(/^3\.1/);
    expect(Object.keys(spec.paths).sort()).toEqual(
      [
        '/api/health',
        '/api/movies',
        '/api/movies/{movieId}/availability',
        '/api/recommendations',
        '/api/recommendations/{resultId}',
      ].sort(),
    );
  });

  it('요청 스키마에 거리 제한 필드가 없고 알 수 없는 필드를 거부한다', () => {
    const s = spec.components.schemas.RecommendationRequest;
    expect(s.additionalProperties).toBe(false);
    expect(Object.keys(s.properties)).not.toContain('radiusKm');
    expect(JSON.stringify(spec)).not.toMatch(/radiusKm"?\s*:\s*\n?\s*type/);
  });

  const exampleSchema: Record<string, string> = {
    'movies-search.json': 'MovieListResponse',
    'availability-showing.json': 'Availability',
    'availability-not-showing.json': 'Availability',
    'availability-unknown.json': 'Availability',
    'recommendation-request.json': 'RecommendationRequest',
    'recommendation-ok.json': 'RecommendationResult',
    'recommendation-no-feasible.json': 'RecommendationResult',
    'recommendation-not-showing.json': 'RecommendationResult',
    'recommendation-partial-route-failure.json': 'RecommendationResult',
    'recommendation-sorted-earliest.json': 'RecommendationResult',
  };

  it('모든 예제 파일에 대응 스키마가 지정되어 있다', () => {
    expect(exampleFiles().sort()).toEqual(Object.keys(exampleSchema).sort());
  });

  it.each(Object.entries(exampleSchema))('예제 %s는 %s 스키마에 맞는다', (file, schema) => {
    expect(check(schema, readExample(file))).toEqual([]);
  });

  it('명세 안의 오류 예제가 ErrorResponse에 맞는다', () => {
    const r = spec.components.responses;
    const examples = [
      ...Object.values<{ value: unknown }>(r.BadRequest.content['application/json'].examples).map((e) => e.value),
      r.MovieNotFound.content['application/json'].example,
      r.ResultExpired.content['application/json'].example,
      r.PayloadTooLarge.content['application/json'].example,
      r.TooManyRequests.content['application/json'].example,
      r.BadGateway.content['application/json'].example,
      r.ServiceUnavailable.content['application/json'].example,
    ];
    for (const ex of examples) expect(check('ErrorResponse', ex)).toEqual([]);
  });

  it('명세에 나온 externalValue 예제 파일이 모두 실제로 있다', () => {
    const files = new Set(exampleFiles());
    const refs = [...JSON.stringify(spec).matchAll(/"externalValue":"\.\/examples\/([^"]+)"/g)].map((m) => m[1]!);
    expect(refs.length).toBeGreaterThan(0);
    for (const f of refs) expect(files.has(f), f).toBe(true);
  });

  it('예제 요청을 실제 서버에 보내면 명세에 맞는 응답이 온다', async () => {
    h = makeApp();
    const req = readExample('recommendation-request.json') as Record<string, unknown>;
    const res = await post({ ...req, departureTime: BASE_NOW });
    expect(res.statusCode).toBe(200);
    expectContract(res, '/api/recommendations', 'post', 'RecommendationResult');
  });
});

describe('GET /api/health', () => {
  it('200 Health', async () => {
    h = makeApp();
    const res = await h.app.inject('/api/health');
    expectContract(res, '/api/health', 'get', 'Health');
    expect(res.statusCode).toBe(200);
  });
});

describe('GET /api/movies', () => {
  it('목록과 검색 결과가 MovieListResponse에 맞는다', async () => {
    h = makeApp();
    const all = await h.app.inject('/api/movies');
    expect(all.statusCode).toBe(200);
    expectContract(all, '/api/movies', 'get', 'MovieListResponse');
    expect(all.json().source).toBe('sample');
    const q = await h.app.inject({ method: 'GET', url: '/api/movies', query: { query: '샘플 영화 A' } });
    expect(q.statusCode).toBe(200);
    expectContract(q, '/api/movies', 'get', 'MovieListResponse');
    expect(q.json().movies.length).toBe(1);
  });

  it('결과가 없으면 200과 빈 배열', async () => {
    h = makeApp();
    const res = await h.app.inject({ method: 'GET', url: '/api/movies', query: { query: '없는영화제목zzz' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().movies).toEqual([]);
    expectContract(res, '/api/movies', 'get', 'MovieListResponse');
  });

  it('너무 긴 검색어는 400 ErrorResponse', async () => {
    h = makeApp();
    const res = await h.app.inject({ method: 'GET', url: '/api/movies', query: { query: 'a'.repeat(101) } });
    expect(res.statusCode).toBe(400);
    expectContract(res, '/api/movies', 'get', 'MovieListResponse');
  });
});

describe('GET /api/movies/{movieId}/availability', () => {
  const url = (id: string, q = '') => `/api/movies/${id}/availability${q}`;

  it('showing / not_showing 이 Availability에 맞는다', async () => {
    h = makeApp();
    const a = await h.app.inject(url('movie_001'));
    expect(a.statusCode).toBe(200);
    expectContract(a, '/api/movies/{movieId}/availability', 'get', 'Availability');
    expect(a.json().status).toBe('showing');
    const b = await h.app.inject(url('movie_003'));
    expect(b.statusCode).toBe(200);
    expectContract(b, '/api/movies/{movieId}/availability', 'get', 'Availability');
    expect(b.json().status).toBe('not_showing');
  });

  it('공급자 실패는 오류가 아니라 unknown 200', async () => {
    h = makeApp(undefined, { provider: (now) => new FailingShowtimeProvider({ failMovieIds: ['movie_001'] }, new SampleShowtimeProvider({ now })) });
    const res = await h.app.inject(url('movie_001'));
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('unknown');
    expectContract(res, '/api/movies/{movieId}/availability', 'get', 'Availability');
  });

  it('오늘 날짜는 허용, 다른 날짜는 400 unsupported_date', async () => {
    h = makeApp();
    const ok = await h.app.inject(url('movie_001', '?date=2026-11-14'));
    expect(ok.statusCode).toBe(200);
    const other = await h.app.inject(url('movie_001', '?date=2026-11-15'));
    expect(other.statusCode).toBe(400);
    expect(other.json().code).toBe('unsupported_date');
    expectContract(other, '/api/movies/{movieId}/availability', 'get', 'Availability');
    const bad = await h.app.inject(url('movie_001', '?date=2026-02-30'));
    expect(bad.statusCode).toBe(400);
    expect(bad.json().code).toBe('invalid_request');
  });

  it('없는 영화는 404, 잘못된 id 형식은 400', async () => {
    h = makeApp();
    const nf = await h.app.inject(url('movie_nope'));
    expect(nf.statusCode).toBe(404);
    expect(nf.json().code).toBe('movie_not_found');
    expectContract(nf, '/api/movies/{movieId}/availability', 'get', 'Availability');
    const bad = await h.app.inject(url('bad%20id'));
    expect(bad.statusCode).toBe(400);
    expectContract(bad, '/api/movies/{movieId}/availability', 'get', 'Availability');
  });
});

describe('POST /api/recommendations', () => {
  it('recommended 결과가 RecommendationResult에 맞는다', async () => {
    h = makeApp();
    const res = await post(requestBody());
    expect(res.statusCode).toBe(200);
    expectContract(res, '/api/recommendations', 'post', 'RecommendationResult');
    const json = res.json();
    expect(json.meta.outcome).toBe('recommended');
    expect(json.meta.source).toBe('sample');
    expect(json.cinemas.length).toBeGreaterThan(0);
    expect(json.cinemas[0].rank).toBe(1);
  });

  it('도착 가능 회차 없음(no_feasible_showtime)이 명세에 맞는다', async () => {
    // 모든 영화관 이동시간이 700분이라 마지막 회차(25:10)도 놓친다. 경로는 조회했으므로 all_showtimes_missed.
    h = makeApp({ fixedMinutes: { cin_gangnam: { transit: 700 }, cin_suwon: { transit: 700 }, cin_jamsil: { transit: 700 } } });
    const res = await post(requestBody());
    expect(res.statusCode).toBe(200);
    expectContract(res, '/api/recommendations', 'post', 'RecommendationResult');
    expect(res.json().meta.outcome).toBe('no_feasible_showtime');
    expect(res.json().cinemas).toEqual([]);
  });

  it('not_showing은 경로 호출 없이 200', async () => {
    h = makeApp();
    const res = await post(requestBody({ movieId: 'movie_003' }));
    expect(res.statusCode).toBe(200);
    expectContract(res, '/api/recommendations', 'post', 'RecommendationResult');
    expect(res.json().meta.outcome).toBe('not_showing');
    expect(h.routes.callCount).toBe(0);
  });

  it('availability_unknown은 경로 호출 없이 200', async () => {
    h = makeApp(undefined, { provider: (now) => new FailingShowtimeProvider({ failMovieIds: ['movie_001'] }, new SampleShowtimeProvider({ now })) });
    const res = await post(requestBody());
    expect(res.statusCode).toBe(200);
    expectContract(res, '/api/recommendations', 'post', 'RecommendationResult');
    expect(res.json().meta.outcome).toBe('availability_unknown');
    expect(h.routes.callCount).toBe(0);
  });

  it('일부 경로 실패는 unroutableCinemas로 분리되고 명세에 맞는다', async () => {
    h = makeApp({ fixedMinutes: { cin_gangnam: { transit: 25 }, cin_jamsil: { transit: 30 } }, failures: { cin_suwon: 'route_failed' } });
    const res = await post(requestBody());
    expect(res.statusCode).toBe(200);
    expectContract(res, '/api/recommendations', 'post', 'RecommendationResult');
    const json = res.json();
    expect(json.meta.partialFailure).toBe(true);
    expect(json.unroutableCinemas.map((c: { cinemaId: string }) => c.cinemaId)).toContain('cin_suwon');
    expect(json.cinemas.map((c: { cinemaId: string }) => c.cinemaId)).not.toContain('cin_suwon');
  });

  it('하한 판정으로 확정된 도착 불가는 경로 호출 없이 unreachableCinemas', async () => {
    h = makeApp();
    const res = await post(requestBody({ movieId: 'movie_004', transportMode: 'car' }));
    expect(res.statusCode).toBe(200);
    expectContract(res, '/api/recommendations', 'post', 'RecommendationResult');
    const json = res.json();
    expect(json.unreachableCinemas.some((c: { reason: string }) => c.reason === 'lower_bound')).toBe(true);
    expect(h.routes.callCountFor('cin_busan')).toBe(0);
  });

  it('심야 25:10 회차가 다음 날 01:10 오프셋 시각으로 나온다', async () => {
    h = makeApp();
    const res = await post(requestBody());
    const all = [...res.json().cinemas, ...res.json().unreachableCinemas].flatMap((c: { showtimes: unknown[] }) => c.showtimes) as {
      businessTime: string;
      startTime: string;
    }[];
    const late = all.find((s) => s.businessTime === '25:10');
    expect(late?.startTime).toBe('2026-11-15T01:10:00+09:00');
  });

  it.each([
    ['radiusKm', { radiusKm: 5 }],
    ['maxDistanceKm', { maxDistanceKm: 10 }],
    ['알 수 없는 필드', { foo: 1 }],
    ['위도 범위', { origin: { latitude: 91, longitude: 127 } }],
    ['이동수단', { transportMode: 'bike' }],
    ['오프셋 없는 시각', { departureTime: '2026-11-14T14:00:00' }],
    ['sortBy', { sortBy: 'cheapest' }],
  ])('400 invalid_request: %s', async (_n, over) => {
    h = makeApp();
    const res = await post(requestBody(over));
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('invalid_request');
    expectContract(res, '/api/recommendations', 'post', 'RecommendationResult');
    expect(h.routes.callCount).toBe(0);
  });

  it('radiusKm 오류가 필드를 알려 준다', async () => {
    h = makeApp();
    const res = await post(requestBody({ radiusKm: 5 }));
    expect(res.json().details.map((d: { field: string }) => d.field)).toContain('radiusKm');
  });

  it('오늘 영업일 밖의 출발시각은 400 departure_out_of_range', async () => {
    h = makeApp();
    const res = await post(requestBody({ departureTime: '2026-11-16T10:00:00+09:00' }));
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('departure_out_of_range');
    expectContract(res, '/api/recommendations', 'post', 'RecommendationResult');
  });

  it('없는 영화는 404 movie_not_found', async () => {
    h = makeApp();
    const res = await post(requestBody({ movieId: 'movie_nope' }));
    expect(res.statusCode).toBe(404);
    expectContract(res, '/api/recommendations', 'post', 'RecommendationResult');
  });

  it('큰 본문은 413 payload_too_large', async () => {
    h = makeApp();
    const res = await post(requestBody({ padding: 'x'.repeat(5000) }));
    expect(res.statusCode).toBe(413);
    expect(res.json().code).toBe('payload_too_large');
    expectContract(res, '/api/recommendations', 'post', 'RecommendationResult');
  });
});

describe('GET /api/recommendations/{resultId} (AT-17)', () => {
  it('정렬을 바꿔도 경로를 다시 조회하지 않고 명세에 맞는다', async () => {
    h = makeApp();
    const created = (await post(requestBody())).json();
    const calls = h.routes.callCount;
    expect(calls).toBeGreaterThan(0);
    for (const sortBy of ['balanced', 'travel', 'earliest']) {
      const res = await h.app.inject(`/api/recommendations/${created.meta.resultId}?sortBy=${sortBy}`);
      expect(res.statusCode).toBe(200);
      expectContract(res, '/api/recommendations/{resultId}', 'get', 'RecommendationResult');
      expect(res.json().meta.sortBy).toBe(sortBy);
      expect(res.json().meta.resultId).toBe(created.meta.resultId);
      expect(h.routes.callCount).toBe(calls);
    }
  });

  it('sortBy 생략은 만든 요청의 정렬', async () => {
    h = makeApp();
    const created = (await post(requestBody({ sortBy: 'travel' }))).json();
    const res = await h.app.inject(`/api/recommendations/${created.meta.resultId}`);
    expect(res.json().meta.sortBy).toBe('travel');
  });

  it('잘못된 sortBy·resultId 형식은 400', async () => {
    h = makeApp();
    const created = (await post(requestBody())).json();
    const a = await h.app.inject(`/api/recommendations/${created.meta.resultId}?sortBy=bad`);
    expect(a.statusCode).toBe(400);
    expectContract(a, '/api/recommendations/{resultId}', 'get', 'RecommendationResult');
    const b = await h.app.inject('/api/recommendations/x');
    expect(b.statusCode).toBe(400);
    expectContract(b, '/api/recommendations/{resultId}', 'get', 'RecommendationResult');
  });

  it('없는 결과와 만료된 결과는 404 result_expired', async () => {
    h = makeApp();
    const none = await h.app.inject('/api/recommendations/res_doesnotexist');
    expect(none.statusCode).toBe(404);
    expect(none.json().code).toBe('result_expired');
    expectContract(none, '/api/recommendations/{resultId}', 'get', 'RecommendationResult');
    const created = (await post(requestBody())).json();
    h.setNow('2026-11-14T14:31:00+09:00');
    const expired = await h.app.inject(`/api/recommendations/${created.meta.resultId}`);
    expect(expired.statusCode).toBe(404);
    expect(expired.json().code).toBe('result_expired');
    expectContract(expired, '/api/recommendations/{resultId}', 'get', 'RecommendationResult');
  });
});

describe('CORS와 보안 헤더', () => {
  const ORIGIN = 'http://localhost:5173';

  it('허용 origin에만 정확히 그 origin을 돌려준다(와일드카드 아님)', async () => {
    h = makeApp();
    const ok = await h.app.inject({ method: 'GET', url: '/api/health', headers: { origin: ORIGIN } });
    expect(ok.headers['access-control-allow-origin']).toBe(ORIGIN);
    const denied = await h.app.inject({ method: 'GET', url: '/api/health', headers: { origin: 'http://evil.example' } });
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('POST preflight가 메서드와 Content-Type을 허용한다', async () => {
    h = makeApp();
    const res = await h.app.inject({
      method: 'OPTIONS',
      url: '/api/recommendations',
      headers: { origin: ORIGIN, 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type' },
    });
    expect(res.statusCode).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(ORIGIN);
    expect(String(res.headers['access-control-allow-methods'])).toContain('POST');
    expect(String(res.headers['access-control-allow-headers']).toLowerCase()).toContain('content-type');
  });

  it('오류 응답에도 CORS 헤더가 붙는다', async () => {
    h = makeApp();
    const res = await h.app.inject({
      method: 'POST',
      url: '/api/recommendations',
      headers: { origin: ORIGIN },
      payload: requestBody({ radiusKm: 5 }),
    });
    expect(res.statusCode).toBe(400);
    expect(res.headers['access-control-allow-origin']).toBe(ORIGIN);
  });

  it('보안 헤더가 있다', async () => {
    h = makeApp();
    const res = await h.app.inject('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('와일드카드 origin 설정은 거부한다', () => {
    expect(() => makeApp(undefined, { frontendOrigins: ['*'] })).toThrow();
  });
});

describe('알 수 없는 경로', () => {
  it('404도 ErrorResponse 형식', async () => {
    h = makeApp();
    const res = await h.app.inject('/api/nope');
    expect(res.statusCode).toBe(404);
    expect(check('ErrorResponse', res.json())).toEqual([]);
  });
});
