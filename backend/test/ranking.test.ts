import { describe, expect, it } from 'vitest';
import { rankCinemas, rankShowtimes, type RankableShowtime } from '../src/services/ranking.js';
import { businessTimeToInstant } from '../src/time.js';

const D = '2026-11-14';
const at = (t: string) => businessTimeToInstant(D, t);

const mk = (showtimeId: string, cinemaId: string, t: string, travel: number, wait: number): RankableShowtime => ({
  showtimeId,
  cinemaId,
  start: at(t),
  travelMinutes: travel,
  waitMinutes: wait,
});

// 4.3 예시: 출발 14:00
const gn1440 = mk('g1', 'gangnam', '14:40', 25, 15);
const gn1630 = mk('g2', 'gangnam', '16:30', 25, 125);
const js1500 = mk('j1', 'jamsil', '15:00', 30, 30);
const all = [gn1630, js1500, gn1440];

describe('ranking', () => {
  it('종합 추천 비용 30.3 / 68.8 / 40.5', () => {
    const r = rankShowtimes(all, 'balanced');
    const cost = Object.fromEntries(r.map((x) => [x.item.showtimeId, x.cost]));
    expect(cost.g1).toBeCloseTo(30.25, 2); // 25 + 0.35*15 = 30.25 (표기 30.3)
    expect(cost.g2).toBeCloseTo(68.75, 2); // 표기 68.8
    expect(cost.j1).toBeCloseTo(40.5, 2);
    expect(r.map((x) => x.item.showtimeId)).toEqual(['g1', 'j1', 'g2']);
  });

  it('AT-15: 영화관 2개, 강남 14:40 외 1개, 잠실 15:00', () => {
    const c = rankCinemas(all, 'balanced');
    expect(c).toHaveLength(2);
    expect(c[0]!.cinemaId).toBe('gangnam');
    expect(c[0]!.representative.item.showtimeId).toBe('g1');
    expect(c[0]!.otherCount).toBe(1);
    expect(c[0]!.feasibleShowtimeCount).toBe(2);
    expect(c[0]!.showtimes.map((s) => s.item.showtimeId)).toEqual(['g1', 'g2']);
    expect(c[1]!.cinemaId).toBe('jamsil');
    expect(c[1]!.representative.item.showtimeId).toBe('j1');
    expect(c[1]!.otherCount).toBe(0);
    expect(c.map((x) => x.rank)).toEqual([1, 2]);
  });

  it('AT-12: 최단 이동(travel)으로 재정렬', () => {
    const r = rankShowtimes(all, 'travel');
    // 이동 25(g1,g2) < 30(j1); 동점은 시작시각 순
    expect(r.map((x) => x.item.showtimeId)).toEqual(['g1', 'g2', 'j1']);
    const c = rankCinemas(all, 'travel');
    expect(c.map((x) => x.cinemaId)).toEqual(['gangnam', 'jamsil']);
  });

  it('AT-12: 빠른 관람(earliest)으로 재정렬', () => {
    const r = rankShowtimes(all, 'earliest');
    expect(r.map((x) => x.item.showtimeId)).toEqual(['g1', 'j1', 'g2']);
  });

  it('정렬 기준에 따라 대표 회차가 바뀐다', () => {
    const a = mk('a1', 'A', '15:00', 10, 50); // balanced 27.5
    const a2 = mk('a2', 'A', '16:00', 10, 110); // balanced 48.5
    const b = mk('b1', 'B', '14:30', 20, 10); // balanced 23.5
    const bal = rankCinemas([a, a2, b], 'balanced');
    expect(bal.map((x) => x.cinemaId)).toEqual(['B', 'A']);
    const tr = rankCinemas([a, a2, b], 'travel');
    expect(tr.map((x) => x.cinemaId)).toEqual(['A', 'B']);
    expect(tr[0]!.representative.item.showtimeId).toBe('a1');
  });

  it('동점 규칙: balanced는 시작시각 → 이동 → 영화관 → 회차', () => {
    // 비용 동일(30): travel30/wait0 vs travel 20/wait ~28.57 는 부동소수 위험이라 정수로 구성
    const x = mk('x', 'C2', '15:00', 30, 0); // 30
    const y = mk('y', 'C1', '14:00', 20, 10 / 0.35); // 20 + 10 = 30
    expect(rankShowtimes([x, y], 'balanced').map((r) => r.item.showtimeId)).toEqual(['y', 'x']); // 시작 빠른 y
    const p = mk('p', 'C2', '15:00', 30, 0);
    const q = mk('q', 'C1', '15:00', 30, 0);
    expect(rankShowtimes([p, q], 'balanced').map((r) => r.item.showtimeId)).toEqual(['q', 'p']); // 영화관 ID
    const p2 = mk('b', 'C1', '15:00', 30, 0);
    const q2 = mk('a', 'C1', '15:00', 30, 0);
    expect(rankShowtimes([p2, q2], 'balanced').map((r) => r.item.showtimeId)).toEqual(['a', 'b']); // 회차 ID
  });

  it('동점 규칙: travel은 시작시각 → 영화관, earliest는 이동 → 영화관', () => {
    const a = mk('a', 'C2', '15:00', 10, 0);
    const b = mk('b', 'C1', '16:00', 10, 0);
    expect(rankShowtimes([b, a], 'travel').map((r) => r.item.showtimeId)).toEqual(['a', 'b']);
    const c = mk('c', 'C2', '15:00', 20, 0);
    const d = mk('d', 'C1', '15:00', 10, 0);
    const e = mk('e', 'C0', '15:00', 10, 0);
    expect(rankShowtimes([c, d, e], 'earliest').map((r) => r.item.showtimeId)).toEqual(['e', 'd', 'c']);
  });

  it('입력 배열을 변경하지 않고 빈 입력을 처리한다', () => {
    const copy = [...all];
    rankCinemas(all, 'balanced');
    expect(all).toEqual(copy);
    expect(rankCinemas([], 'balanced')).toEqual([]);
  });
});
