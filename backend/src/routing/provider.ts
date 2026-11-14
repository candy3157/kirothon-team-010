import type { Coordinates, TransportMode } from '../types.js';

export interface RouteQuery {
  origin: Coordinates;
  /** 목적지 영화관 */
  cinemaId: string;
  destination: Coordinates;
  mode: TransportMode;
  /** 오프셋을 포함한 ISO 8601 */
  departureTime: string;
}

export type RouteFailureReason = 'route_failed' | 'route_timeout' | 'unsupported_area';

export type RouteResult =
  | { ok: true; minutes: number }
  | { ok: false; reason: RouteFailureReason };

export interface RouteProvider {
  getTravelMinutes(query: RouteQuery): Promise<RouteResult>;
}

/**
 * 실제 공급자용 키는 서버 환경변수에서만 읽는다.
 * 키 값은 반환·로그·응답에 넣지 않고, 설정 여부만 알려준다.
 */
export function isRouteApiKeyConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return typeof env.ROUTE_API_KEY === 'string' && env.ROUTE_API_KEY.length > 0;
}

/** 서버 내부에서만 쓴다. 호출 결과를 로그나 응답에 그대로 넣지 않는다. */
export function readRouteApiKey(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const key = env.ROUTE_API_KEY;
  return key && key.length > 0 ? key : undefined;
}
