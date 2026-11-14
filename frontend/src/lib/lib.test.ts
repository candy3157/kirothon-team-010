import { describe, expect, it } from 'vitest';
import type { RankedCinema, Showtime } from '../api/types';
import { reasonBadges, representative, unarrivableReason } from './recommend';
import { dayLabel, departureISO, departureLabel, hm, isBeyondWindow, isPastTime, suggestTime, todayKST } from './time';

const st = (id: string, start: string, verdict: Showtime['verdict'], wait: number | null, spare: number | null): Showtime => ({
  showtimeId: id,
  startTime: start,
  businessTime: hm(start),
  verdict,
  waitMinutes: wait,
  spareMinutes: spare,
  rank: verdict === 'arrivable' ? 1 : null,
  bookingUrl: null,
});

const cinema = (id: string, travel: number, rep: Showtime): RankedCinema => ({
  cinemaId: id,
  name: id,
  address: '',
  location: { latitude: 37.5, longitude: 127 },
  rank: 1,
  transportMode: 'transit',
  travelMinutes: travel,
  arrivalTime: rep.startTime,
  routeStatus: 'ok',
  directionsUrl: null,
  representativeShowtimeId: rep.showtimeId,
  feasibleShowtimeCount: 1,
  otherCount: 0,
  showtimes: [rep],
});

describe('time', () => {
  const now = new Date('2026-11-14T05:12:00Z'); // 서울 14:12 (토)
  it('서울 시각으로 표시한다', () => {
    expect(hm('2026-11-14T14:40:00+09:00')).toBe('14:40');
    expect(todayKST(now)).toBe('2026-11-14');
  });
  it('날짜·시간 입력값을 +09:00 ISO로 만든다', () => {
    expect(departureISO('2026-11-16T19:30')).toBe('2026-11-16T19:30:00+09:00');
  });
  it('지난 시각과 7일 범위 밖을 알아본다', () => {
    expect(isPastTime('2026-11-14T13:00', now)).toBe(true);
    expect(isPastTime('2026-11-15T09:00', now)).toBe(false);
    expect(isBeyondWindow('2026-11-20T23:00', now)).toBe(false);
    expect(isBeyondWindow('2026-11-21T00:10', now)).toBe(true);
  });
  it('추천 시각은 10분 단위로 올리고 자정을 넘길 수 있다', () => {
    expect(suggestTime(30, now)).toBe('2026-11-14T14:50');
    expect(suggestTime(30, new Date('2026-11-14T14:50:00Z'))).toBe('2026-11-15T00:20');
  });
  it('출발 표시: 오늘 / 내일 / 날짜(요일)', () => {
    expect(departureLabel('2026-11-14T19:30', now)).toBe('19:30');
    expect(departureLabel('2026-11-15T19:30', now)).toBe('내일 19:30');
    expect(departureLabel('2026-11-17T19:30:00+09:00', now)).toBe('11/17(화) 19:30');
    expect(dayLabel('2026-11-14T19:30:00+09:00', now)).toBe('오늘');
  });
});

describe('recommend', () => {
  const a = cinema('a', 30, st('a1', '2026-11-14T15:00:00+09:00', 'arrivable', 10, 0));
  const b = cinema('b', 10, st('b1', '2026-11-14T15:30:00+09:00', 'arrivable', 20, 10));

  it('대표 회차를 찾는다', () => {
    expect(representative(a)?.showtimeId).toBe('a1');
  });
  it('가장 빠른 관람 / 가장 가까움 배지를 붙인다', () => {
    const m = reasonBadges([a, b]);
    expect(m.get('a')).toEqual(['가장 빠른 관람']);
    expect(m.get('b')).toEqual(['가장 가까움']);
  });
  it('늦는 회차 사유를 보여준다', () => {
    expect(unarrivableReason(st('x', '2026-11-14T15:00:00+09:00', 'unarrivable', -5, -15))).toBe('5분 늦게 도착');
    expect(unarrivableReason(st('y', '2026-11-14T15:00:00+09:00', 'unarrivable', 5, -5))).toBe('여유 시간 부족');
  });
});
