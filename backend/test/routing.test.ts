import { describe, expect, it } from 'vitest';
import { MockRouteProvider } from '../src/routing/mock.js';
import { isRouteApiKeyConfigured } from '../src/routing/provider.js';
import type { RouteQuery } from '../src/routing/provider.js';

const q = (cinemaId: string, mode: RouteQuery['mode'] = 'car'): RouteQuery => ({
  origin: { latitude: 37.5665, longitude: 126.978 },
  cinemaId,
  destination: { latitude: 37.4979, longitude: 127.0276 },
  mode,
  departureTime: '2026-11-14T13:00:00+09:00',
});

describe('MockRouteProvider', () => {
  it('is deterministic and counts calls', async () => {
    const p = new MockRouteProvider();
    const a = await p.getTravelMinutes(q('c1'));
    const b = await p.getTravelMinutes(q('c1'));
    expect(a).toEqual(b);
    expect(p.callCount).toBe(2);
    expect(p.callCountFor('c1')).toBe(2);
    p.resetCounts();
    expect(p.callCount).toBe(0);
  });

  it('injects failures per cinema', async () => {
    const p = new MockRouteProvider({ failures: { c2: 'route_timeout' } });
    expect(await p.getTravelMinutes(q('c2'))).toEqual({ ok: false, reason: 'route_timeout' });
    expect((await p.getTravelMinutes(q('c1'))).ok).toBe(true);
  });

  it('uses fixed minutes and mode speeds', async () => {
    const p = new MockRouteProvider({ fixedMinutes: { c3: { car: 30 } } });
    expect(await p.getTravelMinutes(q('c3'))).toEqual({ ok: true, minutes: 30 });
    const car = await p.getTravelMinutes(q('c1', 'car'));
    const walk = await p.getTravelMinutes(q('c1', 'walk'));
    expect(car.ok && walk.ok && walk.minutes > car.minutes).toBe(true);
  });

  it('reports key presence only', () => {
    expect(isRouteApiKeyConfigured({ ROUTE_API_KEY: 'x' })).toBe(true);
    expect(isRouteApiKeyConfigured({})).toBe(false);
  });
});
