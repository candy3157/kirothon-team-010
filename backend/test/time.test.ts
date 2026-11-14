import { describe, expect, it } from 'vitest';
import {
  TimeFormatError,
  businessTimeToInstant,
  businessTimeToIso,
  isTodayBusinessDate,
  businessDateOf,
  isWithinBookingWindow,
  isUpcomingTodayShowtime,
  lastShowtimeStart,
  parseBusinessTime,
  startsAfter,
  todayBusinessDate,
  toSeoulIso,
} from '../src/time.js';

const D = '2026-11-14';
const kst = (s: string) => new Date(`${s}+09:00`);

describe('7일 조회 범위와 04시 영업일 경계', () => {
  it.each(['2026-11-14T23:30:00', '2026-11-15T03:59:00'])('현재 %s의 마지막 심야까지 포함한다', (at) => {
    const now = kst(at);
    expect(isWithinBookingWindow(businessDateOf(kst('2026-11-21T03:59:59')), now, 6)).toBe(true);
    expect(isWithinBookingWindow(businessDateOf(kst('2026-11-21T04:00:00')), now, 6)).toBe(false);
    expect(isWithinBookingWindow('2026-11-13', now, 6)).toBe(false);
  });
  it('04시가 되면 조회 가능한 마지막 영업일도 하루 이동한다', () => {
    expect(isWithinBookingWindow('2026-11-21', kst('2026-11-15T04:00:00'), 6)).toBe(true);
    expect(isWithinBookingWindow('2026-11-14', kst('2026-11-15T04:00:00'), 6)).toBe(false);
  });
});

describe('AT-19: 25:10 심야 회차', () => {
  it('다음 날 01:10(+09:00)으로 변환한다', () => {
    expect(businessTimeToIso(D, '25:10')).toBe('2026-11-15T01:10:00+09:00');
    expect(businessTimeToInstant(D, '25:10').toISOString()).toBe('2026-11-14T16:10:00.000Z');
  });

  it('오늘 영업일 회차로 포함된다(밤 23:00 요청)', () => {
    expect(isUpcomingTodayShowtime(D, '25:10', kst('2026-11-14T23:00:00'))).toBe(true);
  });

  it('월말 경계에서도 다음 달로 넘어간다', () => {
    expect(businessTimeToIso('2026-11-30', '25:10')).toBe('2026-12-01T01:10:00+09:00');
    expect(businessTimeToIso('2026-12-31', '24:00')).toBe('2027-01-01T00:00:00+09:00');
  });
});

describe('자정 경계', () => {
  it('영업일은 04시에 바뀐다(자정에는 안 바뀐다)', () => {
    expect(todayBusinessDate(kst('2026-11-14T23:59:59'))).toBe('2026-11-14');
    expect(todayBusinessDate(kst('2026-11-15T00:00:00'))).toBe('2026-11-14');
    expect(todayBusinessDate(kst('2026-11-15T03:59:59'))).toBe('2026-11-14');
    expect(todayBusinessDate(kst('2026-11-15T04:00:00'))).toBe('2026-11-15');
  });

  it('UTC 날짜와 KST 날짜가 다른 시각도 KST 04시 기준으로 판정한다', () => {
    // 2026-11-14T15:30Z = 2026-11-15 00:30 KST → 영업일 11-14
    expect(todayBusinessDate(new Date('2026-11-14T15:30:00Z'))).toBe('2026-11-14');
    expect(isTodayBusinessDate('2026-11-14', new Date('2026-11-14T15:30:00Z'))).toBe(true);
    // 2026-11-14T19:00Z = 2026-11-15 04:00 KST → 영업일 11-15
    expect(isTodayBusinessDate('2026-11-14', new Date('2026-11-14T19:00:00Z'))).toBe(false);
  });

  it('새벽 00:30 요청에도 25:10 회차가 남아 있다', () => {
    expect(isUpcomingTodayShowtime(D, '25:10', kst('2026-11-15T00:30:00'))).toBe(true);
    expect(isUpcomingTodayShowtime(D, '25:10', kst('2026-11-15T01:10:00'))).toBe(false);
  });

  it('00:00 회차는 영업일 다음 날 자정이다', () => {
    expect(businessTimeToIso(D, '24:00')).toBe('2026-11-15T00:00:00+09:00');
    expect(businessTimeToIso(D, '00:00')).toBe('2026-11-14T00:00:00+09:00');
  });
});

describe('요청 시점 이후 시작 판정', () => {
  const start = businessTimeToInstant(D, '14:40');
  it('시작 전이면 true', () => {
    expect(startsAfter(start, kst('2026-11-14T14:39:59'))).toBe(true);
  });
  it('시작 시각과 같거나 지나면 false(진행 중 회차 제외)', () => {
    expect(startsAfter(start, kst('2026-11-14T14:40:00'))).toBe(false);
    expect(startsAfter(start, kst('2026-11-14T14:41:00'))).toBe(false);
  });
  it('다른 영업일 회차는 오늘 회차가 아니다', () => {
    expect(isUpcomingTodayShowtime('2026-11-15', '10:00', kst('2026-11-14T09:00:00'))).toBe(false);
  });
});

describe('영화관의 마지막 회차 시작', () => {
  it('문자열 비교가 아니라 분 단위로 최댓값을 구한다', () => {
    const last = lastShowtimeStart(D, ['9:30', '25:10', '23:00']);
    expect(last && toSeoulIso(last)).toBe('2026-11-15T01:10:00+09:00');
  });
  it('회차가 없으면 null', () => {
    expect(lastShowtimeStart(D, [])).toBeNull();
  });
  it('AT-18 입력: 마지막 회차 23:00', () => {
    const last = lastShowtimeStart(D, ['18:00', '23:00']);
    expect(last && toSeoulIso(last)).toBe('2026-11-14T23:00:00+09:00');
  });
});

describe('입력 검증', () => {
  it.each(['', '1410', '14:5', '14:60', '48:00', '-1:00', 'aa:bb'])('잘못된 시간 %j', (v) => {
    expect(() => parseBusinessTime(v)).toThrow(TimeFormatError);
  });
  it.each(['2026-13-01', '2026-02-31', '20261114', ''])('잘못된 날짜 %j', (v) => {
    expect(() => businessTimeToInstant(v, '10:00')).toThrow(TimeFormatError);
  });
  it('47:59까지 허용', () => {
    expect(parseBusinessTime('47:59')).toBe(47 * 60 + 59);
  });
});
