import { BUFFER_MINUTES } from '../policy.js';
import { addMinutes, diffMinutes, toSeoulIso } from '../time.js';
import type { ShowtimeVerdict } from '../types.js';

/**
 * 관람 가능성 판정(회차 단위, 순수 함수).
 *  arrivalTime = departure + travelMinutes
 *  readyTime   = arrivalTime + bufferMinutes
 *  waitMinutes = start - arrivalTime  (음수 가능)
 *  spareMinutes = start - readyTime   (음수면 늦음)
 *  feasible    = spareMinutes >= 0    (준비 완료 시각 == 시작 시각이면 포함)
 */

export function arrivalTime(departure: Date, travelMinutes: number): Date {
  return addMinutes(departure, travelMinutes);
}

export function readyTime(arrival: Date, bufferMinutes: number = BUFFER_MINUTES): Date {
  return addMinutes(arrival, bufferMinutes);
}

export function waitMinutes(start: Date, arrival: Date): number {
  return diffMinutes(arrival, start);
}

export function spareMinutes(start: Date, ready: Date): number {
  return diffMinutes(ready, start);
}

export function feasible(start: Date, ready: Date): boolean {
  return spareMinutes(start, ready) >= 0;
}

export interface EvaluateInput {
  showtimeId: string;
  start: Date;
  departure: Date;
  travelMinutes: number;
  bufferMinutes?: number;
}

export function evaluateShowtime(input: EvaluateInput): ShowtimeVerdict {
  const arrival = arrivalTime(input.departure, input.travelMinutes);
  const ready = readyTime(arrival, input.bufferMinutes ?? BUFFER_MINUTES);
  return {
    showtimeId: input.showtimeId,
    startTime: toSeoulIso(input.start),
    arrivalTime: toSeoulIso(arrival),
    readyTime: toSeoulIso(ready),
    feasible: feasible(input.start, ready),
    waitMinutes: waitMinutes(input.start, arrival),
    spareMinutes: spareMinutes(input.start, ready),
  };
}
