import { describe, expect, it } from 'vitest';
import type { RankedCinema, Showtime } from '../api/types';
import { reasonBadges, representative, unarrivableReason } from './recommend';
import { businessDateKST, clockTime, departureISO, hm, isPastTime, suggestTime, todayKST } from './time';

describe('clockTime', () => {
  it('자정 이후 심야 회차는 00시 기준으로 보여 준다', () => {
    expect(clockTime('24:15')).toBe('00:15');
    expect(clockTime('25:10')).toBe('01:10');
    expect(clockTime('24:00')).toBe('00:00');
  });
  it('보통 회차와 형식이 다른 값은 그대로 둔다', () => {
    expect(clockTime('14:40')).toBe('14:40');
    expect(clockTime('00:15')).toBe('00:15');
    expect(clockTime('')).toBe('');
  });
});

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
  const now = new Date('2026-11-14T05:12:00Z'); // 서울 14:12
  it('서울 시각으로 표시한다', () => {
    expect(hm('2026-11-14T14:40:00+09:00')).toBe('14:40');
    expect(todayKST(now)).toBe('2026-11-14');
  });
  it('오늘 출발 시각을 +09:00 ISO로 만든다', () => {
    expect(departureISO('19:30', now)).toBe('2026-11-14T19:30:00+09:00');
  });
  it('지난 시각을 알아본다', () => {
    expect(isPastTime('13:00', now)).toBe(true);
    expect(isPastTime('15:00', now)).toBe(false);
  });
  it('추천 시각은 10분 단위로 올린다', () => {
    expect(suggestTime(30, now)).toBe('14:50');
  });
});

describe('영업일 07시 기준', () => {
  const kst = (s: string) => new Date(`${s}+09:00`);
  it('00:00–06:59는 전날 영업일이다', () => {
    expect(businessDateKST(kst('2026-11-15T00:30:00'))).toBe('2026-11-14');
    expect(businessDateKST(kst('2026-11-15T06:59:00'))).toBe('2026-11-14');
    expect(businessDateKST(kst('2026-11-15T07:00:00'))).toBe('2026-11-15');
  });
  it('밤에 자정 넘은 시각을 고르면 다음 날 새벽으로 보낸다', () => {
    const late = kst('2026-11-14T23:30:00');
    expect(departureISO('00:20', late)).toBe('2026-11-15T00:20:00+09:00');
    expect(departureISO('23:50', late)).toBe('2026-11-14T23:50:00+09:00');
    expect(isPastTime('00:20', late)).toBe(false);
  });
  it('새벽에 요청해도 같은 영업일로 계산한다', () => {
    const dawn = kst('2026-11-15T01:00:00');
    expect(departureISO('02:00', dawn)).toBe('2026-11-15T02:00:00+09:00');
    expect(isPastTime('23:00', dawn)).toBe(true);
  });
  it('추천 시각은 자정은 넘고 07시는 넘지 않는다', () => {
    expect(suggestTime(30, kst('2026-11-14T23:25:00'))).toBe('00:00');
    expect(suggestTime(30, kst('2026-11-15T06:25:00'))).toBe('06:50');
    expect(suggestTime(30, kst('2026-11-15T06:40:00'))).toBe('06:50');
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
