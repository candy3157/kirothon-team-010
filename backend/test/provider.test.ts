import { describe, expect, it } from 'vitest';
import { FailingShowtimeProvider, SampleShowtimeProvider } from '../src/data/provider.js';

const p = new SampleShowtimeProvider({ businessDate: '2026-11-14' });

describe('SampleShowtimeProvider', () => {
  it('영화 A는 3개 영화관에서 상영하고 25:10 회차를 포함한다', async () => {
    const r = await p.getMovieShowtimes('movie_001');
    expect(r.status).toBe('ok');
    expect(r.source).toBe('sample');
    expect(r.cinemas.map((c) => c.cinemaId).sort()).toEqual(['cin_gangnam', 'cin_jamsil', 'cin_suwon']);
    expect(r.showtimes.some((s) => s.businessTime === '25:10')).toBe(true);
    expect(r.showtimes.every((s) => s.businessDate === '2026-11-14')).toBe(true);
    expect(r.lastUpdatedAt).not.toBeNull();
  });

  it('영화 B의 모든 회차는 12:00 이전이다', async () => {
    const r = await p.getMovieShowtimes('movie_002');
    expect(r.showtimes.length).toBeGreaterThan(0);
    expect(r.showtimes.every((s) => s.businessTime <= '12:00')).toBe(true);
  });

  it('상영 회차가 없는 영화와 없는 영화 ID를 구분한다', async () => {
    const none = await p.getMovieShowtimes('movie_003');
    expect(none.status).toBe('ok');
    expect(none.showtimes).toHaveLength(0);
    expect((await p.getMovieShowtimes('nope')).status).toBe('not_found');
  });

  it('제목으로 검색한다', async () => {
    expect((await p.searchMovies('영화 A')).movies.map((m) => m.movieId)).toEqual(['movie_001']);
    expect((await p.searchMovies()).movies.length).toBeGreaterThanOrEqual(2);
  });
});

describe('FailingShowtimeProvider', () => {
  it('실패를 unavailable로 알린다', async () => {
    const f = new FailingShowtimeProvider();
    expect((await f.getMovieShowtimes('movie_001')).status).toBe('unavailable');
    expect((await f.searchMovies()).status).toBe('unavailable');
  });

  it('지정한 영화만 실패시킨다', async () => {
    const f = new FailingShowtimeProvider({ failMovieIds: ['movie_001'] });
    expect((await f.getMovieShowtimes('movie_001')).status).toBe('unavailable');
    expect((await f.getMovieShowtimes('movie_002')).status).toBe('ok');
    expect((await f.searchMovies()).status).toBe('ok');
  });
});
