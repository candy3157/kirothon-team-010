# 프론트엔드 연동 가이드

대상: 영화 우선 탐색·이동시간 기반 영화관 추천 API (`docs/openapi.yaml` v1.0.0)
기준: 요구사항 명세서 v1.2. 프론트 코드·문서는 미제공이므로 이 가이드는 명세 기준이다.

## 1. 개발 서버 실행과 기본 주소

```powershell
cd backend
npm install
$env:PORT = "3001"          # OpenAPI servers 주소(127.0.0.1:3001)와 맞춘다
npm run dev                 # tsx watch, HOST=127.0.0.1에만 바인딩
```

- 코드 기본 포트는 `3000`이다. 이 문서와 `openapi.yaml`은 `3001`을 쓴다. `PORT`로 맞춘다.
- 서버는 `127.0.0.1`에만 바인딩한다. 외부 접속은 열려 있지 않다.
- 확인: `GET http://127.0.0.1:3001/api/health` -> `{"status":"ok","time":"..."}`.

## 2. CORS·origin

- 허용 origin은 `FRONTEND_ORIGIN`(쉼표 구분)이다. 기본값은 `http://localhost:5173`, `http://127.0.0.1:5173` 두 개다.
- `FRONTEND_ORIGIN`을 직접 지정하면 기본값을 대신한다. 두 주소를 모두 쓰려면 둘 다 적는다.

```powershell
$env:FRONTEND_ORIGIN = "http://localhost:5173,http://127.0.0.1:5173"
```

- 와일드카드(`*`)는 서버 시작 시 오류다.
- 허용 메서드는 `GET`, `POST`, `OPTIONS`. 허용 헤더는 `Content-Type`뿐이다. 쿠키·인증 헤더는 쓰지 않는다.
- 프론트는 `Authorization` 같은 커스텀 헤더를 보내지 않는다. 보내면 preflight가 실패한다.

## 3. 호출 순서

```
영화 선택  ->  상영 여부  ->  추천  ->  정렬 변경
GET /api/movies   GET /api/movies/{id}/availability   POST /api/recommendations   GET /api/recommendations/{resultId}?sortBy=
```

1. **영화 선택.** `GET /api/movies`(전체)나 `?query=제목`(검색). 검색어는 1~100자, 앞뒤 공백 제거. 결과가 없으면 `movies: []`.
2. **상영 여부.** `GET /api/movies/{movieId}/availability`. `date`는 생략하거나 오늘만 쓴다.
   - `showing`: 위치·이동수단 입력 단계로 간다.
   - `not_showing`, `unknown`: 위치 입력으로 넘어가지 않고 안내만 보여 준다.
3. **추천.** `POST /api/recommendations`. 본문은 `movieId`, `origin{latitude,longitude}`, `transportMode`, `departureTime`(선택), `sortBy`(선택).
   응답의 `meta.resultId`를 저장한다.
4. **정렬 변경.** `GET /api/recommendations/{resultId}?sortBy=travel`. 경로를 다시 조회하지 않는다. `POST`를 다시 보내지 않는다.
5. **이동수단·출발지·출발시각 변경.** 새 `POST`가 필요하다. 경로를 다시 계산한다.

주소 입력은 프론트가 좌표로 바꿔 보낸다. 백엔드는 주소 변환을 하지 않는다. 위치 권한을 거부한 경우도 같다.

요청에 `radiusKm`, `maxDistanceKm`, `nearbyOnly` 같은 필드를 넣지 않는다. 알 수 없는 필드는 `400 invalid_request`다.

## 4. 상태·결과별 화면 표시 권장

`POST`와 `GET` 모두 `200`이라도 `meta.outcome`을 먼저 본다.

| 상황 | 신호 | 화면 권장 |
|---|---|---|
| 추천 있음 | `meta.outcome = recommended`, `cinemas[]` 있음 | 지도와 목록. 마커와 목록 항목은 1:1. 각 영화관은 대표 회차와 `otherCount`(`14:40 외 1개`)를 보인다. |
| 미상영 | availability `not_showing`, 또는 `meta.outcome = not_showing` | "오늘 상영 중인 회차가 없습니다." 경로·지도 없음. 다른 영화 선택을 권한다. |
| 확인 불가 | availability `unknown`, 또는 `meta.outcome = availability_unknown` | "상영 정보를 확인하지 못했습니다." **미상영이라고 쓰지 않는다.** 다시 시도 버튼을 둔다. |
| 도착 가능 회차 없음 | `meta.outcome = no_feasible_showtime` | "지금 출발하면 도착할 수 있는 회차가 없습니다." 출발시각·이동수단 변경을 권한다. `unreachableCinemas`는 접힌 목록으로 보여 줄 수 있다. |
| 경로 미확인 | `unroutableCinemas[]` | 별도 영역에 "경로를 확인하지 못함"으로 표시. **도착 불가라고 쓰지 않는다.** 순위에 넣지 않는다. 회차 시각은 참고용으로만 보여 준다. |
| 도착 불가 | `unreachableCinemas[]` | "도착할 수 없음". `reason`이 `lower_bound`면 멀어서, `all_showtimes_missed`면 모든 회차에 늦는다는 뜻. 순위·지도 마커에 넣지 않는다. |
| 부분 결과 | `meta.partialFailure = true`, `meta.notices`, `meta.coverage = partial` | 결과 위에 안내 배너. "확인된 영화관 중에서의 추천이며 전체 최적이 아닐 수 있습니다." |
| 모든 경로 실패 | `meta.outcome = no_route_confirmed` | "경로를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요." |
| 샘플 데이터 | `meta.source = sample`, notice `sample_data` | "샘플 데이터" 표시를 항상 보인다. |

공통 안내:

- `도착 가능`은 이동시간 기준이다. 잔여 좌석·예매 가능을 뜻하지 않는다. 예매 링크(`bookingUrl`)가 있을 때만 "예매 사이트에서 확인" 형태로 보인다. notice `booking_not_guaranteed`가 오면 그대로 보인다.
- `startTime`은 실제 시각이다. 심야 회차는 `businessTime = "25:10"`이고 `startTime`은 다음 날 `01:10`이다. 목록에는 `businessTime`이나 "01:10 (익일)"처럼 보인다.
- `waitMinutes`, `spareMinutes`는 `null`일 수 있다(경로 미조회). `null`을 0으로 보이지 않는다.
- `lastUpdatedAt`과 `source`는 결과 화면 하단에 출처로 보인다.

## 5. 오류 응답

모든 오류 본문은 `{ code, message, requestId, details? }`이다. `message`는 사용자에게 보여도 된다. `details[]`는 `400`에서 필드별 사유를 준다.

| HTTP | code | 의미 | 프론트 처리 |
|---|---|---|---|
| 400 | `invalid_request` | 입력 형식 오류 | `details[].field`를 입력 칸에 표시 |
| 400 | `unsupported_date` | 오늘이 아닌 날짜 | 날짜 변경 불가 안내(MVP는 오늘만) |
| 400 | `departure_out_of_range` | 오늘 영업일(07:00 ~ 다음 날 06:59) 밖이거나 오늘 마지막 회차 이후 출발 | 출발시각 재입력 |
| 404 | `movie_not_found` | 알 수 없는 영화 | 영화 선택 화면으로 |
| 404 | `result_expired` | 결과 만료·없음 | 6절 참고 |
| 413 | `payload_too_large` | 본문이 큼 | 입력 확인 |
| 429 | `rate_limited` | 요청 제한 | `Retry-After`(초) 후 재시도. 추천 `POST`는 분당 20회, 재정렬 `GET`은 분당 120회가 기본이다. |
| 502 | `upstream_unavailable` | 공급자 장애로 응답 불가 | "잠시 후 다시 시도" |
| 503 | `service_unavailable` | 서버 일시 불가 | 같음 |
| 500 | `internal_error` | 서버 오류 | 같음. `requestId`를 문의용으로 보인다. |

`not_showing`, `unknown`은 오류가 아니다. `200`으로 온다.

## 6. resultId 만료 시

- 결과는 `meta.expiresAt`까지 보관한다(기본 30분).
- 만료 후 `GET /api/recommendations/{resultId}`는 `404 result_expired`다.
- 처리: 마지막 `POST` 요청 본문(`movieId`, `origin`, `transportMode`, `departureTime`, 바꾸려는 `sortBy`)을 프론트가 들고 있다가 `POST`를 다시 보낸다. 새 `resultId`로 교체한다.
- `departureTime`을 생략했다면 새 요청은 "지금"으로 계산된다. 사용자가 시각을 정했다면 그 값을 다시 보낸다. 지난 시각이면 새 시각으로 바꿀지 물어본다.
- `404`는 사용자 오류가 아니므로 오류 화면 대신 자동 재요청 후 로딩을 보인다.

## 7. 샘플 데이터 시나리오

`SHOWTIME_PROVIDER=sample`, `ROUTE_PROVIDER=mock`일 때의 고정 데이터다. 실제 상영 정보가 아니다. 경로 시간은 직선거리로 계산한 mock 값이다.

| movieId | 제목 | 상영 | 확인할 수 있는 상황 |
|---|---|---|---|
| `movie_001` | 샘플 영화 A | 강남(14:30, 14:40, 16:30), 잠실(15:00), 수원(15:30, 25:10) | 정상 추천, 한 영화관의 여러 회차(`otherCount`), 심야 25:10, 이동수단·정렬 변경. 14:00 출발·대중교통·준비 10분 기준 AT-06(14:40 도착 가능)·AT-07(14:30 제외) |
| `movie_002` | 샘플 영화 B | 모두 오전(09:00~12:00) | 오후 출발 시 `no_feasible_showtime` |
| `movie_003` | 샘플 영화 D | 회차 없음 | `not_showing`. 경로 호출 없음 |
| `movie_004` | 샘플 영화 C | 부산점(15:00, 15:30)만 | 서울 출발 시 직선거리 하한으로 `unreachableCinemas`(`lower_bound`). 이른 시간 출발이면 도착 가능 |

영화관: `cin_gangnam`, `cin_jamsil`, `cin_suwon`(서울에서 20km 이상), `cin_busan`(약 300km).

미리 만들어 둔 응답은 `docs/examples/`에 있다.

| 파일 | 상황 |
|---|---|
| `movies-search.json` | 영화 목록 |
| `availability-showing.json`, `availability-not-showing.json`, `availability-unknown.json` | 상영 여부 3종 |
| `recommendation-request.json` | 추천 요청 본문 |
| `recommendation-ok.json` | 정상 추천 |
| `recommendation-sorted-earliest.json` | 정렬 변경 결과 |
| `recommendation-partial-route-failure.json` | 일부 경로 실패 |
| `recommendation-no-feasible.json` | 도착 가능 회차 없음 |
| `recommendation-not-showing.json` | 미상영 |

`availability` 응답이 `unknown`인 경우는 샘플 서버에서 재현되지 않는다(공급자 실패 주입은 테스트 코드에서만 한다). 예제 파일로 화면을 확인한다.

## 8. 호출 예제

- 파일 형식: `docs/examples/requests.http` (VS Code REST Client, JetBrains HTTP Client)
- 아래는 같은 흐름의 `curl`과 `fetch`이다. `curl`은 PowerShell에서 `curl.exe`로 쓴다.

### curl

```bash
BASE=http://127.0.0.1:3001

curl "$BASE/api/health"
curl "$BASE/api/movies"
curl -G "$BASE/api/movies" --data-urlencode "query=샘플"
curl "$BASE/api/movies/movie_001/availability"

curl -X POST "$BASE/api/recommendations" \
  -H "Content-Type: application/json" \
  -d '{"movieId":"movie_001","origin":{"latitude":37.5,"longitude":127},"transportMode":"transit","sortBy":"balanced"}'

# 정렬만 변경 (경로 재조회 없음). RESULT_ID는 위 응답의 meta.resultId
curl "$BASE/api/recommendations/$RESULT_ID?sortBy=earliest"
```

PowerShell에서는 JSON 따옴표 처리가 다르므로 `docs/examples/recommendation-request.json`을 파일로 보낸다.

```powershell
curl.exe -X POST http://127.0.0.1:3001/api/recommendations -H "Content-Type: application/json" --data-binary "@docs/examples/recommendation-request.json"
```

예제 파일의 `departureTime`은 고정 날짜(2026-11-14)다. 오늘이 아니면 `400 departure_out_of_range`가 된다. 이때는 `departureTime`을 지우거나 오늘 시각으로 바꾼다.

### fetch (TypeScript)

```ts
const BASE = 'http://127.0.0.1:3001';

interface ApiError { code: string; message: string; requestId?: string; details?: { field: string; issue: string }[] }

class ApiRequestError extends Error {
  constructor(readonly status: number, readonly body: ApiError, readonly retryAfter?: number) {
    super(body.message);
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined, // 커스텀 헤더 금지
  });
  if (!res.ok) {
    const retry = res.headers.get('Retry-After');
    throw new ApiRequestError(res.status, (await res.json()) as ApiError, retry ? Number(retry) : undefined);
  }
  return (await res.json()) as T;
}

// 1) 영화 목록, 2) 상영 여부
const { movies } = await api<{ movies: { movieId: string; title: string }[] }>('/api/movies');
const availability = await api<{ status: 'showing' | 'not_showing' | 'unknown' }>(
  `/api/movies/${encodeURIComponent(movies[0].movieId)}/availability`,
);

// 3) 추천
const request = {
  movieId: movies[0].movieId,
  origin: { latitude: 37.5, longitude: 127 },
  transportMode: 'transit' as const,
  sortBy: 'balanced' as const,
};
let result = await api<any>('/api/recommendations', { method: 'POST', body: JSON.stringify(request) });

// 4) 정렬 변경. 만료되면 POST를 다시 보낸다.
async function resort(sortBy: 'balanced' | 'travel' | 'earliest') {
  try {
    result = await api(`/api/recommendations/${result.meta.resultId}?sortBy=${sortBy}`);
  } catch (e) {
    if (e instanceof ApiRequestError && e.body.code === 'result_expired') {
      result = await api('/api/recommendations', { method: 'POST', body: JSON.stringify({ ...request, sortBy }) });
    } else {
      throw e;
    }
  }
}
await resort('earliest');
```

`departureTime`은 `new Date().toISOString()`(`Z` 오프셋)이나 `+09:00` 형식 모두 받는다. 오프셋이 없으면 `400`이다.

## 9. 연동 체크리스트

- [ ] `FRONTEND_ORIGIN`에 프론트 origin이 들어 있다(`localhost`와 `127.0.0.1`을 구분).
- [ ] 요청 헤더는 `Content-Type`뿐이다.
- [ ] `meta.outcome`으로 분기한다(HTTP 200만 보고 성공 화면을 그리지 않는다).
- [ ] `unknown`을 미상영으로 표시하지 않는다.
- [ ] `unroutableCinemas`를 도착 불가로 표시하지 않는다.
- [ ] 정렬 변경은 `GET resultId`로 한다. `404 result_expired`는 `POST` 재요청으로 복구한다.
- [ ] 샘플 데이터 표시를 보인다.
