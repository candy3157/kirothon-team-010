import type { FastifyInstance } from 'fastify';
import { sendError } from '../errors.js';
import type { PlaceSearchProvider } from '../places/provider.js';
import type { ErrorDetail } from '../types.js';
import type { RateLimitOptions } from './recommendations.js';

export interface PlaceRouteDeps {
  places: PlaceSearchProvider;
  limit?: RateLimitOptions;
}

/** 외부 API 사용량을 지키기 위한 기본 제한 (IP당) */
export const DEFAULT_PLACES_LIMIT: RateLimitOptions = { max: 30, timeWindowMs: 60_000 };

const QUERY_MIN = 2;
const QUERY_MAX = 100;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

export function registerPlaceRoutes(app: FastifyInstance, deps: PlaceRouteDeps): void {
  const limit = deps.limit ?? DEFAULT_PLACES_LIMIT;

  app.get(
    '/api/places',
    { config: { rateLimit: { max: limit.max, timeWindow: limit.timeWindowMs } } },
    async (req, reply) => {
      const raw = (req.query as Record<string, unknown>).query;
      const details: ErrorDetail[] = [];
      let query = '';
      if (typeof raw !== 'string') {
        details.push({ field: 'query', issue: '검색어(query)는 한 번만, 문자열로 보내야 합니다.' });
      } else {
        query = raw.trim();
        if (query.length < QUERY_MIN) details.push({ field: 'query', issue: `검색어는 ${QUERY_MIN}자 이상이어야 합니다.` });
        else if (query.length > QUERY_MAX) details.push({ field: 'query', issue: `검색어는 ${QUERY_MAX}자 이하여야 합니다.` });
        else if (CONTROL_CHARS.test(query)) details.push({ field: 'query', issue: '검색어에 제어 문자를 쓸 수 없습니다.' });
      }
      if (details.length > 0) {
        return sendError(reply, req, 400, 'invalid_request', '요청 형식이 올바르지 않습니다.', details);
      }

      const result = await deps.places.search(query);
      if (result.status === 'not_configured') {
        return sendError(reply, req, 503, 'service_unavailable', '장소 검색이 설정되지 않았습니다.');
      }
      if (result.status === 'unavailable') {
        return sendError(reply, req, 502, 'upstream_unavailable', '장소 검색 서비스에 연결할 수 없습니다.');
      }
      return reply.status(200).send({ places: result.places });
    },
  );
}
