import type { TransportMode } from '../types.js';
import type { RouteFailureReason, RouteProvider, RouteQuery, RouteResult } from './provider.js';

const EARTH_RADIUS_KM = 6371;
/** mock 전용 평균 속도(km/h). 결정적 결과를 위한 값이며 정책 값이 아니다. */
const MOCK_SPEED_KMH: Record<TransportMode, number> = { car: 40, transit: 25, walk: 4.5 };

function haversineKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface MockRouteOptions {
  /** 영화관별 실패 주입 */
  failures?: Record<string, RouteFailureReason>;
  /** 영화관·이동수단별 고정 분(지정 시 거리 계산보다 우선) */
  fixedMinutes?: Record<string, Partial<Record<TransportMode, number>>>;
}

/** 결정적 mock: 같은 입력이면 항상 같은 분을 반환한다. */
export class MockRouteProvider implements RouteProvider {
  private readonly failures = new Map<string, RouteFailureReason>();
  private readonly fixed: Record<string, Partial<Record<TransportMode, number>>>;
  private total = 0;
  private readonly perCinema = new Map<string, number>();

  constructor(options: MockRouteOptions = {}) {
    for (const [id, reason] of Object.entries(options.failures ?? {})) this.failures.set(id, reason);
    this.fixed = { ...(options.fixedMinutes ?? {}) };
  }

  failFor(cinemaId: string, reason: RouteFailureReason = 'route_failed'): void {
    this.failures.set(cinemaId, reason);
  }

  clearFailure(cinemaId: string): void {
    this.failures.delete(cinemaId);
  }

  get callCount(): number {
    return this.total;
  }

  callCountFor(cinemaId: string): number {
    return this.perCinema.get(cinemaId) ?? 0;
  }

  resetCounts(): void {
    this.total = 0;
    this.perCinema.clear();
  }

  async getTravelMinutes(query: RouteQuery): Promise<RouteResult> {
    this.total += 1;
    this.perCinema.set(query.cinemaId, (this.perCinema.get(query.cinemaId) ?? 0) + 1);

    const reason = this.failures.get(query.cinemaId);
    if (reason) return { ok: false, reason };

    const fixed = this.fixed[query.cinemaId]?.[query.mode];
    if (fixed !== undefined) return { ok: true, minutes: fixed };

    const km = haversineKm(query.origin, query.destination);
    const minutes = Math.max(1, Math.ceil((km / MOCK_SPEED_KMH[query.mode]) * 60));
    return { ok: true, minutes };
  }
}
