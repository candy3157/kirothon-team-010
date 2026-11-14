import type {
  ErrorResponse,
  MovieListResponse,
  RecommendationRequest,
  RecommendationResult,
  SortBy,
} from './types';

const BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');

/** API 오류. code는 서버 오류 코드 또는 'network'(서버에 닿지 못함). */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (init.body) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(BASE + path, { ...init, headers: { ...headers, ...(init.headers as object) } });
  } catch {
    throw new ApiError(0, 'network', '서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.');
  }

  if (!res.ok) {
    let body: Partial<ErrorResponse> | undefined;
    try {
      body = await res.json();
    } catch {
      /* 본문 없음 */
    }
    throw new ApiError(res.status, body?.code ?? 'unknown', body?.message ?? '요청을 처리하지 못했어요.');
  }
  return (await res.json()) as T;
}

export const api = {
  searchMovies(query?: string, signal?: AbortSignal) {
    const q = query?.trim();
    return request<MovieListResponse>(`/api/movies${q ? `?query=${encodeURIComponent(q)}` : ''}`, { signal });
  },
  createRecommendation(body: RecommendationRequest, signal?: AbortSignal) {
    return request<RecommendationResult>('/api/recommendations', {
      method: 'POST',
      body: JSON.stringify(body),
      signal,
    });
  },
  getRecommendation(resultId: string, sortBy?: SortBy) {
    const q = sortBy ? `?sortBy=${sortBy}` : '';
    return request<RecommendationResult>(`/api/recommendations/${encodeURIComponent(resultId)}${q}`);
  },
};
