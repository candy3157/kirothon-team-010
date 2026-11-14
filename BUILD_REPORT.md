# BUILD REPORT

이 프로젝트의 백엔드는 **Kiro Crew Task Runner**로 만들었어요. 요구사항 명세서를 넣으면 Kiro가 작업을 20단계로 나누고, 단계마다 별도 에이전트 세션이 구현과 검증을 맡았어요. 끝난 뒤에는 리뷰 세션이 결과를 다시 확인했어요.

- 실행 ID: `plan_1794630611880648100`
- 실행 시간: 약 34분 (2066초), 재계획 0회
- 결과: 20단계 모두 완료

프론트엔드는 화면 흐름을 보여 주는 디자인 데모(`frontend/demo/index.html`)로 따로 만들었어요. Task Runner 실행이 끝난 뒤 [PR #2](https://github.com/candy3157/kirothon-team-010/pull/2)로 들어왔어요. 그 뒤 백엔드 API를 부르는 React 프론트가 [PR #5](https://github.com/candy3157/kirothon-team-010/pull/5)로 들어왔어요.

그다음 Kiro Crew 채팅 세션에서 백엔드와 프론트의 연결을 검토하고, 사용자와 상의하며 연동 문제를 고쳤어요. 출발지 장소 검색과 네이버 지도도 이때 붙였어요.

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
| 검증 | Task Runner 작업 20 | 프론트 실제 통합 검증 시도. 실행 당시 프론트 코드가 없어 "보류"로 기록 | `docs/integration-report.md` |
| 프론트 | 화면 흐름 디자인 데모 | 단일 HTML로 화면 5개 구현: 스플래시 → 영화 선택(S01) → 출발 조건(S02) → 지도 추천(S03) → 영화관 상세·회차(S04). 데이터는 mock이고 지도는 가짜 배경이에요 | `frontend/demo/index.html`, `frontend/demo/README.md` |
| 검증 | Task Runner 리뷰 세션 | 완료 결과 재검토. 코드(3000)와 문서(3001)의 기본 포트 불일치를 찾아 3001로 통일 | `backend/src/config.ts`, `backend/.env.example` |
| 기타 | 단계별 에이전트 세션 | 작업마다 독립 세션이 구현하고, 앞 단계 결과를 이어받음 | Kiro Crew 세션 기록 |
| 기타 | Kiro Crew 메모리 | 프로젝트 경로, 열린 질문, 경로 조회 생략 규칙을 세션 사이에 기억 | Kiro Crew 메모리 |
| 문서 | Task Runner 작업 18 | 프론트 연동 가이드, API 호출 예제, README 작성 | `docs/integration-guide.md`, `docs/examples/requests.http`, `backend/README.md` |
| 연동 | Kiro Crew 채팅 (코드 리뷰) | React 프론트([PR #5](https://github.com/candy3157/kirothon-team-010/pull/5))와 백엔드 계약을 대조. 경로·타입·시각 형식·포트·프록시는 일치, 문제 7개를 목록으로 만들어 사용자와 하나씩 결정 | 이 문서 "개발 과정에서 바뀐 점" |
| 연동 | Kiro Crew 채팅 | CORS 기본 허용에 `http://127.0.0.1:5173` 추가, 테스트 추가 | `backend/src/config.ts`, `backend/test/cors.test.ts` |
| 구현 | Kiro Crew 채팅 | 심야 회차를 화면에서 `00:15`처럼 표시(`clockTime`). 영업일을 Asia/Seoul 04:00에 바꾸도록 백엔드·프론트 동시 수정 | `backend/src/policy.ts`, `backend/src/time.ts`, `frontend/src/lib/time.ts` |
| 구현 | Kiro Crew 채팅 | 백엔드가 `backend/.env`를 읽도록 추가. 네이버 API 주소·키를 `.env`로 관리, `.env.example`에는 빈 값만 | `backend/src/server.ts`, `backend/.env.example`, `frontend/.env.example` |
| 구현 | Kiro Crew 채팅 + 웹 검색 | 출발지 검색 API `GET /api/places`: 네이버 지역 검색 → 결과 없으면 NCP Geocoding. 키는 서버에만, IP당 분당 30회 제한. 키가 없으면 기본 장소 목록으로 대체 | `backend/src/places/`, `backend/src/routes/places.ts`, `frontend/src/screens/Departure.tsx` |
| 구현 | Kiro Crew 채팅 + 웹 검색 | 가짜 배경 지도를 네이버 지도(NCP Maps JS v3)로 교체. 키가 없거나 인증 실패면 가짜 지도로 대체 | `frontend/src/components/MapView.tsx`, `frontend/src/lib/naverMap.ts` |
| 검증 | Kiro Crew 채팅 | 장소 검색 단위·라우트 테스트, `/api/places` OpenAPI 계약 추가 | `backend/test/places.test.ts`, `docs/openapi.yaml` |

## 개발 과정에서 바뀐 점

- **포트 통일**: 처음엔 코드 기본 포트가 3000, OpenAPI 문서는 3001이었어요. 리뷰에서 찾아 3001로 맞췄어요.
- **경로 조회 줄이기 규칙 확정**: 영화관마다 경로 API를 다 부르면 느리고 비싸요. 그렇다고 km 반경으로 자르면 "검색 반경 없음" 원칙을 어겨요. 그래서 "직선거리 ÷ 이동수단 최고 속도"로 가장 짧은 시간을 먼저 구하고, 이 시간에도 마지막 회차에 못 가면 경로 조회를 건너뛰게 했어요 (`backend/src/services/lowerBound.ts`).
- **상태 나누기**: "도착 불가"와 "이동시간 미확인", "상영 없음"과 "확인 불가"를 서로 다른 응답으로 나눴어요. 경로 조회가 일부 실패해도 나머지 결과는 보여 줘요 (`docs/examples/recommendation-partial-route-failure.json`).
- **프론트 통합 검증 보류 → 디자인 데모 추가**: Task Runner 실행 때는 프론트 코드가 없어서 완료 조건 ②를 보류했어요. 대신 계약 테스트와 연동 가이드로 연동 준비를 끝냈어요. 그 뒤 화면 흐름을 먼저 확인하려고 단일 HTML 디자인 데모를 만들었어요. 데모 화면 S01–S04는 명세서의 사용자 흐름(영화 선택 → 출발 조건 → 추천 → 회차 선택)을 그대로 따라요.
- **연동 문제를 사용자와 하나씩 결정**: 리뷰에서 나온 문제를 Kiro가 표로 정리하고, 사용자가 항목마다 방향을 정했어요.

  | 문제 | 결정 |
  |---|---|
  | 프론트를 `127.0.0.1`로 열면 CORS에서 막힘 | 기본 허용 목록에 추가 |
  | "도착 가능 ≠ 예매 가능" 안내를 화면에서 거름 | 예매 가능 여부는 알 수 없으므로 그대로 둠 |
  | 자정 이후 회차가 `25:10`으로 보임 | 화면은 `01:10`, API는 `25:10` 유지 |
  | 자정을 넘는 출발 시각 | 영업일을 04:00에 바꿈 (07:00 → 04:00으로 다시 조정) |
  | 출발지 주소 검색 없음 | 네이버 지역 검색 + NCP Geocoding |
  | 지도가 가짜 배경 | 네이버 지도 |
  | `/availability`를 안 씀 | 지금처럼 추천 결과로 안내 |

## 어려웠던 점과 해결 방법

- **실패하던 AT 시나리오**: 중간 검토에서 AT-10, AT-19 테스트가 실패했어요. 다음 실행에서 고쳐 통과시켰어요 (`backend/test/recommend.test.ts`).
- **명세와 코드가 어긋날 위험**: 문서와 실제 응답이 달라지기 쉬워요. 그래서 `docs/openapi.yaml`과 `docs/examples/`를 실제 응답과 비교하는 계약 테스트 52개를 만들었어요.
- **"반경" 문자열 오해**: grep에 `EARTH_RADIUS_KM`이 걸렸어요. 이건 거리 계산(haversine)용 지구 반지름이라, 검색 반경이 아님을 완료 기록에 남겼어요.
- **Windows 콘솔 한글 깨짐**: 터미널에서 한글 주석이 깨져 보였어요. 파일은 UTF-8로 정상이고 콘솔 인코딩 문제임을 확인했어요.
- **백엔드가 `.env`를 읽지 않음**: 키를 `.env`로 관리하려다 서버가 이 파일을 전혀 읽지 않는 것을 찾았어요. Node 기본 기능 `process.loadEnvFile`로 읽게 했고, 이미 설정된 환경변수는 덮어쓰지 않아요.
- **API 키를 채팅에 쓰지 않기**: 키는 사용자가 직접 `.env` 파일에 넣었어요. Kiro는 값을 출력하지 않고 길이만 보고 확인했어요. 그 과정에서 지도 키가 `VITE_API_BASE` 칸에 들어가 영화 목록이 404가 나는 것을 찾았어요.
- **지역 검색 좌표 형식**: 공식 문서 예시는 옛 좌표 형식이지만 설명은 WGS84예요. 1e7배 정수로 받아 변환하고, 한국 밖 좌표는 버리도록 했어요.
- **검은 지도**: 개발 모드(React StrictMode)가 지도를 두 번 만들면서, 지운 요소 위에 다시 그려 지도가 검게 보였어요. 지도를 만들 때마다 새 요소를 쓰게 고쳤어요.
- **OpenAPI 들여쓰기 오류**: 영업일 문구를 바꾸면서 YAML 블록 들여쓰기가 깨졌어요. `/api/places`를 넣을 때 찾아 고쳤어요.

## 남은 일

- `docs/integration-report.md`의 9개 시나리오를 실제로 다시 검증해야 해요.
- 장소 검색 결과의 핀 위치를 실제 키로 확인해야 해요.
- 이번 채팅 작업분은 `npm test`를 아직 돌리지 않았어요.
- 상영시간표와 경로는 샘플/mock 데이터예요. 실제 데이터 연동이 필요해요.
- 이동수단별 최고 속도(자동차 150, 대중교통 350, 도보 10 km/h)는 임시 기본값이에요.
- AT-16은 테스트에 번호 표기가 없어요. 확인이 필요해요.
