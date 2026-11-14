import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { sendError } from '../errors.js';
import { MAX_BUFFER_MINUTES, MIN_BUFFER_MINUTES } from '../policy.js';
import { recommend, RecommendError, resort, type RecommendDeps } from '../services/recommend.js';
import type { Coordinates, ErrorDetail, RecommendationRequest, SortBy, TransportMode } from '../types.js';
import { SORT_BYS, TRANSPORT_MODES } from '../types.js';

export interface RateLimitOptions {
  /** 창당 최대 요청 수 */
  max: number;
  /** 창 길이(ms) */
  timeWindowMs: number;
}

export interface RecommendationRouteDeps extends RecommendDeps {
  /** POST(경로 조회 비용이 큼)용 제한. */
  postLimit?: RateLimitOptions;
  /** GET(저장 결과 재정렬)용 제한. */
  getLimit?: RateLimitOptions;
}

export const DEFAULT_POST_LIMIT: RateLimitOptions = { max: 20, timeWindowMs: 60_000 };
export const DEFAULT_GET_LIMIT: RateLimitOptions = { max: 120, timeWindowMs: 60_000 };

/** POST 본문 상한(바이트). 정상 요청은 수백 바이트다. */
export const POST_BODY_LIMIT = 4096;

const MOVIE_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const RESULT_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const OFFSET_ISO_RE = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/;

const REQUEST_KEYS = new Set(['movieId', 'origin', 'transportMode', 'departureTime', 'sortBy', 'bufferMinutes']);
const ORIGIN_KEYS = new Set(['latitude', 'longitude']);

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function isRealDate(s: string): boolean {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function isSortBy(v: unknown): v is SortBy {
  return typeof v === 'string' && (SORT_BYS as readonly string[]).includes(v);
}

function isTransportMode(v: unknown): v is TransportMode {
  return typeof v === 'string' && (TRANSPORT_MODES as readonly string[]).includes(v);
}

function validateDepartureTime(v: unknown, details: ErrorDetail[]): string | undefined {
  const issue = '오프셋(Z 또는 +09:00)을 포함한 ISO 8601 시각이어야 합니다.';
  if (typeof v !== 'string' || v.length > 40) {
    details.push({ field: 'departureTime', issue });
    return undefined;
  }
  const m = OFFSET_ISO_RE.exec(v);
  if (!m || !isRealDate(m[1] as string)) {
    details.push({ field: 'departureTime', issue });
    return undefined;
  }
  const hh = Number(m[2]);
  const mm = Number(m[3]);
  const ss = m[4] === undefined ? 0 : Number(m[4]);
  if (hh > 23 || mm > 59 || ss > 59 || Number.isNaN(Date.parse(v))) {
    details.push({ field: 'departureTime', issue });
    return undefined;
  }
  return v;
}

function validateOrigin(v: unknown, details: ErrorDetail[]): Coordinates | undefined {
  if (!isPlainObject(v)) {
    details.push({ field: 'origin', issue: 'origin은 latitude, longitude를 가진 객체여야 합니다.' });
    return undefined;
  }
  for (const k of Object.keys(v)) {
    if (!ORIGIN_KEYS.has(k)) details.push({ field: `origin.${k}`, issue: '정의되지 않은 필드입니다.' });
  }
  const lat = v.latitude;
  const lon = v.longitude;
  let ok = true;
  if (typeof lat !== 'number' || !Number.isFinite(lat)) {
    details.push({ field: 'origin.latitude', issue: '위도는 숫자여야 합니다.' });
    ok = false;
  } else if (lat < -90 || lat > 90) {
    details.push({ field: 'origin.latitude', issue: '위도는 -90 이상 90 이하여야 합니다.' });
    ok = false;
  }
  if (typeof lon !== 'number' || !Number.isFinite(lon)) {
    details.push({ field: 'origin.longitude', issue: '경도는 숫자여야 합니다.' });
    ok = false;
  } else if (lon < -180 || lon > 180) {
    details.push({ field: 'origin.longitude', issue: '경도는 -180 이상 180 이하여야 합니다.' });
    ok = false;
  }
  if (!ok || Object.keys(v).some((k) => !ORIGIN_KEYS.has(k))) return undefined;
  return { latitude: lat as number, longitude: lon as number };
}

/** 요청 본문 검증. 오류가 있으면 details를 돌려준다. 값은 details에 담지 않는다(좌표 노출 방지). */
export function parseRecommendationRequest(
  body: unknown,
): { ok: true; value: RecommendationRequest } | { ok: false; details: ErrorDetail[] } {
  const details: ErrorDetail[] = [];
  if (!isPlainObject(body)) {
    return { ok: false, details: [{ field: 'body', issue: '요청 본문은 JSON 객체여야 합니다.' }] };
  }
  for (const k of Object.keys(body)) {
    if (!REQUEST_KEYS.has(k)) details.push({ field: k, issue: '정의되지 않은 필드입니다.' });
  }

  const movieId = body.movieId;
  if (typeof movieId !== 'string' || !MOVIE_ID_RE.test(movieId)) {
    details.push({ field: 'movieId', issue: '영화 ID 형식이 올바르지 않습니다.' });
  }
  const origin = validateOrigin(body.origin, details);
  if (!isTransportMode(body.transportMode)) {
    details.push({ field: 'transportMode', issue: 'transportMode는 car, transit, walk 중 하나여야 합니다.' });
  }
  const departureTime =
    body.departureTime === undefined ? undefined : validateDepartureTime(body.departureTime, details);
  if (body.sortBy !== undefined && !isSortBy(body.sortBy)) {
    details.push({ field: 'sortBy', issue: 'sortBy는 balanced, travel, earliest 중 하나여야 합니다.' });
  }
  const buffer = body.bufferMinutes;
  if (
    buffer !== undefined &&
    (typeof buffer !== 'number' || !Number.isInteger(buffer) || buffer < MIN_BUFFER_MINUTES || buffer > MAX_BUFFER_MINUTES)
  ) {
    details.push({
      field: 'bufferMinutes',
      issue: `bufferMinutes는 ${MIN_BUFFER_MINUTES} 이상 ${MAX_BUFFER_MINUTES} 이하의 정수여야 합니다.`,
    });
  }

  if (details.length > 0 || !origin) return { ok: false, details };
  return {
    ok: true,
    value: {
      movieId: movieId as string,
      origin,
      transportMode: body.transportMode as TransportMode,
      ...(departureTime !== undefined ? { departureTime } : {}),
      ...(body.sortBy !== undefined ? { sortBy: body.sortBy as SortBy } : {}),
      ...(buffer !== undefined ? { bufferMinutes: buffer as number } : {}),
    },
  };
}

function handleServiceError(err: unknown, req: FastifyRequest, reply: FastifyReply): FastifyReply {
  if (err instanceof RecommendError) {
    return sendError(reply, req, err.status, err.code, err.message, err.details);
  }
  // 내부 정보(스택·메시지)는 응답에 담지 않는다. 요청 본문(출발 좌표)도 로그에 남기지 않는다.
  req.log.error({ errName: err instanceof Error ? err.name : 'unknown' }, 'recommendation failed');
  return sendError(reply, req, 500, 'internal_error', '서버 내부 오류가 발생했습니다.');
}

export function registerRecommendationRoutes(app: FastifyInstance, deps: RecommendationRouteDeps): void {
  const post = deps.postLimit ?? DEFAULT_POST_LIMIT;
  const get = deps.getLimit ?? DEFAULT_GET_LIMIT;

  app.post(
    '/api/recommendations',
    {
      bodyLimit: POST_BODY_LIMIT,
      config: { rateLimit: { max: post.max, timeWindow: post.timeWindowMs } },
    },
    async (req, reply) => {
      const parsed = parseRecommendationRequest(req.body);
      if (!parsed.ok) {
        return sendError(reply, req, 400, 'invalid_request', '요청 형식이 올바르지 않습니다.', parsed.details);
      }
      try {
        const result = await recommend(deps, parsed.value);
        return reply.status(200).send(result);
      } catch (err) {
        return handleServiceError(err, req, reply);
      }
    },
  );

  app.get(
    '/api/recommendations/:resultId',
    { config: { rateLimit: { max: get.max, timeWindow: get.timeWindowMs } } },
    async (req, reply) => {
      const { resultId } = req.params as { resultId: string };
      const rawSort = (req.query as Record<string, unknown>).sortBy;
      const details: ErrorDetail[] = [];
      if (!RESULT_ID_RE.test(resultId)) details.push({ field: 'resultId', issue: '결과 ID 형식이 올바르지 않습니다.' });
      if (rawSort !== undefined && !isSortBy(rawSort)) {
        details.push({ field: 'sortBy', issue: 'sortBy는 balanced, travel, earliest 중 하나여야 합니다.' });
      }
      if (details.length > 0) {
        return sendError(reply, req, 400, 'invalid_request', '요청 형식이 올바르지 않습니다.', details);
      }
      try {
        // sortBy를 생략하면 결과를 만든 요청의 정렬을 쓴다. 경로·시간표 공급자는 호출하지 않는다.
        return reply.status(200).send(resort(deps, resultId, rawSort as SortBy | undefined));
      } catch (err) {
        return handleServiceError(err, req, reply);
      }
    },
  );
}
