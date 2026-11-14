import type { Coordinates, RankedCinema, Showtime, UnroutableCinema } from '../api/types';
import { distanceKm } from './geo';

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

/** 지도를 처음 열 때 화면에 맞출 영화관 수 */
export const INITIAL_VIEW_COUNT = 5;

/**
 * 지도 첫 화면에 넣을 영화관 위치. 결과에서 빼는 것이 아니라 보이는 범위만 정한다(검색 반경 없음 원칙).
 * 추천 영화관이 있으면 순위 1~N위, 없으면 경로 미확인 영화관 중 출발지에서 가까운 N곳.
 */
export function initialViewPoints(
  origin: Coordinates,
  cinemas: readonly RankedCinema[],
  unroutable: readonly UnroutableCinema[],
  n: number = INITIAL_VIEW_COUNT,
): Coordinates[] {
  if (cinemas.length > 0) {
    return [...cinemas]
      .sort((a, b) => a.rank - b.rank)
      .slice(0, n)
      .map((c) => c.location);
  }
  return [...unroutable]
    .sort((a, b) => distanceKm(origin, a.location) - distanceKm(origin, b.location))
    .slice(0, n)
    .map((c) => c.location);
}
