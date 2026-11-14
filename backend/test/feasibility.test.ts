import { describe, expect, it } from 'vitest';
import { evaluateShowtime } from '../src/services/feasibility.js';
import { businessTimeToInstant } from '../src/time.js';

const D = '2026-11-14';
const departure = businessTimeToInstant(D, '14:00');
const at = (t: string) => businessTimeToInstant(D, t);

describe('feasibility', () => {
  it('AT-06: 14:40 포함, 도착 14:25, 대기 15, 여유 5', () => {
    const v = evaluateShowtime({ showtimeId: 's1', start: at('14:40'), departure, travelMinutes: 25 });
    expect(v.feasible).toBe(true);
    expect(v.arrivalTime).toBe('2026-11-14T14:25:00+09:00');
    expect(v.readyTime).toBe('2026-11-14T14:35:00+09:00');
    expect(v.waitMinutes).toBe(15);
    expect(v.spareMinutes).toBe(5);
  });

  it('AT-07: 14:30 제외 (여유 -5)', () => {
    const v = evaluateShowtime({ showtimeId: 's2', start: at('14:30'), departure, travelMinutes: 25 });
    expect(v.feasible).toBe(false);
    expect(v.waitMinutes).toBe(5);
    expect(v.spareMinutes).toBe(-5);
  });

  it('경계: 준비 완료 시각 == 시작 시각이면 포함', () => {
    const v = evaluateShowtime({ showtimeId: 's3', start: at('14:35'), departure, travelMinutes: 25 });
    expect(v.feasible).toBe(true);
    expect(v.spareMinutes).toBe(0);
  });

  it('도착이 시작보다 늦으면 대기 음수', () => {
    const v = evaluateShowtime({ showtimeId: 's4', start: at('14:20'), departure, travelMinutes: 25 });
    expect(v.feasible).toBe(false);
    expect(v.waitMinutes).toBe(-5);
  });

  it('심야 25:10 회차는 다음 날 01:10 기준으로 계산', () => {
    const v = evaluateShowtime({ showtimeId: 's5', start: at('25:10'), departure: at('24:30'), travelMinutes: 20 });
    expect(v.startTime).toBe('2026-11-15T01:10:00+09:00');
    expect(v.feasible).toBe(true);
    expect(v.spareMinutes).toBe(10);
  });

  it('bufferMinutes 재정의 가능', () => {
    const v = evaluateShowtime({ showtimeId: 's6', start: at('14:30'), departure, travelMinutes: 25, bufferMinutes: 0 });
    expect(v.feasible).toBe(true);
    expect(v.spareMinutes).toBe(5);
  });
});
