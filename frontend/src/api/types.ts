// docs/openapi.yaml (Cinema Recommendation API 1.0.0) 기준 타입

export type TransportMode = 'car' | 'transit' | 'walk';
export type SortBy = 'balanced' | 'travel' | 'earliest';
export type DataSource = 'sample' | 'provider';
export type Coverage = 'supported_cinemas' | 'partial' | 'none';

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

export interface RecommendationRequest {
  movieId: string;
  origin: Coordinates;
  transportMode: TransportMode;
  departureTime?: string;
  sortBy?: SortBy;
  /** 상영 전 도착 여유(분, 0–60). 생략하면 서버 기본 10분 (API 1.2.0) */
  bufferMinutes?: number;
}

export type NoticeCode =
  | 'sample_data'
  | 'partial_coverage'
  | 'route_unconfirmed'
  | 'route_not_computed'
  | 'stale_timetable'
  | 'booking_not_guaranteed';

export interface Notice {
  code: NoticeCode;
  message: string;
}

export type Outcome =
  | 'recommended'
  | 'no_feasible_showtime'
  | 'no_route_confirmed'
  | 'not_showing'
  | 'availability_unknown';

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
  policy: { bufferMinutes: number; waitWeight: number };
}

export interface Showtime {
  showtimeId: string;
  startTime: string;
  businessTime: string;
  screenName?: string | null;
  verdict: 'arrivable' | 'unarrivable';
  waitMinutes: number | null;
  spareMinutes: number | null;
  rank: number | null;
  isRepresentative?: boolean;
  bookingUrl: string | null;
}

export interface Cinema {
  cinemaId: string;
  name: string;
  address: string;
  location: Coordinates;
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
  routeStatus: 'route_failed' | 'route_timeout' | 'unsupported_area' | 'not_computed';
  message: string;
  showtimes: UnroutableShowtime[];
}

export interface UnreachableCinema extends Cinema {
  reason: 'lower_bound' | 'all_showtimes_missed';
  travelMinutes: number | null;
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

export interface ErrorResponse {
  code: ErrorCode;
  message: string;
  requestId?: string;
  details?: { field: string; issue: string }[];
}
