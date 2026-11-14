import type { Cinema, Movie, RawShowtime } from '../types.js';

/**
 * 샘플 상영시간표. 실제 상영 정보가 아니다(source: 'sample').
 * 값은 docs/examples/*.json 및 AT 시나리오에 맞춘다.
 *
 * - movie_001(A): 강남·잠실·수원 3개 영화관. 14:30/14:40 회차는 AT-06/07 기준(14:00 출발, 대중교통 25분, 준비 10분).
 *   수원점에 25:10(다음 날 01:10) 심야 회차 포함.
 * - movie_002(B): 모든 회차가 이른 시간(09:00~12:00). 오후 출발이면 도착 가능 회차 없음.
 * - movie_003: 상영 회차 없음(not_showing).
 * - movie_004(C): 부산 영화관(서울 기준 약 300km)에서만 상영. 마지막 회차가 이르면 직선거리 하한으로 도착 불가.
 */

export const SAMPLE_LAST_UPDATED_AT = '2026-11-14T13:45:00+09:00';

export const SAMPLE_MOVIES: readonly Movie[] = [
  { movieId: 'movie_001', title: '샘플 영화 A', originalTitle: null, posterUrl: null, runtimeMinutes: 118 },
  { movieId: 'movie_002', title: '샘플 영화 B', originalTitle: null, posterUrl: null, runtimeMinutes: 96 },
  { movieId: 'movie_003', title: '샘플 영화 D', originalTitle: null, posterUrl: null, runtimeMinutes: 105 },
  { movieId: 'movie_004', title: '샘플 영화 C', originalTitle: null, posterUrl: null, runtimeMinutes: 110 },
];

export const SAMPLE_CINEMAS: readonly Cinema[] = [
  {
    cinemaId: 'cin_gangnam',
    name: '샘플 강남점',
    address: '서울 강남구 강남대로 396',
    location: { latitude: 37.4979, longitude: 127.0276 },
  },
  {
    cinemaId: 'cin_jamsil',
    name: '샘플 잠실점',
    address: '서울 송파구 올림픽로 240',
    location: { latitude: 37.5133, longitude: 127.1001 },
  },
  {
    // 서울 중심에서 20km 이상
    cinemaId: 'cin_suwon',
    name: '샘플 수원점',
    address: '경기 수원시 팔달구 덕영대로 924',
    location: { latitude: 37.2636, longitude: 127.0286 },
  },
  {
    // 서울 중심에서 약 300km 이상
    cinemaId: 'cin_busan',
    name: '샘플 부산점',
    address: '부산 해운대구 해운대해변로 264',
    location: { latitude: 35.1631, longitude: 129.1639 },
  },
];

/** businessDate는 공급자가 오늘 영업일로 채운다. */
export type SampleShowtime = Omit<RawShowtime, 'businessDate'>;

function st(movieId: string, cinemaId: string, short: string, businessTime: string): SampleShowtime {
  const id = `st_${short}_${businessTime.replace(':', '')}`;
  return { showtimeId: id, movieId, cinemaId, businessTime, screenName: null, bookingUrl: null };
}

export const SAMPLE_SHOWTIMES: readonly SampleShowtime[] = [
  // 영화 A
  st('movie_001', 'cin_gangnam', 'gangnam', '14:30'),
  {
    ...st('movie_001', 'cin_gangnam', 'gangnam', '14:40'),
    bookingUrl: 'https://example.com/booking/sample/gangnam/1440',
  },
  st('movie_001', 'cin_gangnam', 'gangnam', '16:30'),
  st('movie_001', 'cin_jamsil', 'jamsil', '15:00'),
  st('movie_001', 'cin_suwon', 'suwon', '15:30'),
  // 25:10 = 다음 날 01:10. 예제 ID는 실제 시각 기준(st_suwon_0110).
  { ...st('movie_001', 'cin_suwon', 'suwon', '25:10'), showtimeId: 'st_suwon_0110' },

  // 영화 B: 모두 이른 시간
  st('movie_002', 'cin_gangnam', 'gangnam', '09:00'),
  st('movie_002', 'cin_gangnam', 'gangnam', '10:30'),
  st('movie_002', 'cin_gangnam', 'gangnam', '12:00'),
  st('movie_002', 'cin_jamsil', 'jamsil', '09:30'),

  // 영화 C: 부산에서만 상영
  st('movie_004', 'cin_busan', 'busan', '15:00'),
  st('movie_004', 'cin_busan', 'busan', '15:30'),
];
