import type { MovieShowtimesResult, ShowtimeProvider } from '../data/provider.js';
import { todayBusinessDate } from '../time.js';
import type { Availability, Notice } from '../types.js';
import { candidatesFrom } from './candidates.js';

export interface AvailabilityResult {
  /** false면 공급자가 영화 ID를 모른다(라우트에서 404 movie_not_found). */
  movieFound: boolean;
  availability: Availability;
}

const SAMPLE_NOTICE: Notice = {
  code: 'sample_data',
  message: '샘플 상영시간표입니다. 실제 상영 정보가 아닙니다.',
};

const UNKNOWN_NOTICE: Notice = {
  code: 'partial_coverage',
  message: '상영시간표를 불러오지 못해 상영 여부를 확인할 수 없습니다. 미상영이라는 뜻이 아닙니다.',
};

/**
 * 요청 시점 이후 유효 회차로 상영 여부를 판정한다.
 * - 공급자 실패(unavailable) -> unknown. not_showing으로 단정하지 않는다.
 * - 유효 회차 1개 이상 -> showing, 0개 -> not_showing.
 */
export function evaluateAvailability(
  movieId: string,
  result: MovieShowtimesResult,
  now: Date,
): AvailabilityResult {
  const base = {
    movieId,
    date: result.businessDate,
    coverage: result.coverage,
    lastUpdatedAt: result.lastUpdatedAt,
    source: result.source,
  };

  if (result.status === 'unavailable') {
    return {
      movieFound: true,
      availability: {
        ...base,
        status: 'unknown',
        cinemaCount: 0,
        showtimeCount: 0,
        coverage: 'none',
        notices: [UNKNOWN_NOTICE],
      },
    };
  }

  if (result.status === 'not_found') {
    return {
      movieFound: false,
      availability: { ...base, status: 'not_showing', cinemaCount: 0, showtimeCount: 0 },
    };
  }

  const candidates = candidatesFrom(result, now);
  const showtimeCount = candidates.reduce((n, c) => n + c.showtimes.length, 0);
  const notices: Notice[] = result.source === 'sample' ? [SAMPLE_NOTICE] : [];
  return {
    movieFound: true,
    availability: {
      ...base,
      status: showtimeCount > 0 ? 'showing' : 'not_showing',
      cinemaCount: candidates.length,
      showtimeCount,
      ...(notices.length > 0 ? { notices } : {}),
    },
  };
}

/** 공급자를 조회해 상영 여부를 판정한다. 공급자 예외도 unknown으로 처리한다. */
export async function checkAvailability(
  provider: ShowtimeProvider,
  movieId: string,
  now: Date = new Date(),
  businessDate?: string,
): Promise<AvailabilityResult> {
  let result: MovieShowtimesResult;
  try {
    result = await provider.getMovieShowtimes(movieId, businessDate);
  } catch {
    return evaluateAvailability(
      movieId,
      {
        status: 'unavailable',
        coverage: 'none',
        lastUpdatedAt: null,
        source: 'sample',
        movie: null,
        cinemas: [],
        showtimes: [],
        businessDate: businessDate ?? todayBusinessDate(now),
      },
      now,
    );
  }
  return evaluateAvailability(movieId, result, now);
}
