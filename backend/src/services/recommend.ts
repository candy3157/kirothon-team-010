import type { MovieShowtimesResult, ShowtimeProvider } from '../data/provider.js';
import { BUFFER_MINUTES, MAX_ADVANCE_DAYS, MAX_SPEED_KMH, publicPolicy, WAIT_WEIGHT } from '../policy.js';
import type { RouteFailureReason, RouteProvider, RouteResult } from '../routing/provider.js';
import {
  addMinutes,
  businessTimeToInstant,
  businessTimeToIso,
  isWithinBookingWindow,
  lastShowtimeStart,
  seoulDateOf,
  toSeoulIso,
} from '../time.js';
import type {
  Cinema,
  ErrorCode,
  ErrorDetail,
  Notice,
  Outcome,
  RankedCinema,
  RawShowtime,
  RecommendationRequest,
  RecommendationResult,
  ResultMeta,
  Showtime,
  SortBy,
  UnreachableCinema,
  UnroutableCinema,
  UnroutableStatus,
} from '../types.js';
import { DEFAULT_SORT_BY } from '../types.js';
import { evaluateAvailability } from './availability.js';
import { candidatesFrom, type CandidateCinema } from './candidates.js';
import { evaluateShowtime } from './feasibility.js';
import { judgeLowerBound } from './lowerBound.js';
import { rankCinemas } from './ranking.js';
import type { ResultStore, StoredResult, StoredRoutedCinema, StoredShowtime } from './resultStore.js';

/** 서비스 계층 오류. 라우트가 status·code로 ErrorResponse를 만든다. */
export class RecommendError extends Error {
  constructor(
    readonly status: 400 | 404,
    readonly code: ErrorCode,
    message: string,
    readonly details?: ErrorDetail[],
  ) {
    super(message);
    this.name = 'RecommendError';
  }
}

export interface RecommendDeps {
  showtimes: ShowtimeProvider;
  routes: RouteProvider;
  store: ResultStore;
  now?: () => Date;
  /** 경로 조회 동시 실행 상한. */
  routeConcurrency?: number;
  directionsUrl?: (cinema: Cinema) => string | null;
}

const SAMPLE_NOTICE: Notice = {
  code: 'sample_data',
  message: '샘플 상영시간표입니다. 실제 상영 정보가 아닙니다.',
};
const ROUTE_UNCONFIRMED_NOTICE: Notice = {
  code: 'route_unconfirmed',
  message: '일부 영화관의 경로를 확인하지 못했습니다. 확인된 영화관만 추천합니다.',
};
const PARTIAL_COVERAGE_NOTICE: Notice = {
  code: 'partial_coverage',
  message: '일부 지역·영화관의 상영시간표만 확보되어 있습니다.',
};
const UNKNOWN_NOTICE: Notice = {
  code: 'partial_coverage',
  message: '상영시간표를 불러오지 못해 상영 여부를 확인할 수 없습니다. 미상영이라는 뜻이 아닙니다.',
};

const UNROUTABLE_MESSAGE = '경로를 확인하지 못했습니다. 도착 가능 여부를 판정하지 않았습니다.';

const DEFAULT_ROUTE_CONCURRENCY = 8;

function defaultDirectionsUrl(cinema: Cinema): string {
  return `https://example.com/directions?dest=${encodeURIComponent(cinema.cinemaId)}`;
}

/** 동시 실행 수를 제한한 map. 결과 순서는 입력 순서를 유지한다. */
async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i] as T);
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), items.length) }, worker));
  return out;
}

function parseDeparture(raw: string | undefined, now: Date): Date {
  if (raw === undefined) return now;
  const t = Date.parse(raw);
  if (Number.isNaN(t)) {
    throw new RecommendError(400, 'invalid_request', '요청 형식이 올바르지 않습니다.', [
      { field: 'departureTime', issue: '오프셋을 포함한 ISO 8601 시각이어야 합니다.' },
    ]);
  }
  return new Date(t);
}

function emptyShowtime(raw: RawShowtime): Showtime {
  return {
    showtimeId: raw.showtimeId,
    startTime: businessTimeToIso(raw.businessDate, raw.businessTime),
    businessTime: raw.businessTime,
    screenName: raw.screenName ?? null,
    verdict: 'unarrivable',
    waitMinutes: null,
    spareMinutes: null,
    rank: null,
    isRepresentative: false,
    bookingUrl: null,
  };
}

function toUnroutableStatus(reason: RouteFailureReason): UnroutableStatus {
  return reason;
}

function normalizeRoute(r: RouteResult): RouteResult {
  if (r.ok && (!Number.isFinite(r.minutes) || r.minutes < 0)) return { ok: false, reason: 'route_failed' };
  return r;
}

/**
 * 추천 계산.
 * 상영 여부 -> (not_showing/unknown이면 경로 호출 없이 종료) -> 후보 -> 하한 판정 ->
 * 남은 영화관만 영화관당 1회 경로 조회 -> 회차 판정 -> 정렬·대표 회차.
 */
export async function recommend(deps: RecommendDeps, req: RecommendationRequest): Promise<RecommendationResult> {
  const now = (deps.now ?? (() => new Date()))();
  const sortBy: SortBy = req.sortBy ?? DEFAULT_SORT_BY;
  const departure = parseDeparture(req.departureTime, now);
  const bufferMinutes = req.bufferMinutes ?? BUFFER_MINUTES;

  // 조회 가능한 날짜(오늘 ~ 오늘+MAX_ADVANCE_DAYS) 밖의 출발시각 거부.
  const departureDate = seoulDateOf(departure);
  if (!isWithinBookingWindow(departureDate, now, MAX_ADVANCE_DAYS)) {
    throw new RecommendError(
      400,
      'departure_out_of_range',
      `출발시각은 오늘부터 ${MAX_ADVANCE_DAYS + 1}일 안이어야 합니다.`,
    );
  }

  let result: MovieShowtimesResult;
  try {
    result = await deps.showtimes.getMovieShowtimes(req.movieId, departureDate);
  } catch {
    result = {
      status: 'unavailable',
      coverage: 'none',
      lastUpdatedAt: null,
      source: 'sample',
      movie: null,
      cinemas: [],
      showtimes: [],
      businessDate: departureDate,
    };
  }

  const { movieFound, availability } = evaluateAvailability(req.movieId, result, now);
  if (!movieFound) throw new RecommendError(404, 'movie_not_found', '영화를 찾을 수 없습니다.');

  const requestedAt = toSeoulIso(now);
  const base = {
    movieId: req.movieId,
    requestedAt,
    departureTime: toSeoulIso(departure),
    transportMode: req.transportMode,
    sortBy,
    coverage: availability.coverage,
    source: availability.source,
    lastUpdatedAt: availability.lastUpdatedAt,
    policy: { ...publicPolicy(), bufferMinutes },
  };
  const sampleNotices: Notice[] = availability.source === 'sample' ? [SAMPLE_NOTICE] : [];

  // 경로 호출 없이 종료.
  if (availability.status !== 'showing') {
    const unknown = availability.status === 'unknown';
    const stored = deps.store.put({
      ...base,
      outcome: unknown ? 'availability_unknown' : 'not_showing',
      partialFailure: false,
      notices: unknown ? [UNKNOWN_NOTICE] : sampleNotices,
      routed: [],
      unroutableCinemas: [],
      unreachableCinemas: [],
    });
    return resort(deps, stored.resultId, sortBy);
  }

  const candidates = candidatesFrom(result, now);

  // 그날 마지막 회차 이후 출발 거부.
  const lastStarts = new Map<string, Date>();
  let overallLast: Date | null = null;
  for (const c of candidates) {
    const last = lastShowtimeStart(
      result.businessDate,
      c.showtimes.map((s) => s.businessTime),
    );
    if (last) {
      lastStarts.set(c.cinema.cinemaId, last);
      if (!overallLast || last.getTime() > overallLast.getTime()) overallLast = last;
    }
  }
  if (overallLast && departure.getTime() > overallLast.getTime()) {
    throw new RecommendError(400, 'departure_out_of_range', '출발시각이 그날 마지막 회차 이후입니다.');
  }

  // 하한 판정: 경로 호출 없이 도착 불가 확정.
  const unreachable: UnreachableCinema[] = [];
  const toRoute: CandidateCinema[] = [];
  for (const c of candidates) {
    const last = lastStarts.get(c.cinema.cinemaId) ?? null;
    const v = judgeLowerBound({
      origin: req.origin,
      cinema: c.cinema.location,
      mode: req.transportMode,
      departure,
      lastShowtimeStart: last,
      bufferMinutes,
      maxSpeedKmh: MAX_SPEED_KMH,
    });
    if (v.unreachable && last) {
      unreachable.push({
        ...c.cinema,
        reason: 'lower_bound',
        travelMinutes: null,
        lowerBoundMinutes: Math.floor(v.lowerBoundMinutes),
        lastShowtimeStart: toSeoulIso(last),
        showtimes: c.showtimes.map(emptyShowtime),
      });
    } else {
      toRoute.push(c);
    }
  }

  // 영화관당 1회 경로 조회(병렬). 결과는 그 영화관의 모든 회차에 재사용한다.
  const departureIso = toSeoulIso(departure);
  const routeResults = await mapLimit(toRoute, deps.routeConcurrency ?? DEFAULT_ROUTE_CONCURRENCY, async (c) => {
    try {
      return normalizeRoute(
        await deps.routes.getTravelMinutes({
          origin: req.origin,
          cinemaId: c.cinema.cinemaId,
          destination: c.cinema.location,
          mode: req.transportMode,
          departureTime: departureIso,
        }),
      );
    } catch {
      return { ok: false, reason: 'route_failed' } as RouteResult;
    }
  });

  const directionsUrl = deps.directionsUrl ?? defaultDirectionsUrl;
  const routed: StoredRoutedCinema[] = [];
  const unroutable: UnroutableCinema[] = [];
  let routeOkCount = 0;

  toRoute.forEach((c, i) => {
    const r = routeResults[i] as RouteResult;
    if (!r.ok) {
      unroutable.push({
        ...c.cinema,
        routeStatus: toUnroutableStatus(r.reason),
        message: UNROUTABLE_MESSAGE,
        showtimes: c.showtimes.map((s) => ({
          showtimeId: s.showtimeId,
          startTime: businessTimeToIso(s.businessDate, s.businessTime),
          businessTime: s.businessTime,
          screenName: s.screenName ?? null,
        })),
      });
      return;
    }
    routeOkCount += 1;
    const travelMinutes = Math.ceil(r.minutes);
    const showtimes: StoredShowtime[] = c.showtimes.map((s) => {
      const start = businessTimeToInstant(s.businessDate, s.businessTime);
      const v = evaluateShowtime({ showtimeId: s.showtimeId, start, departure, travelMinutes, bufferMinutes });
      return {
        showtimeId: s.showtimeId,
        start,
        startTime: v.startTime,
        businessTime: s.businessTime,
        screenName: s.screenName ?? null,
        bookingUrl: s.bookingUrl ?? null,
        feasible: v.feasible,
        waitMinutes: v.waitMinutes,
        spareMinutes: v.spareMinutes,
      };
    });
    const arrivalTime = toSeoulIso(addMinutes(departure, travelMinutes));
    if (showtimes.some((s) => s.feasible)) {
      routed.push({ cinema: c.cinema, travelMinutes, arrivalTime, directionsUrl: directionsUrl(c.cinema), showtimes });
    } else {
      unreachable.push({
        ...c.cinema,
        reason: 'all_showtimes_missed',
        travelMinutes,
        lowerBoundMinutes: null,
        lastShowtimeStart: toSeoulIso(lastStarts.get(c.cinema.cinemaId) as Date),
        showtimes: showtimes.map(
          (s): Showtime => ({
            showtimeId: s.showtimeId,
            startTime: s.startTime,
            businessTime: s.businessTime,
            screenName: s.screenName,
            verdict: 'unarrivable',
            waitMinutes: s.waitMinutes,
            spareMinutes: s.spareMinutes,
            rank: null,
            isRepresentative: false,
            bookingUrl: null,
          }),
        ),
      });
    }
  });

  // 관람 가능 회차가 없는 사유 구분.
  let outcome: Outcome;
  if (routed.length > 0) outcome = 'recommended';
  else if (routeOkCount === 0 && unroutable.length > 0) outcome = 'no_route_confirmed';
  else outcome = 'no_feasible_showtime';

  const notices: Notice[] = [...sampleNotices];
  if (availability.coverage === 'partial') notices.push(PARTIAL_COVERAGE_NOTICE);
  if (unroutable.length > 0) notices.push(ROUTE_UNCONFIRMED_NOTICE);

  const stored = deps.store.put({
    ...base,
    outcome,
    partialFailure: unroutable.length > 0,
    notices,
    routed,
    unroutableCinemas: unroutable,
    unreachableCinemas: unreachable,
  });
  return resort(deps, stored.resultId, sortBy);
}

/**
 * 저장된 결과만으로 재정렬한다. 경로·상영시간표 공급자를 호출하지 않는다.
 * 없거나 만료되면 404 result_expired.
 */
export function resort(deps: Pick<RecommendDeps, 'store'>, resultId: string, sortBy?: SortBy): RecommendationResult {
  const stored = deps.store.get(resultId);
  if (!stored) throw new RecommendError(404, 'result_expired', '결과가 만료되었거나 존재하지 않습니다. 다시 추천을 요청하세요.');
  return render(stored, sortBy ?? stored.sortBy);
}

function render(stored: StoredResult, sortBy: SortBy): RecommendationResult {
  const byId = new Map(stored.routed.map((r) => [r.cinema.cinemaId, r]));
  const items = stored.routed.flatMap((r) =>
    r.showtimes
      .filter((s) => s.feasible)
      .map((s) => ({
        showtimeId: s.showtimeId,
        cinemaId: r.cinema.cinemaId,
        start: s.start,
        travelMinutes: r.travelMinutes,
        waitMinutes: s.waitMinutes,
      })),
  );
  const rankings = rankCinemas(items, sortBy, WAIT_WEIGHT);

  const cinemas: RankedCinema[] = rankings.map((cr) => {
    const r = byId.get(cr.cinemaId) as StoredRoutedCinema;
    const rankByShowtime = new Map(cr.showtimes.map((x) => [x.item.showtimeId, x.rank]));
    const repId = cr.representative.item.showtimeId;
    const showtimes: Showtime[] = r.showtimes.map((s) => {
      const rank = s.feasible ? (rankByShowtime.get(s.showtimeId) ?? null) : null;
      return {
        showtimeId: s.showtimeId,
        startTime: s.startTime,
        businessTime: s.businessTime,
        screenName: s.screenName,
        verdict: s.feasible ? 'arrivable' : 'unarrivable',
        waitMinutes: s.waitMinutes,
        spareMinutes: s.spareMinutes,
        rank,
        isRepresentative: s.showtimeId === repId,
        bookingUrl: s.feasible ? s.bookingUrl : null,
      };
    });
    return {
      ...r.cinema,
      rank: cr.rank,
      transportMode: stored.transportMode,
      travelMinutes: r.travelMinutes,
      arrivalTime: r.arrivalTime,
      routeStatus: 'ok',
      directionsUrl: r.directionsUrl,
      representativeShowtimeId: repId,
      feasibleShowtimeCount: cr.feasibleShowtimeCount,
      otherCount: cr.otherCount,
      showtimes,
    };
  });

  const meta: ResultMeta = {
    resultId: stored.resultId,
    movieId: stored.movieId,
    requestedAt: stored.requestedAt,
    departureTime: stored.departureTime,
    transportMode: stored.transportMode,
    sortBy,
    outcome: stored.outcome,
    coverage: stored.coverage,
    partialFailure: stored.partialFailure,
    notices: stored.notices.map((n) => ({ ...n })),
    expiresAt: stored.expiresAt,
    source: stored.source,
    lastUpdatedAt: stored.lastUpdatedAt,
    policy: { ...stored.policy },
  };
  return {
    meta,
    cinemas,
    unroutableCinemas: structuredClone(stored.unroutableCinemas),
    unreachableCinemas: structuredClone(stored.unreachableCinemas),
  };
}
