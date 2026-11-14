# 영화관 추천 백엔드

영화를 먼저 고르고, 출발지·이동수단·출발시각으로 상영 시작 전에 도착 가능한 영화관과 회차를 추천하는 API다.
Node 22 + TypeScript + Fastify + Vitest.

- API 명세: `../docs/openapi.yaml`
- 프론트 연동: `../docs/integration-guide.md`
- 호출 예제: `../docs/examples/requests.http`

현재는 **샘플 상영시간표(`source: sample`)와 mock 경로 제공자**로 동작한다. 실제 상영 정보가 아니다.

## 실행

```powershell
cd backend
npm install
Copy-Item .env.example .env   # 필요하면 수정. 서버가 .env를 자동으로 읽지는 않는다. 아래 참고
$env:PORT = "3001"
npm run dev                   # 개발 서버(tsx watch)
```

| 명령 | 내용 |
|---|---|
| `npm run dev` | 개발 서버. 파일 변경 시 재시작 |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | 단위·통합·계약 테스트(`vitest run`) |
| `npm run build` | `dist/`로 빌드 |
| `npm start` | 빌드 결과 실행(`node dist/server.js`) |

서버는 `.env` 파일을 읽지 않는다. 값은 셸 환경변수로 넣는다(`$env:NAME = "값"`). `.env.example`은 변수 목록을 보여 주는 용도다.

## 환경변수

| 이름 | 기본값 | 설명 |
|---|---|---|
| `HOST` | `127.0.0.1` | 바인딩 주소. 기본값을 바꾸지 않는다. 외부에 열지 않는다. |
| `PORT` | `3000` | 포트. OpenAPI와 연동 가이드는 `3001`을 쓴다. |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | CORS 허용 origin. 쉼표로 여러 개. 와일드카드는 시작 시 오류. |
| `SHOWTIME_PROVIDER` | `sample` | 상영시간표 공급자. 지금은 `sample`만 가능. |
| `ROUTE_PROVIDER` | `mock` | 경로 공급자. 지금은 `mock`만 가능. |
| `ROUTE_API_KEY` | 없음 | 실제 경로 API 키. **서버 전용 비밀값.** 응답·로그·프론트 번들에 넣지 않는다. 저장소에 커밋하지 않는다(`.gitignore`가 `.env`를 제외한다). |

지원하지 않는 `SHOWTIME_PROVIDER`, `ROUTE_PROVIDER` 값은 시작할 때 오류가 난다.

## 정책값

값은 `src/policy.ts`에 있다. 요청에서 받지 않는다. 응답 `meta.policy`에는 `bufferMinutes`, `waitWeight`만 나간다.

| 이름 | 값 | 의미 |
|---|---|---|
| `BUFFER_MINUTES` | 10 | 도착 후 입장 준비시간(분) |
| `WAIT_WEIGHT` | 0.35 | `balanced` 정렬 = 이동분 + 0.35 x 대기분 |
| `RESULT_TTL_SECONDS` | 1800 | 추천 결과 보관 시간(30분). 이후 `404 result_expired` |
| `MAX_SPEED_KMH.car` | 150 (TBD) | 도착 불가 하한 판정용 최고속도 상한 |
| `MAX_SPEED_KMH.transit` | 350 (TBD) | 같음 |
| `MAX_SPEED_KMH.walk` | 10 (TBD) | 같음 |

TBD 항목:

- **이동수단별 최고속도 상한.** 협의 전의 보수적 기본값이다. 실제보다 빠르게 잡아 잘못된 `도착 불가`를 막는다. 값이 낮아지면 더 많은 영화관이 경로 조회 없이 `도착 불가`가 된다. 확정하면 `policy.ts`만 고친다. 고정 km 반경 컷오프는 쓰지 않는다.
- **최대 대기시간, 상영시간표 노후화 기준.** 아직 코드에 없다. 확정되면 `policy.ts`에 추가하고 `ranking.ts`, `recommend.ts`에 반영한다.

요청 제한(기본): 추천 `POST` 분당 20회, 재정렬 `GET` 분당 120회(`src/routes/recommendations.ts`). 추천 `POST` 본문은 4KB 이하, 그 밖의 요청은 16KB 이하다.

## 구조

```
src/
  app.ts            buildApp() 팩토리 (테스트에서 inject()로 재사용)
  server.ts         listen
  config.ts         환경변수 읽기, 공급자 생성
  policy.ts         정책값
  time.ts           25:10 -> 다음 날 01:10 변환 등 시간 계산
  types.ts          API 타입
  data/             ShowtimeProvider 인터페이스와 샘플 구현
  routing/          RouteProvider 인터페이스와 mock 구현
  services/         상영 여부, 후보, 하한 판정, 관람 가능성, 정렬, 추천 오케스트레이션, 결과 보관
  routes/           HTTP 라우트(movies, recommendations)
test/               단위·통합 테스트, test/contract/ 계약 테스트
```

추천 흐름: 상영 여부 확인 -> (미상영·확인 불가면 종료) -> 후보 영화관 -> 직선거리 하한으로 도착 불가 분류 -> 나머지 영화관에 영화관당 1회 경로 조회 -> 회차 판정 -> 정렬·대표 회차 -> 결과 보관.

## 실제 공급자로 바꾸기

서비스 계층은 두 인터페이스에만 의존한다. 구현을 만들고 `src/config.ts`의 팩토리에 연결한다.

### 1. 상영시간표: `ShowtimeProvider` (`src/data/provider.ts`)

```ts
interface ShowtimeProvider {
  searchMovies(query?: string): Promise<MovieSearchResult>;
  getMovieShowtimes(movieId: string): Promise<MovieShowtimesResult>;
}
```

- 실패는 예외 대신 `status: 'unavailable'`로 알린다. 서비스는 이를 `unknown`으로 처리하고 `not_showing`으로 오판하지 않는다.
- 데이터가 정상이고 회차가 없을 때만 빈 `showtimes`와 `status: 'ok'`를 준다. 이것이 `not_showing`이다.
- `source`를 `'provider'`로, `coverage`, `lastUpdatedAt`을 실제 값으로 채운다. 일부 지점만 수집했으면 `coverage: 'partial'`.
- `showtimes[].businessTime`은 영업일 기준 문자열(`25:10` 가능). 시각 변환은 `time.ts`가 한다.
- 날짜는 오늘 영업일(`Asia/Seoul`)만 쓴다.

### 2. 경로: `RouteProvider` (`src/routing/provider.ts`)

```ts
interface RouteProvider {
  getTravelMinutes(query: RouteQuery): Promise<RouteResult>; // { ok: true, minutes } | { ok: false, reason }
}
```

- 실패 사유는 `route_failed`, `route_timeout`, `unsupported_area`. 서비스는 이 영화관을 `unroutableCinemas`로 분리한다.
- 호출은 영화관당 1회다. 회차마다 호출하지 않는다.
- 공급자 호출에는 타임아웃을 두고, 초과하면 `route_timeout`을 돌려준다.
- 키는 `readRouteApiKey()`로만 읽는다. 키와 키가 들어간 URL을 로그·오류 메시지·응답에 넣지 않는다.
- 외부 호출 오류는 잡아서 `{ ok: false, reason: 'route_failed' }`로 바꾼다. 상세 오류를 응답으로 올리지 않는다.

### 3. 연결

1. `src/data/`, `src/routing/`에 새 클래스를 추가한다.
2. `src/config.ts`에서 `ShowtimeProviderName`, `RouteProviderName` 유니온에 이름을 넣고, `loadConfig()`의 허용 값 검사와 `createShowtimeProvider()`, `createRouteProvider()`의 분기를 추가한다.
3. `SHOWTIME_PROVIDER`, `ROUTE_PROVIDER`, `ROUTE_API_KEY`를 셸 환경변수로 설정한다.
4. 새 구현에 대해 `test/provider.test.ts`, `test/routing.test.ts`와 같은 방식의 테스트를 추가하고 `npm test`를 통과시킨다.
5. `../docs/openapi.yaml`의 `DataSource`는 이미 `provider`를 포함한다. 응답 형태는 바꾸지 않는다.

주의: 현재 `server.ts`는 `buildApp({ logger: true }, { frontendOrigins })`만 넘기고, `config.ts`의 `createRouteProvider('mock')`를 `app.ts`가 직접 부른다. 실제 경로 공급자를 쓰려면 `app.ts`의 `deps.routes ?? createRouteProvider('mock')`가 `loadConfig()` 값을 따르도록 `server.ts`에서 `routes`, `provider`를 주입한다.

## 테스트

`npm test`는 시간 계산, 관람 가능성(AT-06, AT-07), 정렬 동점, 하한 판정(AT-18), 추천 서비스, 라우트 검증, CORS, 계약 테스트(`buildApp().inject()`와 `docs/openapi.yaml` 검증)를 실행한다. 네트워크를 쓰지 않는다.
