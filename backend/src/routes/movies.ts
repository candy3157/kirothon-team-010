import type { FastifyInstance } from 'fastify';
import { todayInSeoul, type ShowtimeProvider } from '../data/provider.js';
import { sendError } from '../errors.js';
import { checkAvailability } from '../services/availability.js';
import type { ErrorDetail, MovieListResponse } from '../types.js';

export interface MovieRouteDeps {
  provider: ShowtimeProvider;
  now?: () => Date;
}

const MOVIE_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const QUERY_MAX = 100;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

function isRealDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function registerMovieRoutes(app: FastifyInstance, deps: MovieRouteDeps): void {
  const now = deps.now ?? (() => new Date());

  app.get('/api/movies', async (req, reply) => {
    const raw = (req.query as Record<string, unknown>).query;
    let query: string | undefined;
    if (raw !== undefined) {
      const details: ErrorDetail[] = [];
      if (typeof raw !== 'string') {
        details.push({ field: 'query', issue: '검색어는 한 번만, 문자열로 보내야 합니다.' });
      } else {
        const trimmed = raw.trim();
        if (trimmed.length < 1) details.push({ field: 'query', issue: '검색어는 1자 이상이어야 합니다.' });
        else if (trimmed.length > QUERY_MAX)
          details.push({ field: 'query', issue: `검색어는 ${QUERY_MAX}자 이하여야 합니다.` });
        else if (CONTROL_CHARS.test(trimmed))
          details.push({ field: 'query', issue: '검색어에 제어 문자를 쓸 수 없습니다.' });
        else query = trimmed;
      }
      if (details.length > 0) {
        return sendError(reply, req, 400, 'invalid_request', '요청 형식이 올바르지 않습니다.', details);
      }
    }

    let result;
    try {
      result = await deps.provider.searchMovies(query);
    } catch {
      return sendError(reply, req, 502, 'upstream_unavailable', '외부 데이터 공급자에 연결할 수 없습니다.');
    }
    if (result.status === 'unavailable') {
      return sendError(reply, req, 502, 'upstream_unavailable', '외부 데이터 공급자에 연결할 수 없습니다.');
    }

    // query가 없으면 오늘 상영 중인 영화만, 있으면 제목 일치 영화(상영 여부는 isShowingToday로 표시).
    const movies = query === undefined ? result.movies.filter((m) => m.isShowingToday) : result.movies;
    const body: MovieListResponse = {
      movies,
      source: result.source,
      lastUpdatedAt: result.lastUpdatedAt,
    };
    return reply.status(200).send(body);
  });

  app.get('/api/movies/:movieId/availability', async (req, reply) => {
    const { movieId } = req.params as { movieId: string };
    const rawDate = (req.query as Record<string, unknown>).date;
    const details: ErrorDetail[] = [];

    if (!MOVIE_ID_RE.test(movieId)) {
      details.push({ field: 'movieId', issue: '영화 ID 형식이 올바르지 않습니다.' });
    }
    let requestedDate: string | undefined;
    if (rawDate !== undefined) {
      if (typeof rawDate !== 'string' || !isRealDate(rawDate)) {
        details.push({ field: 'date', issue: 'date는 YYYY-MM-DD 형식의 실제 날짜여야 합니다.' });
      } else {
        requestedDate = rawDate;
      }
    }
    if (details.length > 0) {
      return sendError(reply, req, 400, 'invalid_request', '요청 형식이 올바르지 않습니다.', details);
    }

    const at = now();
    if (requestedDate !== undefined && requestedDate !== todayInSeoul(at)) {
      return sendError(reply, req, 400, 'unsupported_date', '현재는 오늘 영업일만 조회할 수 있습니다.');
    }

    const { movieFound, availability } = await checkAvailability(deps.provider, movieId, at);
    if (!movieFound) {
      return sendError(reply, req, 404, 'movie_not_found', '영화를 찾을 수 없습니다.');
    }
    return reply.status(200).send(availability);
  });
}
