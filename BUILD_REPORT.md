# BUILD REPORT

이 프로젝트의 백엔드는 **Kiro Crew Task Runner**로 만들었어요. 요구사항 명세서를 넣으면 Kiro가 작업을 20단계로 나누고, 단계마다 별도 에이전트 세션이 구현과 검증을 맡았어요. 끝난 뒤에는 리뷰 세션이 결과를 다시 확인했어요.

- 실행 ID: `plan_1794630611880648100`
- 실행 시간: 약 34분 (2066초), 재계획 0회
- 결과: 20단계 모두 완료

## Kiro 활용 내역

| 단계 | 사용한 Kiro 기능 | 무엇을 했는지 | 결과물 위치 |
|---|---|---|---|
| 기획 | Kiro Crew 채팅 | 영화 우선 탐색·이동시간 추천 서비스 요구사항 명세서 v1.2 작성 (원칙 6개, P0/P1/P2 구분, AT 시나리오) | `.kiro/specs/cinema-recommendation/requirements.md` |
| 기획 | Task Runner 분해 (decompose) | 명세서를 의존 순서가 있는 20개 작업으로 나눔. 완료 조건 ①(백엔드), ②(프론트 연동)로 묶음 | Task Runner 계획 `plan_1794630611880648100` (입력: `.kiro/specs/cinema-recommendation/requirements.md`) |
| 설계 | Task Runner 작업 1–2 | 프론트가 필요로 하는 API 정리, OpenAPI 3.1 명세와 요청·응답 예제 확정 | `docs/frontend-api-requirements.md`, `docs/openapi.yaml`, `docs/examples/` |
| 설계 | Task Runner 작업 4 | 공통 타입과 정책 값(입장 준비시간, 이동수단별 최고 속도 등) 정의 | `backend/src/types.ts`, `backend/src/policy.ts` |
| 구현 | Task Runner 작업 3, 5–12 | Fastify 5 + TypeScript 프로젝트 생성. 심야 회차 시간 변환, 샘플 상영시간표, mock 경로 제공자, 관람 가능 판정, 정렬·대표 회차 선정, 도착 불가 하한 판정, 추천 오케스트레이션 구현 | `backend/src/time.ts`, `backend/src/data/`, `backend/src/routing/`, `backend/src/services/` |
| 구현 | Task Runner 작업 13–15 | 영화 검색·상영 여부·추천 API 라우트, 입력 검증, CORS·보안 헤더·요청 제한 설정 | `backend/src/routes/`, `backend/src/app.ts` |
| 검증 | Task Runner 작업 16–17 | AT 시나리오 통합 테스트와 OpenAPI 계약 테스트(52개) 작성 | `backend/test/`, `backend/test/contract/` |
| 검증 | Task Runner 작업 19 | `tsc` 오류 0건, 14개 파일 191개 테스트 통과, 빌드 성공 확인. 코드에 km 반경 컷오프가 없는지 grep으로 확인 | `docs/backend-completion.md` |
| 검증 | Task Runner 작업 20 | 프론트 실제 통합 검증 시도. 프론트 코드가 없어 "보류"로 기록 | `docs/integration-report.md` |
| 검증 | Task Runner 리뷰 세션 | 완료 결과 재검토. 코드(3000)와 문서(3001)의 기본 포트 불일치를 찾아 3001로 통일 | `backend/src/config.ts`, `backend/.env.example` |
| 기타 | 단계별 에이전트 세션 | 작업마다 독립 세션이 구현하고, 앞 단계 결과를 이어받음 | Kiro Crew 세션 기록 |
| 기타 | Kiro Crew 메모리 | 프로젝트 경로, 열린 질문, 경로 조회 생략 규칙을 세션 사이에 기억 | Kiro Crew 메모리 |
| 문서 | Task Runner 작업 18 | 프론트 연동 가이드, API 호출 예제, README 작성 | `docs/integration-guide.md`, `docs/examples/requests.http`, `backend/README.md` |

## 개발 과정에서 바뀐 점

- **포트 통일**: 처음엔 코드 기본 포트가 3000, OpenAPI 문서는 3001이었어요. 리뷰에서 찾아 3001로 맞췄어요.
- **경로 조회 줄이기 규칙 확정**: 영화관마다 경로 API를 다 부르면 느리고 비싸요. 그렇다고 km 반경으로 자르면 "검색 반경 없음" 원칙을 어겨요. 그래서 "직선거리 ÷ 이동수단 최고 속도"로 가장 짧은 시간을 먼저 구하고, 이 시간에도 마지막 회차에 못 가면 경로 조회를 건너뛰게 했어요 (`backend/src/services/lowerBound.ts`).
- **상태 나누기**: "도착 불가"와 "이동시간 미확인", "상영 없음"과 "확인 불가"를 서로 다른 응답으로 나눴어요. 경로 조회가 일부 실패해도 나머지 결과는 보여 줘요 (`docs/examples/recommendation-partial-route-failure.json`).
- **프론트 통합 검증 보류**: 완료 조건 ②는 프론트 코드가 있어야 해요. 프론트가 아직 없어서, 대신 계약 테스트와 연동 가이드로 연동 준비를 끝냈어요.

## 어려웠던 점과 해결 방법

- **실패하던 AT 시나리오**: 중간 검토에서 AT-10, AT-19 테스트가 실패했어요. 다음 실행에서 고쳐 통과시켰어요 (`backend/test/recommend.test.ts`).
- **명세와 코드가 어긋날 위험**: 문서와 실제 응답이 달라지기 쉬워요. 그래서 `docs/openapi.yaml`과 `docs/examples/`를 실제 응답과 비교하는 계약 테스트 52개를 만들었어요.
- **"반경" 문자열 오해**: grep에 `EARTH_RADIUS_KM`이 걸렸어요. 이건 거리 계산(haversine)용 지구 반지름이라, 검색 반경이 아님을 완료 기록에 남겼어요.
- **Windows 콘솔 한글 깨짐**: 터미널에서 한글 주석이 깨져 보였어요. 파일은 UTF-8로 정상이고 콘솔 인코딩 문제임을 확인했어요.

## 남은 일

- 상영시간표와 경로는 샘플/mock 데이터예요. 실제 데이터 연동이 필요해요.
- 이동수단별 최고 속도(자동차 150, 대중교통 350, 도보 10 km/h)는 임시 기본값이에요.
- 영업일이 바뀌는 시각은 아직 정하지 않았어요.
- AT-05, AT-16은 테스트에 번호 표기가 없어요. 백엔드 항목인지 확인이 필요해요.
