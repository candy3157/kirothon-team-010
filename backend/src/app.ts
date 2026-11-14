import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import {
  DEFAULT_FRONTEND_ORIGINS,
  GLOBAL_BODY_LIMIT,
  createRouteProvider,
  createShowtimeProvider,
  loadNaverConfig,
} from './config.js';
import type { ShowtimeProvider } from './data/provider.js';
import { sendError } from './errors.js';
import { NaverPlaceProvider, type PlaceSearchProvider } from './places/provider.js';
import { registerMovieRoutes } from './routes/movies.js';
import { registerPlaceRoutes } from './routes/places.js';
import { registerRecommendationRoutes, type RateLimitOptions } from './routes/recommendations.js';
import type { RouteProvider } from './routing/provider.js';
import { ResultStore } from './services/resultStore.js';

export interface AppDeps {
  provider?: ShowtimeProvider;
  now?: () => Date;
  routes?: RouteProvider;
  store?: ResultStore;
  postLimit?: RateLimitOptions;
  getLimit?: RateLimitOptions;
  /** 출발지 장소 검색. 생략하면 키 없는 네이버 제공자(검색 시 503). */
  places?: PlaceSearchProvider;
  placesLimit?: RateLimitOptions;
  /** CORS 허용 origin 목록. 생략하면 개발 기본값. 와일드카드 금지. */
  frontendOrigins?: string[];
}

export function buildApp(opts: FastifyServerOptions = {}, deps: AppDeps = {}): FastifyInstance {
  const app = Fastify({ bodyLimit: GLOBAL_BODY_LIMIT, ...opts });
  const now = deps.now ?? (() => new Date());
  const provider = deps.provider ?? createShowtimeProvider('sample', now);

  const origins = deps.frontendOrigins ?? [...DEFAULT_FRONTEND_ORIGINS];
  if (origins.some((o) => o === '*' || o.includes('*'))) throw new Error('CORS 와일드카드 origin은 허용되지 않습니다.');
  app.register(helmet);
  app.register(cors, {
    origin: origins,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    maxAge: 600,
  });

  app.get('/api/health', async () => ({ status: 'ok', time: now().toISOString() }));

  registerMovieRoutes(app, { provider, now });

  // 요청 제한은 라우트별 config.rateLimit이 있는 경로에만 적용한다.
  // 플러그인이 라우트보다 먼저 로드되도록 캡슐화된 스코프 안에서 등록한다.
  app.register(async (scope) => {
    await scope.register(rateLimit, { global: false });
    registerRecommendationRoutes(scope, {
      showtimes: provider,
      routes: deps.routes ?? createRouteProvider('mock'),
      store: deps.store ?? new ResultStore({ now }),
      now,
      ...(deps.postLimit ? { postLimit: deps.postLimit } : {}),
      ...(deps.getLimit ? { getLimit: deps.getLimit } : {}),
    });
    registerPlaceRoutes(scope, {
      places: deps.places ?? new NaverPlaceProvider(loadNaverConfig({})),
      ...(deps.placesLimit ? { limit: deps.placesLimit } : {}),
    });
  });
  app.setNotFoundHandler((req, reply) =>
    sendError(reply, req, 404, 'invalid_request', '요청한 경로를 찾을 수 없습니다.'),
  );
  app.setErrorHandler((err, req, reply) => {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 429) return sendError(reply, req, 429, 'rate_limited', '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.');
    if (status === 413) return sendError(reply, req, 413, 'payload_too_large', '요청 본문이 너무 큽니다.');
    if (status && status >= 400 && status < 500) {
      return sendError(reply, req, 400, 'invalid_request', '요청 형식이 올바르지 않습니다.');
    }
    req.log.error({ err }, 'unhandled error');
    return sendError(reply, req, 500, 'internal_error', '서버 내부 오류가 발생했습니다.');
  });

  return app;
}
