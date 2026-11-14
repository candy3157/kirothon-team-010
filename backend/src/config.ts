import { SampleShowtimeProvider, type ShowtimeProvider } from './data/provider.js';
import { MockRouteProvider } from './routing/mock.js';
import type { RouteProvider } from './routing/provider.js';

/** 프론트 개발 서버 기본 origin (Vite 기본값). 와일드카드는 허용하지 않는다. */
export const DEFAULT_FRONTEND_ORIGIN = 'http://localhost:5173';
/** 기본 허용 origin 목록. Vite를 127.0.0.1로 띄워도 같은 포트면 허용한다. */
export const DEFAULT_FRONTEND_ORIGINS: readonly string[] = [DEFAULT_FRONTEND_ORIGIN, 'http://127.0.0.1:5173'];
/** 전역 요청 본문 크기 제한(바이트). */
export const GLOBAL_BODY_LIMIT = 16 * 1024;

/** FRONTEND_ORIGIN(쉼표 구분)을 검증된 origin 목록으로 변환한다. '*'와 잘못된 값은 오류. */
export function parseOrigins(raw: string | undefined): string[] {
  const value = raw && raw.trim() !== '' ? raw : DEFAULT_FRONTEND_ORIGINS.join(',');
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

export type ShowtimeProviderName = 'sample' | 'real';
export type RouteProviderName = 'mock';

/** 네이버 API 설정. 키는 서버에서만 쓰고 응답·로그에 담지 않는다. 값이 없으면 undefined. */
export interface NaverConfig {
  /** 네이버 검색(지역) API 주소 */
  searchLocalUrl: string;
  searchClientId?: string;
  searchClientSecret?: string;
  /** NCP Maps Geocoding API 주소 */
  geocodeUrl: string;
  mapsApiKeyId?: string;
  mapsApiKey?: string;
}

export const DEFAULT_NAVER_SEARCH_LOCAL_URL = 'https://openapi.naver.com/v1/search/local.json';
export const DEFAULT_NCP_GEOCODE_URL = 'https://maps.apigw.ntruss.com/map-geocode/v2/geocode';

export interface AppConfig {
  host: string;
  port: number;
  frontendOrigins: string[];
  showtimeProvider: ShowtimeProviderName;
  routeProvider: RouteProviderName;
  naver: NaverConfig;
  /** showtimeProvider가 'real'일 때만 있음 */
  realData?: RealDataConfig;
}

const opt = (v: string | undefined): string | undefined => (v && v.trim() !== '' ? v.trim() : undefined);

function httpsUrl(name: string, v: string | undefined, fallback: string): string {
  const value = opt(v) ?? fallback;
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    throw new Error(`${name} 값이 올바른 URL이 아닙니다.`);
  }
  if (u.protocol !== 'https:') throw new Error(`${name}은 https만 허용합니다.`);
  return u.toString();
}

export function loadNaverConfig(env: NodeJS.ProcessEnv = process.env): NaverConfig {
  return {
    searchLocalUrl: httpsUrl('NAVER_SEARCH_LOCAL_URL', env.NAVER_SEARCH_LOCAL_URL, DEFAULT_NAVER_SEARCH_LOCAL_URL),
    searchClientId: opt(env.NAVER_SEARCH_CLIENT_ID),
    searchClientSecret: opt(env.NAVER_SEARCH_CLIENT_SECRET),
    geocodeUrl: httpsUrl('NCP_GEOCODE_URL', env.NCP_GEOCODE_URL, DEFAULT_NCP_GEOCODE_URL),
    mapsApiKeyId: opt(env.NCP_MAPS_API_KEY_ID),
    mapsApiKey: opt(env.NCP_MAPS_API_KEY),
  };
}

export const DEFAULT_TMDB_API_URL = 'https://api.themoviedb.org/3';
export const DEFAULT_TMDB_IMAGE_URL = 'https://image.tmdb.org/t/p/w342';
/** backend/ 기준 상대 경로 */
export const DEFAULT_CINEMA_CSV_PATH = 'data/cinemas.csv';

/** SHOWTIME_PROVIDER=real 설정. 키 값은 응답·로그에 담지 않는다. */
export interface RealDataConfig {
  tmdb: { apiUrl: string; imageUrl: string; apiKey: string };
  /** 영화관 CSV 경로(절대 경로 또는 backend/ 기준 상대 경로) */
  cinemaCsvPath: string;
}

export function loadRealDataConfig(env: NodeJS.ProcessEnv = process.env): RealDataConfig {
  const apiKey = opt(env.TMDB_API_KEY);
  if (!apiKey) throw new Error('SHOWTIME_PROVIDER=real에는 TMDB_API_KEY가 필요합니다 (backend/.env).');
  return {
    tmdb: {
      apiUrl: httpsUrl('TMDB_API_URL', env.TMDB_API_URL, DEFAULT_TMDB_API_URL),
      imageUrl: httpsUrl('TMDB_IMAGE_URL', env.TMDB_IMAGE_URL, DEFAULT_TMDB_IMAGE_URL),
      apiKey,
    },
    cinemaCsvPath: opt(env.CINEMA_CSV_PATH) ?? DEFAULT_CINEMA_CSV_PATH,
  };
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const showtimeProvider = (env.SHOWTIME_PROVIDER?.trim() || 'sample') as string;
  const routeProvider = (env.ROUTE_PROVIDER?.trim() || 'mock') as string;
  // 값은 오류에 넣지 않는다. 키를 잘못된 줄에 넣었을 때 콘솔에 키가 찍히는 것을 막는다.
  if (showtimeProvider !== 'sample' && showtimeProvider !== 'real') {
    throw new Error('SHOWTIME_PROVIDER 값이 올바르지 않습니다 (사용 가능: sample, real). backend/.env를 확인하세요.');
  }
  if (routeProvider !== 'mock') {
    throw new Error('ROUTE_PROVIDER 값이 올바르지 않습니다 (사용 가능: mock). backend/.env를 확인하세요.');
  }
  const port = Number(env.PORT ?? 3001);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT가 올바르지 않습니다.');
  return {
    host: env.HOST?.trim() || '127.0.0.1',
    port,
    frontendOrigins: parseOrigins(env.FRONTEND_ORIGIN),
    showtimeProvider,
    routeProvider,
    naver: loadNaverConfig(env),
    ...(showtimeProvider === 'real' ? { realData: loadRealDataConfig(env) } : {}),
  };
}

export function createShowtimeProvider(_name: ShowtimeProviderName, now?: () => Date): ShowtimeProvider {
  return new SampleShowtimeProvider(now ? { now } : {});
}

export function createRouteProvider(_name: RouteProviderName): RouteProvider {
  return new MockRouteProvider();
}
