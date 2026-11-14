# 실제 영화·영화관·상영시간표 데이터 연동 명세

> 작성일: 2026-11-14 · 기준 명세: `.kiro/specs/cinema-recommendation/requirements.md` (v1.2)
> 이 문서는 Kiro Crew Task Runner 입력용이다.

## 0. 작업 환경 (반드시 지킬 것)

- **작업 폴더:** `C:\Users\tkwk9\workplace\kirothon-team-010` (git 레포). 모든 파일은 이 폴더 안에서 만들고 고친다. 다른 작업 폴더에 새 프로젝트를 만들지 않는다.
- **브랜치:** `feature/real-movie-data` (이미 최신 `origin/main`에서 만들어져 체크아웃됨). 다른 브랜치로 바꾸지 않는다. 로컬 `develop` 브랜치는 건드리지 않는다.
- **push:** 마지막 단계에서만 `git push origin feature/real-movie-data`. `main`에는 push하지 않는다.
- **비밀값:** `backend/.env`, `frontend/.env.local`을 읽거나, 출력하거나, 커밋하지 않는다. 새 변수는 `backend/.env.example`에 **빈 값**으로만 추가한다. 키는 요청 헤더나 쿼리에만 쓰고 응답·로그·오류 메시지에 담지 않는다.
- **외부 API 호출:** 테스트는 실제 네트워크를 쓰지 않는다. `fetch`를 주입받아 가짜 응답으로 검증한다 (`backend/src/places/provider.ts`, `backend/test/places.test.ts`의 방식을 따른다).
- **API 확인:** 각 외부 API의 주소·파라미터·응답 필드는 구현 전에 공식 문서로 확인하고, 확인한 문서 URL을 코드 주석과 `docs/data-sources.md`에 남긴다. 확인하지 못한 값은 추측하지 말고 "미확인"으로 적고 `.env`로 바꿀 수 있게 한다.

## 1. 목표

샘플 데이터(`backend/src/data/sample.ts`) 대신 실제 공개 데이터로 영화 목록과 영화관 목록을 채운다. 상영시간표는 공개 API가 없으므로 **교체 가능한 어댑터 구조**를 만들고, 합법적으로 받을 수 있는 데이터(제휴 피드 파일)를 읽는다. 키나 데이터가 없으면 지금처럼 샘플 데이터로 동작한다.

서비스 원칙(영화 우선, 검색 반경 없음, 판정은 회차·표시는 영화관, `도착 가능 ≠ 예매 가능`)과 기존 API 계약(`docs/openapi.yaml`)은 바꾸지 않는다. 응답 필드를 추가해야 하면 OpenAPI 버전을 올리고 변경 이력에 적는다.

## 2. 데이터 출처와 범위

| 데이터 | 출처 | 이번 범위 |
|---|---|---|
| 현재 상영작 후보 | TMDB `now_playing` (`region=KR`, `language=ko-KR`) | 구현 |
| 제목·러닝타임·개봉일·포스터 | TMDB 상세(러닝타임·포스터), KOBIS 영화 목록·상세(국내 제목·개봉일) | 구현 (KOBIS는 키가 있을 때만 보강) |
| 영화관 이름·주소·좌표·영업상태 | 공공데이터포털 **전국영화상영관표준데이터** | 구현 (영업 중인 곳만, 좌표 없는 곳은 제외) |
| 영화관별 상영시간표 | CGV·롯데시네마·메가박스 | **어댑터와 피드 파일 읽기만 구현.** 예매 사이트 웹 수집(크롤링)은 구현하지 않는다 (이용약관·허락 확인 전) |
| 회차별 잔여 좌석 | 각 예매 시스템 | **범위 밖.** 기준 명세상 `도착 가능`은 좌석·예매 가능을 뜻하지 않는다 |

## 3. 기능 요구사항

### FR-1 공급자 구조
- `ShowtimeProvider` 인터페이스(`backend/src/data/provider.ts`)는 그대로 두고 새 구현 `CompositeShowtimeProvider`를 만든다. 내부는 세 부품으로 나눈다.
  - `MovieCatalog`: 영화 목록·검색·상세 (TMDB + KOBIS 보강)
  - `CinemaDirectory`: 영화관 목록 (전국영화상영관표준데이터)
  - `ShowtimeSource`: 회차 목록 (피드 파일, 샘플)
- `SHOWTIME_PROVIDER` 값: `sample`(기본, 지금과 같음) | `composite`. `backend/src/config.ts`의 검증과 오류 문구도 고친다.
- 응답의 `source`(`DataSource`)는 `composite`일 때 `provider`로 표시한다.

### FR-2 영화 (MovieCatalog)
- `movieId`는 `tmdb_<id>` 형식으로 만든다. 기존 `movieId` 검증 정규식(`^[A-Za-z0-9_-]{1,64}$`)을 통과해야 한다.
- 러닝타임과 포스터는 TMDB 상세로 채운다. 포스터는 TMDB 이미지 기본 URL + `poster_path`. 없으면 `null`.
- KOBIS 키가 있으면 국내 제목·개봉일로 보강한다. 매칭 규칙(제목 정규화 + 개봉 연도)을 문서에 적는다. 매칭 실패는 오류가 아니다.
- `isShowingToday`는 지금처럼 **회차 데이터로만** 판단한다. TMDB `now_playing`에 있어도 회차가 없으면 `false`다.
- 메모리 캐시: 목록 10분, 상세 24시간. 외부 실패 시 남아 있는 캐시를 쓰고, 캐시도 없으면 공급자 상태를 `unavailable`로 돌려준다(서비스가 `unknown`으로 처리).

### FR-3 영화관 (CinemaDirectory)
- 전국영화상영관표준데이터에서 영업 중인 영화관만 쓴다. 위도·경도가 없거나 한국 밖이면 제외하고 개수를 로그에 남긴다(값은 남기지 않아도 됨).
- `cinemaId`는 출처 데이터의 안정적인 키로 만든다. 브랜드(CGV/롯데시네마/메가박스/기타)를 이름으로 분류해 내부 필드로 둔다.
- 캐시 24시간.
- 회차 피드의 지점 코드와 `cinemaId`를 잇는 매핑 파일 `backend/data/cinema-map.json`을 둔다(형식은 FR-4와 같이 문서화). 매핑이 없는 피드 행은 버리고 개수를 로그에 남긴다.

### FR-4 상영시간표 (ShowtimeSource)
- `FeedShowtimeSource`: `SHOWTIME_FEED_DIR`(기본 `backend/data/showtimes`)의 JSON 파일을 읽는다. 형식(브랜드, 지점 코드, 영화 식별자(TMDB id 또는 제목+개봉연도), 영업일, `HH:mm`(24시 이상 허용, 예 `25:10`), 상영관 이름, 예매 URL)을 `docs/data-sources.md`에 JSON 예제와 함께 정의한다.
- 파일 검증 실패 행은 버리고 이유별 개수를 로그에 남긴다. 파일이 하나도 없으면 회차 0개로 동작한다.
- 영업일 규칙은 기존과 같다 (Asia/Seoul 04:00 기준, `backend/src/time.ts` 재사용).
- `bookingUrl`은 `https://`만 허용한다.
- 예제 피드 파일 1개를 `backend/data/showtimes/example.json`에 넣는다. 실제 회차처럼 보이는 가짜 데이터임을 파일 안에 표시한다.

### FR-5 설정 (`backend/.env.example`에 빈 값으로 추가)
- `TMDB_API_KEY` (또는 공식 문서가 권하는 읽기 토큰 방식. 문서 확인 후 하나로 정한다), `TMDB_API_URL`(기본 공식 주소)
- `KOBIS_API_KEY`, `KOBIS_API_URL`
- `CINEMA_DATA_API_KEY`(공공데이터포털 서비스키), `CINEMA_DATA_API_URL`
- `SHOWTIME_FEED_DIR`
- 모든 URL은 `https://`만 허용한다 (`backend/src/config.ts`의 `httpsUrl` 재사용).
- `composite`인데 TMDB 키나 영화관 데이터 키가 없으면 서버 시작 시 분명한 오류로 멈춘다(키 값은 출력하지 않는다).

## 4. 품질 요구사항

- 외부 호출마다 타임아웃 5초. 실패해도 서버가 죽지 않는다.
- 같은 외부 API에 대한 동시 중복 요청은 하나로 합친다(캐시 채우는 중이면 그 Promise를 재사용).
- 기존 테스트는 모두 통과해야 한다. `SHOWTIME_PROVIDER` 기본값은 `sample`이라 기존 동작이 바뀌지 않는다.
- 새 코드는 단위 테스트를 가진다: TMDB·KOBIS·표준데이터 응답 파싱, 키 누락, 타임아웃·5xx, 캐시 만료, 피드 검증(잘못된 시각·https 아님·매핑 없음), `25:10` 회차의 실제 시각 변환, `composite`로 `/api/movies`·`/api/recommendations` 통합 테스트(가짜 fetch + 예제 피드).

## 5. 단계

1. 현재 코드 파악: `backend/src/data/`, `backend/src/config.ts`, `backend/src/types.ts`, `backend/src/services/`, `docs/openapi.yaml`. 바꿀 곳 목록을 만든다.
2. 공식 문서 확인: TMDB(now_playing, 상세, 이미지 URL, 인증 방식), KOBIS(영화 목록·상세), 공공데이터포털 전국영화상영관표준데이터(주소·파라미터·응답 필드·좌표 필드 이름). 결과를 `docs/data-sources.md`에 적는다(출처 URL, 이용 조건, 미확인 항목).
3. 설정 추가: `config.ts`, `.env.example`, 설정 테스트.
4. `MovieCatalog` 구현과 테스트.
5. `CinemaDirectory` 구현과 테스트, `backend/data/cinema-map.json` 형식 정의.
6. `FeedShowtimeSource` 구현과 테스트, 예제 피드 파일.
7. `CompositeShowtimeProvider` 조립, `createShowtimeProvider`에 연결, 통합 테스트.
8. 문서: `docs/data-sources.md` 완성, `docs/integration-guide.md`와 `backend/README.md`에 실행 방법 추가, OpenAPI는 계약이 바뀐 경우에만 갱신.
9. 검증: `backend` 폴더에서 `npm test`와 `npx tsc --noEmit` 통과. 실패하면 고친다.
10. `BUILD_REPORT.md`에 이 작업을 한 줄 이상 추가(사용한 Kiro 기능: Task Runner), 커밋, `git push origin feature/real-movie-data`.

## 6. 완료 조건

- `backend`에서 `npm test`, `npx tsc --noEmit` 모두 통과.
- `SHOWTIME_PROVIDER=sample`(기본)이면 기존 동작과 같다.
- `SHOWTIME_PROVIDER=composite`이면 실제 영화·영화관 + 피드 회차로 추천이 나온다(테스트에서 가짜 fetch로 증명).
- `.env`, `.env.local`이 커밋에 없고, 키 값이 코드·문서·로그·커밋에 없다.
- `feature/real-movie-data`가 push되었다.

## 7. 하지 않을 것

- CGV·롯데시네마·메가박스 예매 사이트 크롤링이나 비공개 API 호출.
- 잔여 좌석 조회.
- 프론트엔드 변경 (응답 계약이 같으므로 필요 없음).
- `main` push, `develop` 브랜치 수정.
