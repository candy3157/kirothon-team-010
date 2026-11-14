import { WAIT_WEIGHT } from '../policy.js';
import type { SortBy } from '../types.js';

/**
 * 정렬·대표 회차 선정(순수 함수). 요구사항 4.3.
 * 입력은 관람 가능(feasible) 회차만 받는다. 필터링은 호출자 책임이다.
 */

export interface RankableShowtime {
  showtimeId: string;
  cinemaId: string;
  /** 회차 시작 시각 */
  start: Date;
  /** 영화관까지 이동시간(분). 같은 영화관의 회차는 같은 값. */
  travelMinutes: number;
  /** 도착 후 상영 시작까지 대기(분) */
  waitMinutes: number;
}

export interface RankedShowtime<T extends RankableShowtime = RankableShowtime> {
  item: T;
  /** 1부터 시작하는 전체 회차 순위 */
  rank: number;
  /** 정렬 기준값(balanced: 종합 비용, travel: 이동, earliest: 시작 epoch ms) */
  cost: number;
}

export interface CinemaRanking<T extends RankableShowtime = RankableShowtime> {
  cinemaId: string;
  /** 영화관 순위(대표 회차 순위 순서, 1부터) */
  rank: number;
  representative: RankedShowtime<T>;
  /** 영화관의 관람 가능 회차 수 */
  feasibleShowtimeCount: number;
  /** 대표 회차 외 관람 가능 회차 수 */
  otherCount: number;
  /** 같은 영화관의 관람 가능 회차(시작시각 순) */
  showtimes: RankedShowtime<T>[];
}

/** 종합 추천 비용. 표시용으로 소수 둘째 자리에서 반올림하지 않고 원값을 쓴다. */
export function balancedCost(travelMinutes: number, waitMinutes: number, waitWeight: number = WAIT_WEIGHT): number {
  return travelMinutes + waitWeight * waitMinutes;
}

export function costOf(s: RankableShowtime, sortBy: SortBy, waitWeight: number = WAIT_WEIGHT): number {
  switch (sortBy) {
    case 'balanced':
      return balancedCost(s.travelMinutes, s.waitMinutes, waitWeight);
    case 'travel':
      return s.travelMinutes;
    case 'earliest':
      return s.start.getTime();
  }
}

function cmpStr(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** 부동소수 오차로 동점이 깨지지 않게 1e-9 단위로 반올림해 비교한다. */
function cmpNum(a: number, b: number): number {
  const x = Math.round(a * 1e9);
  const y = Math.round(b * 1e9);
  return x < y ? -1 : x > y ? 1 : 0;
}

/** 4.3의 기준별 결정적 비교자. */
export function compareShowtimes(
  a: RankableShowtime,
  b: RankableShowtime,
  sortBy: SortBy,
  waitWeight: number = WAIT_WEIGHT,
): number {
  const start = cmpNum(a.start.getTime(), b.start.getTime());
  const travel = cmpNum(a.travelMinutes, b.travelMinutes);
  const cinema = cmpStr(a.cinemaId, b.cinemaId);
  const show = cmpStr(a.showtimeId, b.showtimeId);
  switch (sortBy) {
    case 'balanced':
      return (
        cmpNum(costOf(a, 'balanced', waitWeight), costOf(b, 'balanced', waitWeight)) ||
        start ||
        travel ||
        cinema ||
        show
      );
    case 'travel':
      return cmpNum(a.travelMinutes, b.travelMinutes) || start || cinema || show;
    case 'earliest':
      return start || travel || cinema || show;
  }
}

/** 모든 관람 가능 회차의 순위를 계산한다(입력은 변경하지 않는다). */
export function rankShowtimes<T extends RankableShowtime>(
  items: readonly T[],
  sortBy: SortBy,
  waitWeight: number = WAIT_WEIGHT,
): RankedShowtime<T>[] {
  return [...items]
    .sort((a, b) => compareShowtimes(a, b, sortBy, waitWeight))
    .map((item, i) => ({ item, rank: i + 1, cost: costOf(item, sortBy, waitWeight) }));
}

/**
 * 영화관별 최상위 회차를 대표 회차로 정하고, 대표 회차 순위로 영화관 순위를 매긴다.
 */
export function rankCinemas<T extends RankableShowtime>(
  items: readonly T[],
  sortBy: SortBy,
  waitWeight: number = WAIT_WEIGHT,
): CinemaRanking<T>[] {
  const ranked = rankShowtimes(items, sortBy, waitWeight);
  const byCinema = new Map<string, RankedShowtime<T>[]>();
  for (const r of ranked) {
    const list = byCinema.get(r.item.cinemaId);
    if (list) list.push(r);
    else byCinema.set(r.item.cinemaId, [r]);
  }
  // ranked가 순위순이므로 각 영화관의 첫 항목이 대표 회차이고, Map 삽입 순서가 영화관 순위다.
  const out: CinemaRanking<T>[] = [];
  for (const [cinemaId, list] of byCinema) {
    const showtimes = [...list].sort(
      (a, b) =>
        cmpNum(a.item.start.getTime(), b.item.start.getTime()) || cmpStr(a.item.showtimeId, b.item.showtimeId),
    );
    out.push({
      cinemaId,
      rank: out.length + 1,
      representative: list[0]!,
      feasibleShowtimeCount: list.length,
      otherCount: list.length - 1,
      showtimes,
    });
  }
  return out;
}
