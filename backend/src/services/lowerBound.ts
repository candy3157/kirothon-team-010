import { BUFFER_MINUTES, MAX_SPEED_KMH } from '../policy.js';
import { addMinutes } from '../time.js';
import type { Coordinates, TransportMode } from '../types.js';

/**
 * 도착 불가 하한 판정(순수 함수).
 * 직선거리 / 이동수단별 최고속도 = 이동시간의 하한. 실제 경로는 이보다 빠를 수 없다.
 * departure + lowerBound + buffer > 마지막 회차 시작 이면 어떤 회차도 불가능하므로 '도착 불가'.
 * 고정 km 반경 컷오프는 쓰지 않는다.
 */

const EARTH_RADIUS_KM = 6371.0088;
const toRad = (deg: number): number => (deg * Math.PI) / 180;

/** haversine 직선거리(km). */
export function haversineKm(a: Coordinates, b: Coordinates): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 이동시간 하한(분, 소수 가능). */
export function lowerBoundMinutes(
  origin: Coordinates,
  cinema: Coordinates,
  mode: TransportMode,
  maxSpeedKmh: Readonly<Record<TransportMode, number>> = MAX_SPEED_KMH,
): number {
  const speed = maxSpeedKmh[mode];
  if (!(speed > 0)) throw new Error(`invalid max speed for mode: ${mode}`);
  return (haversineKm(origin, cinema) / speed) * 60;
}

export interface LowerBoundVerdict {
  unreachable: boolean;
  lowerBoundMinutes: number;
  /** departure + lowerBound + buffer */
  earliestReadyTime: Date;
}

/** lastShowtimeStart가 null(회차 없음)이면 판정하지 않는다(unreachable=false). */
export function judgeLowerBound(params: {
  origin: Coordinates;
  cinema: Coordinates;
  mode: TransportMode;
  departure: Date;
  lastShowtimeStart: Date | null;
  bufferMinutes?: number;
  maxSpeedKmh?: Readonly<Record<TransportMode, number>>;
}): LowerBoundVerdict {
  const lb = lowerBoundMinutes(params.origin, params.cinema, params.mode, params.maxSpeedKmh);
  const earliestReadyTime = addMinutes(params.departure, lb + (params.bufferMinutes ?? BUFFER_MINUTES));
  const unreachable =
    params.lastShowtimeStart !== null &&
    earliestReadyTime.getTime() > params.lastShowtimeStart.getTime();
  return { unreachable, lowerBoundMinutes: lb, earliestReadyTime };
}
