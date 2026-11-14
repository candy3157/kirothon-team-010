import type { RankedCinema, Showtime } from '../api/types';

/** 영화관의 대표 회차 (없으면 첫 도착 가능 회차) */
export function representative(c: RankedCinema): Showtime | undefined {
  return (
    c.showtimes.find((s) => s.showtimeId === c.representativeShowtimeId) ??
    c.showtimes.find((s) => s.verdict === 'arrivable')
  );
}

/** 이름 옆 배지: 가장 빠른 관람 / 가장 가까움 */
export function reasonBadges(cinemas: RankedCinema[]): Map<string, string[]> {
  const out = new Map<string, string[]>(cinemas.map((c) => [c.cinemaId, []]));
  if (!cinemas.length) return out;

  let fastest: RankedCinema | undefined;
  let fastestStart = Infinity;
  for (const c of cinemas) {
    const t = Date.parse(representative(c)?.startTime ?? '');
    if (t < fastestStart || (t === fastestStart && fastest && c.travelMinutes < fastest.travelMinutes)) {
      fastest = c;
      fastestStart = t;
    }
  }
  const nearest = cinemas.reduce((a, b) => (b.travelMinutes < a.travelMinutes ? b : a));

  if (fastest) out.get(fastest.cinemaId)!.push('가장 빠른 관람');
  out.get(nearest.cinemaId)!.push('가장 가까움');
  return out;
}

/** 회차가 왜 안 되는지 짧은 설명 */
export function unarrivableReason(s: Showtime): string {
  if (s.spareMinutes == null) return '도착 시간 확인 불가';
  if (s.waitMinutes != null && s.waitMinutes < 0) return `${-s.waitMinutes}분 늦게 도착`;
  return '여유 시간 부족';
}
