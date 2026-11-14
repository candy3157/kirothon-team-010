import { SampleShowtimeProvider, type ShowtimeProvider } from './data/provider.js';
import { MockRouteProvider } from './routing/mock.js';
import type { RouteProvider } from './routing/provider.js';

/** 프론트 개발 서버 기본 origin (Vite 기본값). 와일드카드는 허용하지 않는다. */
export const DEFAULT_FRONTEND_ORIGIN = 'http://localhost:5173';
/** 전역 요청 본문 크기 제한(바이트). */
export const GLOBAL_BODY_LIMIT = 16 * 1024;

/** FRONTEND_ORIGIN(쉼표 구분)을 검증된 origin 목록으로 변환한다. '*'와 잘못된 값은 오류. */
export function parseOrigins(raw: string | undefined): string[] {
  const value = raw && raw.trim() !== '' ? raw : DEFAULT_FRONTEND_ORIGIN;
  const list = value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '');
  return list.map((o) => {
    if (o.includes('*')) throw new Error('FRONTEND_ORIGIN에는 와일드카드를 쓸 수 없습니다.');
    let u: URL;
    try {
      u = new URL(o);
    } catch {
      throw new Error(`FRONTEND_ORIGIN 값이 올바른 origin이 아닙니다: ${o}`);
    }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      throw new Error(`FRONTEND_ORIGIN은 http(s)만 허용합니다: ${o}`);
    }
    return u.origin;
  });
}

export type ShowtimeProviderName = 'sample';
export type RouteProviderName = 'mock';

export interface AppConfig {
  host: string;
  port: number;
  frontendOrigins: string[];
  showtimeProvider: ShowtimeProviderName;
  routeProvider: RouteProviderName;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const showtimeProvider = (env.SHOWTIME_PROVIDER?.trim() || 'sample') as string;
  const routeProvider = (env.ROUTE_PROVIDER?.trim() || 'mock') as string;
  if (showtimeProvider !== 'sample') {
    throw new Error(`지원하지 않는 SHOWTIME_PROVIDER: ${showtimeProvider} (사용 가능: sample)`);
  }
  if (routeProvider !== 'mock') {
    throw new Error(`지원하지 않는 ROUTE_PROVIDER: ${routeProvider} (사용 가능: mock)`);
  }
  const port = Number(env.PORT ?? 3001);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT가 올바르지 않습니다.');
  return {
    host: env.HOST?.trim() || '127.0.0.1',
    port,
    frontendOrigins: parseOrigins(env.FRONTEND_ORIGIN),
    showtimeProvider,
    routeProvider,
  };
}

export function createShowtimeProvider(_name: ShowtimeProviderName, now?: () => Date): ShowtimeProvider {
  return new SampleShowtimeProvider(now ? { now } : {});
}

export function createRouteProvider(_name: RouteProviderName): RouteProvider {
  return new MockRouteProvider();
}
