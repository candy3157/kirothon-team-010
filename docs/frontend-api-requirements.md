# 프론트엔드 API 요구사항 확인

작성: 2026-11-14 / 기준 문서: 요구사항 명세서 v1.2 (`C:\Users\tkwk9\.kiro\crew\workspace\cinema_recommendation_requirements_v1.2.md`)

## 1. 프론트 제공 여부

**미제공.** 작업 폴더(`plan_plan_1794630611880648100`)에 프론트 코드·문서가 없고, 계획에도 경로가 주어지지 않았다. 읽기 전용으로 확인할 대상이 없었으므로 프론트 파일·의존성은 건드리지 않았다.

따라서 아래 항목은 모두 **명세서 v1.2 기준 가정**이다. 프론트가 제공되면 20번 작업에서 실제 코드와 대조한다.

| 항목 | 프론트 실제 값 | 이 문서의 기준값 |
|---|---|---|
| API 호출 지점 | 미제공 | 아래 2절 |
| 기대 엔드포인트 | 미제공 | 명세서 5절 |
| 요청 파라미터 | 미제공 | 명세서 5.1, 5.2 |
| 응답 필드 | 미제공 | 명세서 5.1, 5.3 |
| 오류 처리 방식 | 미제공 | 명세서 8절, 3절 FR-25 (오류 본문 형식은 명세 없음, 2번 작업에서 정의) |
| 개발 서버 origin·포트 | 미제공 | `http://localhost:5173` (Vite 기본값, 가정). `FRONTEND_ORIGIN` 환경변수로 변경 |

## 2. 기준 엔드포인트 (명세서 기반)

| 용도 | 메서드·경로 | 요청 | 근거 |
|---|---|---|---|
| 상태 확인 | `GET /api/health` | 없음 | 계획 3번 |
| 영화 검색·목록 | `GET /api/movies?query=` | `query` 선택 | FR-01 |
| 상영 여부 | `GET /api/movies/{movieId}/availability?date=` | `date`는 오늘만, 생략 시 오늘 | FR-03, 5.1 |
| 추천 계산 | `POST /api/recommendations` | `movieId`, `origin{latitude,longitude}`, `transportMode`, `departureTime`, `sortBy` | 5.2 |
| 정렬 변경 | `GET /api/recommendations/{resultId}?sortBy=` | `sortBy` | FR-26, AT-17 |

- `transportMode`: `car | transit | walk`
- `sortBy`: `balanced | travel | earliest`
- `departureTime`: 타임존 포함 ISO 8601 (`+09:00`)
- 요청에 `radiusKm`, `maxDistanceKm`, `nearbyOnly`, `bufferMinutes` 없음.

## 3. 기대 응답 필드

**상영 여부** (5.1): `movieId`, `date`, `status`(`showing|not_showing|unknown`), `cinemaCount`, `showtimeCount`, `coverage`, `lastUpdatedAt`.

**추천 결과** (5.3):
- 영화관 항목 배열: 영화관 ID·이름·주소·좌표, 순위, 이동수단, 이동시간(분), 도착예정시각, 경로 조회 상태, 길찾기 정보, 대표 회차 ID, 관람 가능 회차 수.
- 회차 항목(영화관 안): 회차 ID, 시작시각, 대기시간, 여유시간, 판정(`도착 가능|도착 불가`), 예매 링크(있을 때).
- 경로 미확인 영화관: 별도 배열.
- 메타: `requestedAt`, `sortBy`, `coverage`, `partialFailure`, `notices`, 데이터 출처·갱신시각.

## 4. 오류·빈 결과 처리 (프론트가 구분해야 하는 상태)

| 상태 | 근거 |
|---|---|
| 미상영 (경로 호출 없음) | AT-03 |
| 상영 여부 확인 불가 (미상영으로 단정 금지) | AT-04 |
| 상영 중이나 도착 가능 회차 없음 | AT-09, FR-25 |
| 경로 미확인 (별도 영역) | AT-11, FR-17 |
| 도착 불가 (하한 판정, 경로 미확인과 구분) | AT-18 |
| 부분 데이터·지원 범위 | AT-13 |
| 날짜 변경 시도 거부 | AT-20 |

## 5. 명세서 FR·AT와의 차이·공백

프론트가 없어 "프론트와 명세의 차이"는 없다. 대신 명세에 **정해지지 않은 부분**을 정리한다. 2번 작업(OpenAPI)에서 정한다.

| # | 공백 | 관련 항목 | 제안 |
|---|---|---|---|
| 1 | HTTP 오류 본문 형식·오류 코드 | 명세 5.3 끝 | 공통 `{error:{code,message}}` 정의 |
| 2 | 추천 결과 보관과 `resultId`, 만료 | FR-26, AT-17 | POST 응답에 `resultId` 포함. 만료 시 404/410 |
| 3 | 영화 목록 응답 필드 | FR-01 | `movieId`, `title`, 상영 여부 요약 최소 필드 |
| 4 | POST에 `sortBy` 포함, GET으로 재정렬 | 5.2, FR-26 | 둘 다 지원 |
| 5 | 다른 날짜·과거 출발시각 오류 | FR-06, AT-20 | 400, 오류 코드로 구분 |
| 6 | 주소→좌표 변환 | AT-05, 5.2 | 백엔드 범위 밖. 프론트가 좌표만 전달 |
| 7 | 샘플 데이터 표시 | 6절 | 응답에 `source:'sample'` |
| 8 | CORS·dev origin | NFR-05 | 허용 목록 기반, 와일드카드 금지 |
| 9 | 미정 정책값(최대 대기시간, 노후화 기준, 속도 상한) | 12절 | 서버 정책 상수로 두고 변경 가능하게 |

## 6. 다음 단계

- 2번: 위 기준값으로 `docs/openapi.yaml` 작성.
- 20번: 프론트 제공 시 이 문서의 1절 표를 실제 값으로 갱신하고 불일치는 백엔드 쪽만 수정.
