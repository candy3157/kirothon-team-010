import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadConfig, parseOrigins } from '../src/config.js';

const ALLOWED = 'http://localhost:5173';
const ALLOWED_LOOPBACK = 'http://127.0.0.1:5173';
const DENIED = 'http://evil.example';

describe('CORS', () => {
  it('허용 origin은 Access-Control-Allow-Origin을 받는다', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/health', headers: { origin: ALLOWED } });
    expect(res.statusCode).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED);
  });

  it('127.0.0.1:5173도 기본으로 허용한다', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/health', headers: { origin: ALLOWED_LOOPBACK } });
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED_LOOPBACK);
  });

  it('허용되지 않은 origin에는 CORS 헤더가 없다(와일드카드 아님)', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/health', headers: { origin: DENIED } });
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.headers['access-control-allow-origin']).not.toBe('*');
  });

  it('preflight: 허용 origin은 메서드·헤더를 허용받는다', async () => {
    const app = buildApp();
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/api/recommendations',
      headers: {
        origin: ALLOWED,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    });
    expect(res.statusCode).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED);
    expect(String(res.headers['access-control-allow-methods'])).toContain('POST');
    expect(String(res.headers['access-control-allow-headers']).toLowerCase()).toContain('content-type');
  });

  it('preflight: 차단 origin에는 허용 헤더가 없다', async () => {
    const app = buildApp();
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/api/recommendations',
      headers: { origin: DENIED, 'access-control-request-method': 'POST' },
    });
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('frontendOrigins로 다른 origin을 지정할 수 있다', async () => {
    const app = buildApp({}, { frontendOrigins: ['https://app.example.com'] });
    const ok = await app.inject({ method: 'GET', url: '/api/health', headers: { origin: 'https://app.example.com' } });
    const no = await app.inject({ method: 'GET', url: '/api/health', headers: { origin: ALLOWED } });
    expect(ok.headers['access-control-allow-origin']).toBe('https://app.example.com');
    expect(no.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('와일드카드 origin 설정은 거부한다', () => {
    expect(() => buildApp({}, { frontendOrigins: ['*'] })).toThrow();
    expect(() => parseOrigins('http://*.example.com')).toThrow();
  });
});

describe('보안 헤더·요청 크기', () => {
  it('helmet 헤더가 붙는다', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('전역 본문 제한을 넘으면 413', async () => {
    const app = buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/recommendations',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ pad: 'x'.repeat(40 * 1024) }),
    });
    expect(res.statusCode).toBe(413);
  });
});

describe('loadConfig', () => {
  it('기본값은 127.0.0.1, 5173 origin, sample/mock', () => {
    const c = loadConfig({});
    expect(c.host).toBe('127.0.0.1');
    expect(c.frontendOrigins).toEqual([ALLOWED, ALLOWED_LOOPBACK]);
    expect(c.showtimeProvider).toBe('sample');
    expect(c.routeProvider).toBe('mock');
  });

  it('쉼표로 여러 origin을 받는다', () => {
    const c = loadConfig({ FRONTEND_ORIGIN: 'http://localhost:5173, https://a.example.com/' });
    expect(c.frontendOrigins).toEqual(['http://localhost:5173', 'https://a.example.com']);
  });

  it('구현되지 않은 공급자 이름은 오류', () => {
    expect(() => loadConfig({ SHOWTIME_PROVIDER: 'cgv' })).toThrow();
    expect(() => loadConfig({ ROUTE_PROVIDER: 'kakao' })).toThrow();
  });
});
