import { BUSINESS_DAY_START_HOUR, TIME_ZONE_OFFSET } from './policy.js';

/**
 * 시간 유틸리티. 시간표는 영업일 기준 'HH:MM'이며 HH는 24 이상일 수 있다
 * (예: '25:10' = 영업일 다음 날 01:10). 계산은 Asia/Seoul(+09:00, DST 없음) 고정 오프셋.
 */

const OFFSET_MS = 9 * 3600_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^(\d{1,2}):([0-5]\d)$/;
/** 시간표 표기의 시(hour) 상한(포함). 48시 이상은 허용하지 않는다. */
const MAX_HOUR = 47;

export class TimeFormatError extends Error {}

function assertDate(date: string): void {
  if (!DATE_RE.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    throw new TimeFormatError(`invalid date: ${date}`);
  }
  // 2026-02-31 같은 값 거부
  if (new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
    throw new TimeFormatError(`invalid date: ${date}`);
  }
}

/** 시간표 문자열을 분(0 ~ 47*60+59)으로 변환. 형식 오류는 TimeFormatError. */
export function parseBusinessTime(businessTime: string): number {
  const m = TIME_RE.exec(businessTime);
  if (!m) throw new TimeFormatError(`invalid business time: ${businessTime}`);
  const h = Number(m[1]);
  if (h > MAX_HOUR) throw new TimeFormatError(`invalid business time: ${businessTime}`);
  return h * 60 + Number(m[2]);
}

/** 실제 시각(UTC epoch ms) 기준 Asia/Seoul 달력 날짜 YYYY-MM-DD. */
export function seoulDateOf(instant: Date): string {
  return new Date(instant.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * 실제 시각이 속한 영업일(YYYY-MM-DD). 영업일은 BUSINESS_DAY_START_HOUR(07시)에 바뀐다.
 * 예: 11-15 06:59 KST → '2026-11-14', 11-15 07:00 KST → '2026-11-15'.
 */
export function businessDateOf(instant: Date): string {
  return seoulDateOf(new Date(instant.getTime() - BUSINESS_DAY_START_HOUR * 3600_000));
}

/** 오늘 영업일(YYYY-MM-DD). */
export function todayBusinessDate(now: Date = new Date()): string {
  return businessDateOf(now);
}

/** 해당 영업일이 오늘 영업일인가. */
export function isTodayBusinessDate(businessDate: string, now: Date = new Date()): boolean {
  return businessDate === todayBusinessDate(now);
}

/** 영업일 + 시간표 문자열 -> 실제 시각(Date). '25:10' -> 다음 날 01:10 KST. */
export function businessTimeToInstant(businessDate: string, businessTime: string): Date {
  assertDate(businessDate);
  const minutes = parseBusinessTime(businessTime);
  const midnightUtc = Date.parse(`${businessDate}T00:00:00Z`) - OFFSET_MS;
  return new Date(midnightUtc + minutes * 60_000);
}

/** 실제 시각 -> 오프셋 포함 ISO(예: 2026-11-15T01:10:00+09:00). */
export function toSeoulIso(instant: Date): string {
  const s = new Date(instant.getTime() + OFFSET_MS).toISOString(); // 2026-11-15T01:10:00.000Z
  return `${s.slice(0, 19)}${TIME_ZONE_OFFSET}`;
}

/** 영업일 + 시간표 문자열 -> 오프셋 포함 ISO. */
export function businessTimeToIso(businessDate: string, businessTime: string): string {
  return toSeoulIso(businessTimeToInstant(businessDate, businessTime));
}

/** 요청 시점 이후에 시작하는 회차인가. 이미 시작한 회차(시작 시각 == now 포함)는 제외. */
export function startsAfter(showtimeStart: Date, now: Date): boolean {
  return showtimeStart.getTime() > now.getTime();
}

/** 오늘 영업일 회차이면서 요청 시점 이후 시작하는가. */
export function isUpcomingTodayShowtime(businessDate: string, businessTime: string, now: Date): boolean {
  return (
    isTodayBusinessDate(businessDate, now) &&
    startsAfter(businessTimeToInstant(businessDate, businessTime), now)
  );
}

/** 영화관의 영업일 마지막 회차 시작 시각. 회차가 없으면 null. */
export function lastShowtimeStart(
  businessDate: string,
  businessTimes: readonly string[],
): Date | null {
  let max: number | null = null;
  for (const t of businessTimes) {
    const m = parseBusinessTime(t);
    if (max === null || m > max) max = m;
  }
  if (max === null) return null;
  const h = Math.floor(max / 60);
  const mm = String(max % 60).padStart(2, '0');
  return businessTimeToInstant(businessDate, `${h}:${mm}`);
}

/** 분 단위 올림 가산. */
export function addMinutes(instant: Date, minutes: number): Date {
  return new Date(instant.getTime() + minutes * 60_000);
}

/** a -> b 분 차이(b - a). 소수 가능. */
export function diffMinutes(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / 60_000;
}
