import type { TransportMode } from './types.js';

/**
 * 서버 정책값. 요청에서 받지 않는다. 응답 meta.policy로만 알린다.
 */

/** 입장 준비시간(분). 도착 후 이만큼 지나야 입장 준비 완료. */
export const BUFFER_MINUTES = 10;

/** balanced 정렬: travel + WAIT_WEIGHT * wait */
export const WAIT_WEIGHT = 0.35;

export const TIME_ZONE = 'Asia/Seoul';
/** Asia/Seoul은 DST가 없어 고정 오프셋을 쓸 수 있다. */
export const TIME_ZONE_OFFSET = '+09:00';

/** 추천 결과 보관 시간(초). 만료 후 GET은 404 result_expired. */
export const RESULT_TTL_SECONDS = 30 * 60;

/**
 * 이동수단별 최고속도 상한(km/h). 도착 불가 하한 판정에만 쓴다.
 * TBD: 값은 보수적 기본값(실제보다 빠르게 잡아 잘못된 '도착 불가'를 막는다).
 * 협의 후 확정한다. 고정 km 반경 컷오프는 쓰지 않는다.
 */
export const MAX_SPEED_KMH: Readonly<Record<TransportMode, number>> = {
  car: 150, // TBD
  transit: 350, // TBD (고속철도 최고속도 이상)
  walk: 10, // TBD
};

export interface ServerPolicy {
  bufferMinutes: number;
  waitWeight: number;
  timeZone: string;
  resultTtlSeconds: number;
  maxSpeedKmh: Readonly<Record<TransportMode, number>>;
}

export const policy: ServerPolicy = {
  bufferMinutes: BUFFER_MINUTES,
  waitWeight: WAIT_WEIGHT,
  timeZone: TIME_ZONE,
  resultTtlSeconds: RESULT_TTL_SECONDS,
  maxSpeedKmh: MAX_SPEED_KMH,
};

/** 응답 meta.policy에 노출할 값. */
export function publicPolicy(p: ServerPolicy = policy): { bufferMinutes: number; waitWeight: number } {
  return { bufferMinutes: p.bufferMinutes, waitWeight: p.waitWeight };
}
