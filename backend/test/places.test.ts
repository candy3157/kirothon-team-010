import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { loadNaverConfig } from '../src/config.js';
import { NaverPlaceProvider, localCoord, plainText, type FetchLike } from '../src/places/provider.js';
import { check } from './contract/helpers.js';

const KEYS = {
  NAVER_SEARCH_CLIENT_ID: 'sid',
  NAVER_SEARCH_CLIENT_SECRET: 'ssecret',
  NCP_MAPS_API_KEY_ID: 'mid',
  NCP_MAPS_API_KEY: 'msecret',
};

interface Call {
  url: string;
  headers: Record<string, string>;
}

function fakeFetch(handlers: { local?: unknown | Error; geocode?: unknown | Error }, calls: Call[] = []): FetchLike {
  return async (url, init) => {
    calls.push({ url, headers: init.headers });
    const h = url.includes('search/local') ? handlers.local : handlers.geocode;
    if (h instanceof Error) throw h;
    if (h === undefined) return { ok: false, status: 500, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => h };
  };
}

const LOCAL_OK = {
  items: [
    { title: '<b>강남역</b> 2호선', address: '서울 강남구 역삼동 858', roadAddress: '서울 강남구 강남대로 396', mapx: '1270276368', mapy: '374979502' },
    { title: '좌표 없음', address: 'x', mapx: '', mapy: '' },
  ],
};
const GEOCODE_OK = {
  status: 'OK',
  addresses: [{ roadAddress: '서울특별시 중구 세종대로 110', jibunAddress: '서울특별시 중구 태평로1가 31', x: '126.9783882', y: '37.5666103' }],
};

let app: FastifyInstance;
afterEach(async () => {
  await app?.close();
});

describe('장소 검색 도우미', () => {
  it('title의 태그와 엔티티를 지운다', () => {
    expect(plainText('<b>스타벅스</b> 신촌&amp;점')).toBe('스타벅스 신촌&점');
  });
  it('mapx/mapy(1e7배 정수)를 도로 바꾸고, 한국 밖 좌표는 버린다', () => {
    expect(localCoord('1270276368', '374979502')).toEqual({ longitude: 127.0276368, latitude: 37.4979502 });
    expect(localCoord('127.0276368', '37.4979502')).toEqual({ longitude: 127.0276368, latitude: 37.4979502 });
    expect(localCoord('311277', '552097')).toBeNull(); // 옛 KATECH 형식
    expect(localCoord('', '')).toBeNull();
  });
});

describe('NaverPlaceProvider', () => {
  it('지역 검색 결과를 우선 쓰고 키는 헤더로만 보낸다', async () => {
    const calls: Call[] = [];
    const p = new NaverPlaceProvider(loadNaverConfig(KEYS), fakeFetch({ local: LOCAL_OK, geocode: GEOCODE_OK }, calls));
    const r = await p.search('강남역');
    expect(r).toEqual({
      status: 'ok',
      places: [{ name: '강남역 2호선', address: '서울 강남구 강남대로 396', latitude: 37.4979502, longitude: 127.0276368, source: 'local' }],
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).not.toContain('sid');
    expect(calls[0]!.headers['X-Naver-Client-Id']).toBe('sid');
  });

  it('지역 검색이 비면 Geocoding으로 찾는다', async () => {
    const p = new NaverPlaceProvider(loadNaverConfig(KEYS), fakeFetch({ local: { items: [] }, geocode: GEOCODE_OK }));
    const r = await p.search('서울 중구 세종대로 110');
    expect(r.status).toBe('ok');
    if (r.status === 'ok') {
      expect(r.places[0]).toMatchObject({ source: 'geocode', latitude: 37.5666103, longitude: 126.9783882 });
    }
  });

  it('지역 검색이 실패해도 Geocoding으로 찾는다', async () => {
    const p = new NaverPlaceProvider(loadNaverConfig(KEYS), fakeFetch({ local: new Error('down'), geocode: GEOCODE_OK }));
    expect((await p.search('세종대로 110')).status).toBe('ok');
  });

  it('지역 검색만 성공하고 결과가 없으면 빈 목록', async () => {
    const p = new NaverPlaceProvider(loadNaverConfig(KEYS), fakeFetch({ local: { items: [] }, geocode: { status: 'ERROR' } }));
    expect(await p.search('없는곳')).toEqual({ status: 'ok', places: [] });
  });

  it('둘 다 실패하면 unavailable', async () => {
    const p = new NaverPlaceProvider(loadNaverConfig(KEYS), fakeFetch({ local: new Error('x'), geocode: new Error('y') }));
    expect(await p.search('강남')).toEqual({ status: 'unavailable' });
  });

  it('키가 없으면 not_configured이고 외부 호출을 하지 않는다', async () => {
    const calls: Call[] = [];
    const p = new NaverPlaceProvider(loadNaverConfig({}), fakeFetch({}, calls));
    expect(await p.search('강남')).toEqual({ status: 'not_configured' });
    expect(calls).toHaveLength(0);
  });
});

describe('GET /api/places', () => {
  const make = (fetchImpl: FetchLike, env: NodeJS.ProcessEnv = KEYS) => {
    app = buildApp({}, { places: new NaverPlaceProvider(loadNaverConfig(env), fetchImpl) });
    return app;
  };

  it('장소 목록을 준다', async () => {
    const res = await make(fakeFetch({ local: LOCAL_OK })).inject({ url: '/api/places', query: { query: '강남역' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().places).toHaveLength(1);
    expect(check('PlaceListResponse', res.json())).toEqual([]);
    expect(res.body).not.toContain('ssecret');
  });

  it.each([[undefined], [''], [' a '], ['x'.repeat(101)], ['a\u0001b']])('잘못된 검색어 %j는 400', async (q) => {
    const res = await make(fakeFetch({})).inject({ url: '/api/places', query: q === undefined ? {} : { query: q } });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('invalid_request');
  });

  it('키가 없으면 503 service_unavailable', async () => {
    const res = await make(fakeFetch({}), {}).inject({ url: '/api/places', query: { query: '강남역' } });
    expect(res.statusCode).toBe(503);
    expect(res.json().code).toBe('service_unavailable');
  });

  it('외부 API가 모두 실패하면 502 upstream_unavailable', async () => {
    const res = await make(fakeFetch({ local: new Error('x'), geocode: new Error('y') })).inject({
      url: '/api/places',
      query: { query: '강남역' },
    });
    expect(res.statusCode).toBe(502);
    expect(res.json().code).toBe('upstream_unavailable');
  });

  it('요청 제한을 넘으면 429', async () => {
    app = buildApp(
      {},
      { places: new NaverPlaceProvider(loadNaverConfig(KEYS), fakeFetch({ local: LOCAL_OK })), placesLimit: { max: 1, timeWindowMs: 60_000 } },
    );
    await app.inject({ url: '/api/places', query: { query: '강남역' } });
    const res = await app.inject({ url: '/api/places', query: { query: '강남역' } });
    expect(res.statusCode).toBe(429);
  });
});
