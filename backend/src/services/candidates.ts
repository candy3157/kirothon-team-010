import type { MovieShowtimesResult, ShowtimeProvider } from '../data/provider.js';
import { businessTimeToInstant, isUpcomingShowtimeOn } from '../time.js';
import type { Cinema, RawShowtime } from '../types.js';

/** 후보 영화관 하나와 그 영화관의 유효(요청 시점 이후) 회차. */
export interface CandidateCinema {
  cinema: Cinema;
  /** 시작 시각 오름차순. */
  showtimes: RawShowtime[];
}

/**
 * 공급자 결과에서 조회한 영업일(result.businessDate)의 회차 중 요청 시점 이후 시작하는 것만 남긴다.
 * 이미 시작한 회차와 다른 영업일 회차는 제외한다.
 */
export function upcomingShowtimes(result: MovieShowtimesResult, now: Date): RawShowtime[] {
  return result.showtimes
    .filter((s) => isUpcomingShowtimeOn(result.businessDate, s.businessDate, s.businessTime, now))
    .sort(
      (a, b) =>
        businessTimeToInstant(a.businessDate, a.businessTime).getTime() -
        businessTimeToInstant(b.businessDate, b.businessTime).getTime(),
    );
}

/**
 * 선택 영화의 유효 회차가 있는 모든 지원 영화관. 출발지와 무관하다.
 * 거리 반경 필터는 없다. 영화관 순서는 cinemaId 오름차순(결정적).
 */
export function candidatesFrom(result: MovieShowtimesResult, now: Date): CandidateCinema[] {
  if (result.status !== 'ok') return [];
  const byCinema = new Map<string, RawShowtime[]>();
  for (const s of upcomingShowtimes(result, now)) {
    const list = byCinema.get(s.cinemaId);
    if (list) list.push(s);
    else byCinema.set(s.cinemaId, [s]);
  }
  const out: CandidateCinema[] = [];
  for (const cinema of result.cinemas) {
    const showtimes = byCinema.get(cinema.cinemaId);
    if (showtimes && showtimes.length > 0) out.push({ cinema, showtimes });
  }
  return out.sort((a, b) => a.cinema.cinemaId.localeCompare(b.cinema.cinemaId));
}

/** 공급자를 조회해 후보 영화관을 반환한다. 공급자 실패 시 빈 배열(상영 여부는 availability가 판정). */
export async function findCandidateCinemas(
  provider: ShowtimeProvider,
  movieId: string,
  now: Date,
): Promise<CandidateCinema[]> {
  return candidatesFrom(await provider.getMovieShowtimes(movieId), now);
}
