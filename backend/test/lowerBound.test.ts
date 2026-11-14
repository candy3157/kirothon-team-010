import { describe, expect, it } from 'vitest';
import { haversineKm, judgeLowerBound, lowerBoundMinutes } from '../src/services/lowerBound.js';
import { businessTimeToInstant } from '../src/time.js';

const D = '2026-11-14';
const at = (t: string) => businessTimeToInstant(D, t);
const origin = { latitude: 37.5, longitude: 127.0 };
/** 위도 차로 정확히 약 300km 떨어진 지점. */
const far = { latitude: 37.5 - 300 / 111.195, longitude: 127.0 };

describe('lowerBound', () => {
  it('haversine: 같은 지점 0, 위도 1도 약 111km', () => {
    expect(haversineKm(origin, origin)).toBe(0);
    expect(haversineKm({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 })).toBeCloseTo(111.195, 1);
  });

  it('AT-18: 출발 21:00, 300km(car), 마지막 23:00 -> 도착 불가', () => {
    const v = judgeLowerBound({
      origin,
      cinema: far,
      mode: 'car',
      departure: at('21:00'),
      lastShowtimeStart: at('23:00'),
    });
    expect(v.lowerBoundMinutes).toBeCloseTo(120, 0);
    expect(v.unreachable).toBe(true);
  });

  it('AT-18: walk도 도착 불가', () => {
    const v = judgeLowerBound({
      origin,
      cinema: far,
      mode: 'walk',
      departure: at('21:00'),
      lastShowtimeStart: at('23:00'),
    });
    expect(v.unreachable).toBe(true);
  });

  it('고정 km 컷오프 없음: 300km여도 하한이 시간 안이면 도착 불가 아님', () => {
    const v = judgeLowerBound({
      origin,
      cinema: far,
      mode: 'transit',
      departure: at('21:00'),
      lastShowtimeStart: at('23:00'),
    });
    expect(v.unreachable).toBe(false);
  });

  it('경계: 준비 완료 == 마지막 시작이면 도착 불가 아님', () => {
    // 하한 20분 + 버퍼 10분 = 30분 -> 14:30 출발, 15:00 시작
    const speed = { car: 60, transit: 60, walk: 60 };
    const cinema = { latitude: origin.latitude + 20 / 111.195, longitude: origin.longitude };
    expect(lowerBoundMinutes(origin, cinema, 'car', speed)).toBeCloseTo(20, 3);
    const base = { origin, cinema, mode: 'car' as const, maxSpeedKmh: speed, bufferMinutes: 10 };
    expect(
      judgeLowerBound({ ...base, departure: at('14:30'), lastShowtimeStart: at('15:00') }).unreachable,
    ).toBe(false);
    expect(
      judgeLowerBound({ ...base, departure: at('14:31'), lastShowtimeStart: at('15:00') }).unreachable,
    ).toBe(true);
  });

  it('마지막 회차 없음이면 판정하지 않는다', () => {
    const v = judgeLowerBound({
      origin,
      cinema: far,
      mode: 'walk',
      departure: at('21:00'),
      lastShowtimeStart: null,
    });
    expect(v.unreachable).toBe(false);
  });

  it('25:10 심야 회차가 마지막이면 그 시각까지 허용', () => {
    const v = judgeLowerBound({
      origin,
      cinema: far,
      mode: 'car',
      departure: at('21:00'),
      lastShowtimeStart: at('25:10'),
    });
    expect(v.unreachable).toBe(false);
  });
});
