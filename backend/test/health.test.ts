import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';

describe('GET /api/health', () => {
  it('returns ok', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok' });
    expect(typeof res.json().time).toBe('string');
    await app.close();
  });
});
