import { describe, expect, it } from 'vitest';
import type { RankedCinema, Showtime } from '../api/types';
import { reasonBadges, representative, unarrivableReason } from './recommend';
import { businessDateKST, clockTime, dateInputMax, dayLabel, departureISO, departureLabel, hm, isBeyondWindow, isPastTime, suggestTime, todayKST } from './time';

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
    expect(isBeyondWindow('2026-11-21T03:59', now)).toBe(false);
    expect(isBeyondWindow('2026-11-21T04:00', now)).toBe(true);
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

describe('영업일 04시 기준', () => {
  it('입력 상한은 현재 영업일 기준이며 월말에도 마지막 심야를 포함한다', () => {
    expect(dateInputMax(new Date('2026-11-15T03:59:00+09:00'))).toBe('2026-11-21T03:59');
    expect(dateInputMax(new Date('2026-11-15T04:00:00+09:00'))).toBe('2026-11-22T03:59');
    expect(dateInputMax(new Date('2026-12-28T14:00:00+09:00'))).toBe('2027-01-04T03:59');
  });
  const kst = (s: string) => new Date(`${s}+09:00`);
  it('00:00–03:59는 전날 영업일이다', () => {
    expect(businessDateKST(kst('2026-11-15T00:30:00'))).toBe('2026-11-14');
    expect(businessDateKST(kst('2026-11-15T03:59:00'))).toBe('2026-11-14');
    expect(businessDateKST(kst('2026-11-15T04:00:00'))).toBe('2026-11-15');
  });
  it('밤에 자정 넘은 시각을 고르면 다음 날 새벽으로 보낸다', () => {
    const late = kst('2026-11-14T23:30:00');
    expect(departureISO('2026-11-15T00:20')).toBe('2026-11-15T00:20:00+09:00');
    expect(departureISO('2026-11-14T23:50')).toBe('2026-11-14T23:50:00+09:00');
    expect(isPastTime('2026-11-15T00:20', late)).toBe(false);
  });
  it('새벽에 요청해도 같은 영업일로 계산한다', () => {
    const dawn = kst('2026-11-15T01:00:00');
    expect(departureISO('2026-11-15T02:00')).toBe('2026-11-15T02:00:00+09:00');
    expect(isPastTime('2026-11-14T23:00', dawn)).toBe(true);
  });
  it('날짜 선택이 가능하므로 추천 시각은 자정과 04시를 넘길 수 있다', () => {
    expect(suggestTime(30, kst('2026-11-14T23:25:00'))).toBe('2026-11-15T00:00');
    expect(suggestTime(30, kst('2026-11-15T03:25:00'))).toBe('2026-11-15T04:00');
    expect(suggestTime(30, kst('2026-11-15T03:40:00'))).toBe('2026-11-15T04:10');
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

describe('naverMapScriptUrl', () => {
  it('키가 있으면 ncpKeyId를 붙인다', async () => {
    const { naverMapScriptUrl } = await import('./naverMap');
    expect(naverMapScriptUrl({ VITE_NAVER_MAP_KEY_ID: 'abc' })).toBe(
      'https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=abc',
    );
  });
  it('키가 없거나 https가 아니면 null', async () => {
    const { naverMapScriptUrl } = await import('./naverMap');
    expect(naverMapScriptUrl({ VITE_NAVER_MAP_KEY_ID: ' ' })).toBeNull();
    expect(naverMapScriptUrl({ VITE_NAVER_MAP_KEY_ID: 'abc', VITE_NAVER_MAP_SCRIPT_URL: 'http://x.test/maps.js' })).toBeNull();
  });
});

describe('initialViewPoints', () => {
  const origin = { latitude: 37.5, longitude: 127.0 };
  const cin = (rank: number, lat: number) =>
    ({ cinemaId: `c${rank}`, rank, location: { latitude: lat, longitude: 127.0 } }) as unknown as RankedCinema;

  it('순위 1~5위 위치만 준다 (순서와 무관)', async () => {
    const { initialViewPoints } = await import('./recommend');
    const list = [7, 3, 1, 6, 2, 5, 4].map((r) => cin(r, 37.5 + r / 100));
    const pts = initialViewPoints(origin, list, []);
    expect(pts.map((p) => Math.round((p.latitude - 37.5) * 100))).toEqual([1, 2, 3, 4, 5]);
  });

  it('추천이 없으면 경로 미확인 중 가까운 곳', async () => {
    const { initialViewPoints } = await import('./recommend');
    const far = { cinemaId: 'f', location: { latitude: 35.1, longitude: 129.0 } };
    const near = { cinemaId: 'n', location: { latitude: 37.51, longitude: 127.0 } };
    const pts = initialViewPoints(origin, [], [far, near] as never, 1);
    expect(pts).toEqual([near.location]);
  });
});
