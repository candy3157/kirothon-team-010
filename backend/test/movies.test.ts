import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import {
  FailingShowtimeProvider,
  SampleShowtimeProvider,
  type ShowtimeProvider,
} from '../src/data/provider.js';

const NOW = new Date('2026-11-14T14:00:00+09:00');
const now = () => NOW;
let app: FastifyInstance;

function make(provider: ShowtimeProvider = new SampleShowtimeProvider({ now })) {
  app = buildApp({}, { provider, now });
  return app;
}

afterEach(async () => {
  await app?.close();
});

describe('GET /api/movies', () => {
  it('query 없으면 오늘 상영 중인 영화만 준다 (FR-01)', async () => {
    const res = await make().inject('/api/movies');
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.source).toBe('sample');
    const ids = body.movies.map((m: { movieId: string }) => m.movieId);
    expect(ids).toContain('movie_001');
    expect(ids).not.toContain('movie_003'); // 회차 없음
    expect(body.movies.every((m: { isShowingToday: boolean }) => m.isShowingToday)).toBe(true);
  });

  it('제목으로 검색한다 (미상영 영화도 표시)', async () => {
    const res = await make().inject({ url: '/api/movies', query: { query: ' 영화 D ' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().movies).toHaveLength(1);
    expect(res.json().movies[0].isShowingToday).toBe(false);
  });

  it('일치하는 영화가 없으면 빈 배열', async () => {
    const res = await make().inject({ url: '/api/movies', query: { query: '없는영화' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().movies).toEqual([]);
  });

  it('빈 검색어·100자 초과·반복 파라미터는 400', async () => {
    for (const url of [
      '/api/movies?query=',
      '/api/movies?query=%20%20',
      `/api/movies?query=${'a'.repeat(101)}`,
      '/api/movies?query=a&query=b',
      '/api/movies?query=a%00b',
    ]) {
      const res = await make().inject(url);
      expect(res.statusCode, url).toBe(400);
      expect(res.json().code).toBe('invalid_request');
      expect(res.json().details[0].field).toBe('query');
      await app.close();
    }
  });

  it('공급자 장애는 502 upstream_unavailable', async () => {
    const res = await make(new FailingShowtimeProvider()).inject('/api/movies');
    expect(res.statusCode).toBe(502);
    expect(res.json().code).toBe('upstream_unavailable');
  });
});

describe('GET /api/movies/:movieId/availability', () => {
  it('상영 중이면 showing (date 생략 = 오늘)', async () => {
    const res = await make().inject('/api/movies/movie_001/availability');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ movieId: 'movie_001', status: 'showing', date: '2026-11-14' });
  });

  it('오늘 날짜를 명시해도 된다', async () => {
    const res = await make().inject('/api/movies/movie_001/availability?date=2026-11-14');
    expect(res.statusCode).toBe(200);
  });

  it('회차가 없으면 200 not_showing', async () => {
    const res = await make().inject('/api/movies/movie_003/availability');
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('not_showing');
  });

  it('공급자 실패는 200 unknown (미상영 아님)', async () => {
    const res = await make(new FailingShowtimeProvider({ failMovieIds: ['movie_001'] })).inject(
      '/api/movies/movie_001/availability',
    );
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('unknown');
  });

  it('AT-20: 오늘부터 7일 안의 날짜는 허용한다', async () => {
    for (const d of ['2026-11-15', '2026-11-20']) {
      const res = await make().inject(`/api/movies/movie_001/availability?date=${d}`);
      expect(res.statusCode).toBe(200);
      expect(res.json().date).toBe(d);
      await app.close();
    }
  });

  it('AT-20: 지난 날짜나 7일 뒤 날짜는 400 unsupported_date', async () => {
    for (const d of ['2026-11-21', '2026-11-13']) {
      const res = await make().inject(`/api/movies/movie_001/availability?date=${d}`);
      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe('unsupported_date');
      await app.close();
    }
  });

  it('날짜 형식 오류·존재하지 않는 날짜는 400 invalid_request', async () => {
    for (const d of ['tomorrow', '2026-13-01', '2026-02-30', '20261114']) {
      const res = await make().inject(`/api/movies/movie_001/availability?date=${d}`);
      expect(res.statusCode, d).toBe(400);
      expect(res.json().code).toBe('invalid_request');
      expect(res.json().details[0].field).toBe('date');
      await app.close();
    }
  });

  it('영화 ID 형식 오류는 400, 없는 영화는 404', async () => {
    const bad = await make().inject('/api/movies/bad%20id!/availability');
    expect(bad.statusCode).toBe(400);
    expect(bad.json().details[0].field).toBe('movieId');
    const missing = await app.inject('/api/movies/movie_999/availability');
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toMatchObject({ code: 'movie_not_found' });
    expect(missing.json().requestId).toBeTruthy();
  });

  it('없는 경로도 공통 오류 스키마로 답한다', async () => {
    const res = await make().inject('/api/nope');
    expect(res.statusCode).toBe(404);
    expect(Object.keys(res.json()).sort()).toEqual(['code', 'message', 'requestId']);
  });
});
