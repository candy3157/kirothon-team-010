import { describe, expect, it } from 'vitest';
import { FailingShowtimeProvider, SampleShowtimeProvider } from '../src/data/provider.js';
import { checkAvailability } from '../src/services/availability.js';
import { findCandidateCinemas } from '../src/services/candidates.js';

const DATE = '2026-11-14';
const NOW = new Date('2026-11-14T14:00:00+09:00');
const provider = new SampleShowtimeProvider({ businessDate: DATE });

describe('AT-01 상영 중인 영화', () => {
  it('유효 회차가 있으면 showing, 영화관·회차 수를 센다', async () => {
    const { availability } = await checkAvailability(provider, 'movie_001', NOW);
    expect(availability.status).toBe('showing');
    expect(availability.cinemaCount).toBe(3);
    expect(availability.showtimeCount).toBe(6);
    expect(availability.date).toBe(DATE);
    expect(availability.source).toBe('sample');
  });

  it('요청 시점 이전에 시작한 회차는 세지 않는다', async () => {
    const late = new Date('2026-11-14T15:10:00+09:00'); // 14:30/14:40/15:00 제외
    const { availability } = await checkAvailability(provider, 'movie_001', late);
    expect(availability.status).toBe('showing');
    expect(availability.showtimeCount).toBe(3); // 15:30, 16:30, 25:10
  });
});

describe('AT-02 후보 영화관은 거리와 무관', () => {
  it('20km 이상(수원)과 300km(부산) 영화관도 포함한다', async () => {
    const a = await findCandidateCinemas(provider, 'movie_001', NOW);
    expect(a.map((c) => c.cinema.cinemaId)).toEqual(['cin_gangnam', 'cin_jamsil', 'cin_suwon']);
    const c = await findCandidateCinemas(provider, 'movie_004', NOW);
    expect(c.map((x) => x.cinema.cinemaId)).toEqual(['cin_busan']);
  });

  it('후보 함수는 출발지를 받지 않고 회차를 시작 시각순으로 준다', async () => {
    const a = await findCandidateCinemas(provider, 'movie_001', NOW);
    const suwon = a.find((c) => c.cinema.cinemaId === 'cin_suwon')!;
    expect(suwon.showtimes.map((s) => s.businessTime)).toEqual(['15:30', '25:10']);
    expect(findCandidateCinemas.length).toBe(3);
  });

  it('유효 회차가 없는 영화관은 후보에서 빠진다', async () => {
    const late = new Date('2026-11-14T15:45:00+09:00');
    const a = await findCandidateCinemas(provider, 'movie_001', late);
    expect(a.map((c) => c.cinema.cinemaId)).toEqual(['cin_gangnam', 'cin_suwon']);
  });
});

describe('AT-03 미상영', () => {
  it('회차가 없는 영화는 not_showing', async () => {
    const r = await checkAvailability(provider, 'movie_003', NOW);
    expect(r.movieFound).toBe(true);
    expect(r.availability.status).toBe('not_showing');
    expect(r.availability.cinemaCount).toBe(0);
  });

  it('모든 회차가 이미 시작했으면 not_showing', async () => {
    const evening = new Date('2026-11-14T13:00:00+09:00');
    const r = await checkAvailability(provider, 'movie_002', new Date(evening.getTime() + 0));
    expect(r.availability.status).toBe('not_showing'); // 영화 B는 09:00~12:00
    expect(await findCandidateCinemas(provider, 'movie_002', evening)).toEqual([]);
  });

  it('모르는 영화 ID는 movieFound=false', async () => {
    const r = await checkAvailability(provider, 'movie_999', NOW);
    expect(r.movieFound).toBe(false);
  });
});

describe('AT-04 확인 불가', () => {
  it('공급자 실패는 unknown이며 not_showing이 아니다', async () => {
    const failing = new FailingShowtimeProvider({ failMovieIds: ['movie_001'] });
    const r = await checkAvailability(failing, 'movie_001', NOW);
    expect(r.availability.status).toBe('unknown');
    expect(r.availability.status).not.toBe('not_showing');
    expect(r.availability.coverage).toBe('none');
    expect(r.availability.notices?.[0]?.code).toBe('partial_coverage');
    expect(await findCandidateCinemas(failing, 'movie_001', NOW)).toEqual([]);
  });

  it('공급자가 예외를 던져도 unknown', async () => {
    const throwing = {
      searchMovies: async () => {
        throw new Error('boom');
      },
      getMovieShowtimes: async () => {
        throw new Error('boom');
      },
    };
    const r = await checkAvailability(throwing, 'movie_001', NOW);
    expect(r.availability.status).toBe('unknown');
  });
});
