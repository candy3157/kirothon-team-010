// 모든 시각은 서울(+09:00) 기준으로 다룬다.
const TZ = 'Asia/Seoul';

const hmFmt = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: TZ,
});
const dateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }); // YYYY-MM-DD

/** ISO 시각 → "19:40" (서울 시각) */
export function hm(iso: string | Date): string {
  return hmFmt.format(typeof iso === 'string' ? new Date(iso) : iso);
}

/** 서울 기준 오늘 날짜 "YYYY-MM-DD" */
export function todayKST(now: Date = new Date()): string {
  return dateFmt.format(now);
}

/** 영업일이 바뀌는 시각(시). 백엔드 policy.BUSINESS_DAY_START_HOUR와 같아야 한다. */
export const BUSINESS_DAY_START_HOUR = 4;

/** 서울 기준 오늘 영업일 "YYYY-MM-DD". 00:00–03:59는 전날 영업일이다. */
export function businessDateKST(now: Date = new Date()): string {
  return todayKST(new Date(now.getTime() - BUSINESS_DAY_START_HOUR * 3600_000));
}

/** "YYYY-MM-DD" + days */
function addDays(ymd: string, days: number): string {
  return new Date(Date.parse(`${ymd}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * 오늘 영업일의 "HH:mm" → "YYYY-MM-DDTHH:mm:00+09:00".
 * 04시 전 시각(00:00–03:59)은 영업일 다음 날 새벽으로 본다.
 * 예: 11-14 23:30에 "00:20" → 2026-11-15T00:20:00+09:00
 */
export function departureISO(hhmm: string, now: Date = new Date()): string {
  const h = Number(hhmm.slice(0, 2));
  const date = businessDateKST(now);
  return `${h < BUSINESS_DAY_START_HOUR ? addDays(date, 1) : date}T${hhmm}:00+09:00`;
}

/** 오늘 "HH:mm"이 이미 지난 시각인지 (1분 여유) */
export function isPastTime(hhmm: string, now: Date = new Date()): boolean {
  return Date.parse(departureISO(hhmm, now)) < now.getTime() - 60_000;
}

/** 지금 + min분을 10분 단위로 올린 "HH:mm" (영업일을 넘기면 03:50) */
export function suggestTime(min = 30, now: Date = new Date()): string {
  const t = new Date(now.getTime() + min * 60_000);
  if (businessDateKST(t) !== businessDateKST(now)) return '03:50';
  const [h, m] = hm(t).split(':').map(Number);
  const up = Math.ceil(m / 10) * 10;
  if (up === 60) {
    if (h === BUSINESS_DAY_START_HOUR - 1) return '03:50'; // 04:00은 다음 영업일
    return `${pad2((h + 1) % 24)}:00`;
  }
  return `${String(h).padStart(2, '0')}:${String(up).padStart(2, '0')}`;
}

/** a - b (분) */
export function diffMin(a: string, b: string): number {
  return Math.round((Date.parse(a) - Date.parse(b)) / 60_000);
}

export function addMinISO(iso: string, min: number): string {
  return new Date(Date.parse(iso) + min * 60_000).toISOString();
}

export const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * 시간표 표기 → 화면 표기. 자정 이후 심야 회차(24:00 이상)는 실제 시각으로 바꾼다.
 * 예: "25:10" → "01:10", "24:15" → "00:15", "14:40" → "14:40". 형식이 다르면 그대로 둔다.
 */
export function clockTime(businessTime: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(businessTime);
  if (!m) return businessTime;
  return `${pad2(Number(m[1]) % 24)}:${m[2]}`;
}
