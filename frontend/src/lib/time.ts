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

/** 오늘 "HH:mm" → "YYYY-MM-DDTHH:mm:00+09:00" */
export function departureISO(hhmm: string, now: Date = new Date()): string {
  return `${todayKST(now)}T${hhmm}:00+09:00`;
}

/** 오늘 "HH:mm"이 이미 지난 시각인지 (1분 여유) */
export function isPastTime(hhmm: string, now: Date = new Date()): boolean {
  return Date.parse(departureISO(hhmm, now)) < now.getTime() - 60_000;
}

/** 지금 + min분을 10분 단위로 올린 "HH:mm" (자정을 넘기면 23:50) */
export function suggestTime(min = 30, now: Date = new Date()): string {
  const t = new Date(now.getTime() + min * 60_000);
  if (todayKST(t) !== todayKST(now)) return '23:50';
  const [h, m] = hm(t).split(':').map(Number);
  const up = Math.ceil(m / 10) * 10;
  if (up === 60) return h === 23 ? '23:50' : `${String(h + 1).padStart(2, '0')}:00`;
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
