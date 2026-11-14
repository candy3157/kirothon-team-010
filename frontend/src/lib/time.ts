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

/** 출발 날짜를 고를 수 있는 범위: 오늘 + 6일 (백엔드 MAX_ADVANCE_DAYS와 같게) */
export const MAX_ADVANCE_DAYS = 6;

/** 서울 시각 → 날짜·시간 입력칸 값 "YYYY-MM-DDTHH:mm" */
export function toLocalInput(d: Date): string {
  return `${todayKST(d)}T${hm(d)}`;
}

/** 날짜·시간 입력칸 값 "YYYY-MM-DDTHH:mm" → "YYYY-MM-DDTHH:mm:00+09:00" */
export function departureISO(local: string): string {
  return `${local}:00+09:00`;
}

/** 이미 지난 시각인지 (1분 여유) */
export function isPastTime(local: string, now: Date = new Date()): boolean {
  return Date.parse(departureISO(local)) < now.getTime() - 60_000;
}

/** 마지막 조회 영업일 다음 날 03:59까지 허용한다. */
export function isBeyondWindow(local: string, now: Date = new Date()): boolean {
  return Date.parse(departureISO(local)) > Date.parse(departureISO(dateInputMax(now)));
}

/** 입력칸 min / max */
export function dateInputMin(now: Date = new Date()): string {
  return toLocalInput(now);
}
export function dateInputMax(now: Date = new Date()): string {
  const endDate = addDays(businessDateKST(now), MAX_ADVANCE_DAYS + 1);
  return `${endDate}T${pad2(BUSINESS_DAY_START_HOUR - 1)}:59`;
}

/** 지금 + min분을 10분 단위로 올린 "YYYY-MM-DDTHH:mm" */
export function suggestTime(min = 30, now: Date = new Date()): string {
  const t = new Date(now.getTime() + min * 60_000);
  const step = 10 * 60_000;
  return toLocalInput(new Date(Math.ceil(t.getTime() / step) * step));
}

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
/** "19:30" (오늘) / "내일 19:30" / "11/17(화) 19:30" */
export function departureLabel(localOrIso: string, now: Date = new Date()): string {
  const iso = localOrIso.length <= 16 ? departureISO(localOrIso) : localOrIso;
  const d = new Date(iso);
  const day = todayKST(d);
  if (day === todayKST(now)) return hm(d);
  if (day === todayKST(new Date(now.getTime() + 86_400_000))) return `내일 ${hm(d)}`;
  const [, m, dd] = day.split('-').map(Number);
  const w = WEEK[new Date(`${day}T12:00:00+09:00`).getUTCDay()];
  return `${m}/${dd}(${w}) ${hm(d)}`;
}

/** 상영 날짜 표시: "오늘" / "내일" / "11/17(화)" */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const label = departureLabel(iso, now);
  const i = label.lastIndexOf(' ');
  return i < 0 ? '오늘' : label.slice(0, i);
}

/** 화면에 보일 분. 소수점은 버린다(반올림하지 않음). 예: 10.99 -> 10, -3.7 -> -3 */
export function wholeMin(n: number): number {
  return Math.trunc(n) || 0; // -0 방지
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
