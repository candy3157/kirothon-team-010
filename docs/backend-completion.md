# 백엔드 완료 검증 (완료 조건 ①)

검증일: 2026-11-14 / 경로: `backend/` / Node 22

## 결과 요약

| 항목 | 명령 | 결과 |
|---|---|---|
| 타입 검사 | `npx tsc --noEmit` | 오류 0건 (exit 0) |
| 전체 테스트 | `npx vitest run` | 14개 파일, 191개 테스트 모두 통과 |
| 프로덕션 빌드 | `npm run build` | 오류 0건 (exit 0), `dist/` 20개 파일, 테스트 파일 미포함 |
| 거리 제한 grep | `radius`, `maxDistance`, `cutoff` | 코드에 거리 제한 필드·고정 km 컷오프 없음 (아래 참고) |
| 프론트엔드 변경 | 디렉터리 확인 | 프론트 파일·의존성 없음. 변경 없음 |

## 테스트 구성

- 단위: time, feasibility, lowerBound, ranking, availability, provider, routing
- 서비스·통합: recommendService, recommend (AT 시나리오)
- 라우트: health, cors, movies, recommendationsRoute
- 계약: `test/contract/api.contract.test.ts` (52개, `docs/openapi.yaml`·`docs/examples` 대조)

## 자동화된 AT 커버리지

테스트 파일에서 확인된 AT: AT-01, 02, 03, 04, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15, 17, 18, 19, 20.

이전 검토에서 실패하던 AT-10, AT-19(`backend/test/recommend.test.ts`)는 이번 실행에서 통과한다.
AT-05, AT-16은 테스트 파일에 AT 번호 표기가 없다. 화면·지도·위치 권한 등 프론트 항목이면 완료 조건 ②(작업 20)에서 검증한다. 백엔드 항목이라면 번호 표기만 누락된 것인지 작업 20 전에 확인이 필요하다.

## 거리 제한 grep 결과

`src`와 `docs`에서 `radius` 계열 문자열이 나온 곳:

- `src/routing/mock.ts`, `src/services/lowerBound.ts`: `EARTH_RADIUS_KM`. haversine 계산용 지구 반지름이다. 검색 반경이 아니다.
- `src/types.ts` 주석, `docs/*.md`, `docs/openapi.yaml`: "이 필드는 없다"는 설명이다.
- `docs/examples/requests.http`: `radiusKm`을 보내면 `400 invalid_request`가 되는 부정 예제다.

요청 스키마와 서비스 코드에 거리 제한 필드나 고정 km 컷오프는 없다. 도착 불가 판정은 직선거리와 이동수단별 최고속도로 구한 하한 시간만 사용한다.

## 참고

- 작업 폴더는 git 저장소가 아니어서 `git status/diff`는 쓸 수 없다. 대신 폴더 구성(`backend/`, `docs/`만 존재)으로 프론트 파일이 없음을 확인했다.
- 개발 서버는 실행하지 않았다. 사용자가 직접 실행한다.

```
cd backend
npm install
npm run dev
```

- `docs/examples/requests.http`의 한글 주석이 일부 터미널에서 깨져 보인다. 파일 내용이 아니라 콘솔 인코딩 때문이다. 에디터에서 UTF-8로 열면 정상이다. 문자 대체(U+FFFD) 문자는 `src`, `test`에서 발견되지 않았다.
