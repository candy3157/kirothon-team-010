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

/** 고를 수 있는 범위(오늘 ~ 오늘+6일)를 넘었는지 */
export function isBeyondWindow(local: string, now: Date = new Date()): boolean {
  return local.slice(0, 10) > dateInputMax(now).slice(0, 10);
}

/** 입력칸 min / max */
export function dateInputMin(now: Date = new Date()): string {
  return toLocalInput(now);
}
export function dateInputMax(now: Date = new Date()): string {
  const last = new Date(now.getTime() + MAX_ADVANCE_DAYS * 86_400_000);
  return `${todayKST(last)}T23:59`;
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

/** a - b (분) */
export function diffMin(a: string, b: string): number {
  return Math.round((Date.parse(a) - Date.parse(b)) / 60_000);
}

export function addMinISO(iso: string, min: number): string {
  return new Date(Date.parse(iso) + min * 60_000).toISOString();
}

export const pad2 = (n: number) => String(n).padStart(2, '0');
