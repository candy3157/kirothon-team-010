/**
 * 공통 타입. docs/openapi.yaml(v1.0.0)의 스키마와 이름·필드를 맞춘다.
 * 요청 타입에는 radiusKm 등 거리 제한 필드를 두지 않는다.
 */

export type TransportMode = 'car' | 'transit' | 'walk';
export const TRANSPORT_MODES: readonly TransportMode[] = ['car', 'transit', 'walk'];

export type SortBy = 'balanced' | 'travel' | 'earliest';
export const SORT_BYS: readonly SortBy[] = ['balanced', 'travel', 'earliest'];
export const DEFAULT_SORT_BY: SortBy = 'balanced';

export type AvailabilityStatus = 'showing' | 'not_showing' | 'unknown';
export type DataSource = 'sample' | 'provider';
export type Coverage = 'supported_cinemas' | 'partial' | 'none';

/** 내부 경로 조회 상태. */
export type RouteStatus = 'ok' | 'failed' | 'skipped_unreachable';

/** 응답의 경로 미확인 사유(UnroutableCinema.routeStatus). */
export type UnroutableStatus = 'route_failed' | 'route_timeout' | 'unsupported_area' | 'not_computed';

export type ShowtimeVerdictKind = 'arrivable' | 'unarrivable';
export type UnreachableReason = 'lower_bound' | 'all_showtimes_missed';

export type Outcome =
  | 'recommended'
  | 'no_feasible_showtime'
  | 'no_route_confirmed'
  | 'not_showing'
  | 'availability_unknown';

export type NoticeCode =
  | 'sample_data'
  | 'partial_coverage'
  | 'route_unconfirmed'
  | 'route_not_computed'
  | 'stale_timetable'
  | 'booking_not_guaranteed';

export type ErrorCode =
  | 'invalid_request'
  | 'unsupported_date'
  | 'departure_out_of_range'
  | 'movie_not_found'
  | 'result_expired'
  | 'payload_too_large'
  | 'rate_limited'
  | 'upstream_unavailable'
  | 'service_unavailable'
  | 'internal_error';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Movie {
  movieId: string;
  title: string;
  originalTitle?: string | null;
  posterUrl?: string | null;
  runtimeMinutes?: number | null;
  isShowingToday?: boolean;
}

export interface MovieListResponse {
  movies: Movie[];
  source: DataSource;
  lastUpdatedAt: string | null;
}

export interface Notice {
  code: NoticeCode;
  message: string;
}

export interface Availability {
  movieId: string;
  date: string;
  status: AvailabilityStatus;
  cinemaCount: number;
  showtimeCount: number;
  coverage: Coverage;
  lastUpdatedAt: string | null;
  source: DataSource;
  notices?: Notice[];
}

export interface Cinema {
  cinemaId: string;
  name: string;
  address: string;
  location: Coordinates;
}

/** 공급자(샘플 포함)가 주는 원본 회차. */
export interface RawShowtime {
  showtimeId: string;
  movieId: string;
  cinemaId: string;
  /** 영업일 시간표 표기. 예: '14:40', '25:10' */
  businessTime: string;
  /** 영업일(YYYY-MM-DD) */
  businessDate: string;
  screenName?: string | null;
  bookingUrl?: string | null;
}

/** 요청 시점 이후 유효한 회차(실제 시각 포함). */
export interface Showtime {
  showtimeId: string;
  startTime: string;
  businessTime: string;
  screenName?: string | null;
  verdict: ShowtimeVerdictKind;
  waitMinutes: number | null;
  spareMinutes: number | null;
  rank: number | null;
  isRepresentative?: boolean;
  bookingUrl: string | null;
}

/** 회차 판정 결과(서비스 내부). feasible = verdict === 'arrivable'. */
export interface ShowtimeVerdict {
  showtimeId: string;
  startTime: string;
  arrivalTime: string;
  readyTime: string;
  feasible: boolean;
  waitMinutes: number;
  spareMinutes: number;
}

export interface RecommendationRequest {
  movieId: string;
  origin: Coordinates;
  transportMode: TransportMode;
  /** 오프셋을 포함한 ISO 8601. 생략하면 요청 시점. */
  departureTime?: string;
  sortBy?: SortBy;
}

export interface Policy {
  bufferMinutes: number;
  waitWeight: number;
}

export interface ResultMeta {
  resultId: string;
  movieId: string;
  requestedAt: string;
  departureTime: string;
  transportMode: TransportMode;
  sortBy: SortBy;
  outcome: Outcome;
  coverage: Coverage;
  partialFailure: boolean;
  notices: Notice[];
  expiresAt: string;
  source: DataSource;
  lastUpdatedAt: string | null;
  policy: Policy;
}

export interface RankedCinema extends Cinema {
  rank: number;
  transportMode: TransportMode;
  travelMinutes: number;
  arrivalTime: string;
  routeStatus: 'ok';
  directionsUrl: string | null;
  representativeShowtimeId: string;
  feasibleShowtimeCount: number;
  otherCount: number;
  showtimes: Showtime[];
}

export interface UnroutableShowtime {
  showtimeId: string;
  startTime: string;
  businessTime: string;
  screenName?: string | null;
}

export interface UnroutableCinema extends Cinema {
  routeStatus: UnroutableStatus;
  message: string;
  showtimes: UnroutableShowtime[];
}

export interface UnreachableCinema extends Cinema {
  reason: UnreachableReason;
  /** lower_bound면 null */
  travelMinutes: number | null;
  /** all_showtimes_missed면 null */
  lowerBoundMinutes: number | null;
  lastShowtimeStart: string;
  showtimes: Showtime[];
}

export interface RecommendationResult {
  meta: ResultMeta;
  cinemas: RankedCinema[];
  unroutableCinemas: UnroutableCinema[];
  unreachableCinemas: UnreachableCinema[];
}

export interface ErrorDetail {
  field: string;
  issue: string;
}

export interface ErrorResponse {
  code: ErrorCode;
  message: string;
  requestId?: string;
  details?: ErrorDetail[];
}
