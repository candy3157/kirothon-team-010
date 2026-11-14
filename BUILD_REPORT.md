# BUILD REPORT

이 프로젝트의 백엔드는 **Kiro Crew Task Runner**로 만들었어요. 요구사항 명세서를 넣으면 Kiro가 작업을 20단계로 나누고, 단계마다 별도 에이전트 세션이 구현과 검증을 맡았어요. 끝난 뒤에는 리뷰 세션이 결과를 다시 확인했어요.

- 실행 ID: `plan_1794630611880648100`
- 실행 시간: 약 34분 (2066초), 재계획 0회
- 결과: 20단계 모두 완료

프론트엔드는 **Kiro Crew 채팅 세션 하나**에서 세 단계로 만들었어요.

1. **디자인 데모**: UX 명세서를 넣고 단일 HTML 데모를 만든 뒤, 화면을 보며 피드백을 주고받아 디자인을 다듬었어요 ([PR #2](https://github.com/candy3157/kirothon-team-010/pull/2)).
2. **React 프로젝트**: 확정한 디자인을 React + TypeScript + Vite로 옮기고 백엔드 API에 연결했어요 ([PR #5](https://github.com/candy3157/kirothon-team-010/pull/5)).
3. **다듬기**: 움직임·간격을 데모로 비교해 고르고 React에 넣었어요 ([PR #7](https://github.com/candy3157/kirothon-team-010/pull/7), [PR #9](https://github.com/candy3157/kirothon-team-010/pull/9)). 출발 날짜 지정과 상영 전 도착 여유 설정은 프론트 디자인에 맞춰 백엔드 API도 함께 고쳤어요 (`feature/departure-any-date`, `feature/buffer-minutes`).

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
| 프론트 기획 | Kiro Crew 채팅 (파일 첨부) | 프론트 UX 명세서(화면 S01–S04, 상태 관리, 예외 처리)를 넣고 화면 구조와 데모 범위를 정함 | Kiro Crew 세션 기록 |
| 프론트 디자인 | Kiro Crew 채팅 | 단일 HTML로 화면 5개 구현: 스플래시 → 영화 선택(S01) → 출발 조건(S02) → 지도 추천(S03) → 영화관 상세·회차(S04). 데이터는 mock, 지도는 가짜 배경 | `frontend/demo/index.html`, `frontend/demo/README.md` |
| 프론트 디자인 | Kiro Crew 채팅 (스크린샷·스케치 첨부로 반복 수정) | 약 30번의 피드백으로 디자인 확정: 블랙 & 레드 테마, 이모지 → 손그림 SVG 아이콘, 그라데이션·그림자 제거, 스플래시 화면, 영화관 카드 시간 막대, 회차 가로 카드, 검색 반경·정렬 버튼 제거 | `frontend/demo/index.html` |
| 프론트 설계 | Kiro Crew 채팅 | `docs/openapi.yaml`, `docs/frontend-api-requirements.md`를 읽고 디자인과 API가 다른 곳 3가지를 찾음(여유 시간 설정, 출발 날짜, 주소 검색). 데모 연결 대신 React 프로젝트로 가기로 결정 | `frontend/README.md` "백엔드 계약에 맞춘 결정" |
| 프론트 구현 | Kiro Crew 채팅 | React 18 + TypeScript + Vite 프로젝트 생성. OpenAPI 스키마를 타입으로 옮기고, API 클라이언트·오류 처리·Vite 프록시(`/api` → `:3001`) 구성. 데모 디자인을 컴포넌트로 나눔 | `frontend/src/api/`, `frontend/src/screens/`, `frontend/src/components/`, `frontend/vite.config.ts` |
| 프론트 구현 | Kiro Crew 채팅 | 추천 결과의 모든 상태 표시: `outcome` 5가지, 경로 미확인 영화관, 도착 불가 영화관, `notices`, 400 오류(출발 시각 범위 밖) | `frontend/src/screens/Recommend.tsx`, `frontend/src/components/TheaterDetail.tsx` |
| 프론트 검증 | Kiro Crew 채팅 (셸 실행) | `tsc` 오류 0건, 단위 테스트 7개 통과, `vite build` 성공. 백엔드와 프론트 개발 서버를 함께 띄워 프록시로 `/api/movies`, `/api/recommendations`(지금 출발·시간 지정) 실제 호출 확인 | `frontend/src/lib/lib.test.ts` |
| 프론트 문서 | Kiro Crew 채팅 | 실행 방법, 폴더 구조, API 계약에 맞춘 결정, 상태별 화면 표 작성 | `frontend/README.md` |
| 프론트 디자인 | Kiro Crew 채팅 (비교 데모) | 버튼 애니메이션 3가지(눌림·퍼짐·없음)와 화면 전환 4가지(페이드·밀기·떠오르기·없음)를 데모 페이지로 나란히 비교해 "눌림 + 밀기"를 고름 | `frontend/src/styles.css` "누름 애니메이션", "화면 전환" |
| 프론트 구현 | Kiro Crew 채팅 | 누름 애니메이션, 화면·바텀시트 밀기 전환, 출발 조건 화면 간격 넓히기(스크롤 없이 한 화면). 버튼 크기는 그대로 두고 간격만 늘어나는 빈칸으로 조절 | `frontend/src/App.tsx`, `frontend/src/screens/Departure.tsx`, `frontend/src/screens/Recommend.tsx` |
| 백엔드 수정 | Kiro Crew 채팅 | 프론트 디자인(날짜 + 시간 선택)에 맞춰 "오늘만" 제한을 풀고 오늘부터 7일까지 받게 함. 출발 날짜의 시간표로 계산. 기존 테스트 5개를 새 규칙으로 고치고 OpenAPI를 1.1.0으로 올림 | `backend/src/policy.ts`(`MAX_ADVANCE_DAYS`), `backend/src/services/recommend.ts`, `backend/src/routes/movies.ts`, `docs/openapi.yaml` |
| 백엔드 수정 | Kiro Crew 채팅 | 프론트의 "상영 전 도착 여유" −/+ 설정을 실제 계산에 쓰도록 추천 요청에 `bufferMinutes`(0–60분, 기본 10분)를 추가. 회차 판정과 도착 불가 하한 판정에 반영하고 `meta.policy.bufferMinutes`로 실제 값을 돌려줌. 새 테스트 2개(값에 따라 대표 회차가 바뀜, 잘못된 값은 400), OpenAPI 1.2.0 | `backend/src/routes/recommendations.ts`, `backend/src/services/recommend.ts`, `backend/test/recommendationsRoute.test.ts`, `docs/openapi.yaml` |
| 프론트 구현 | Kiro Crew 채팅 | 출발 조건 화면에 원래 모양의 −/+ 칸(0–40분, 5분씩)을 되살리고 요청에 실어 보냄. 백엔드 194개·프론트 8개 테스트 통과, 0분·30분을 실제로 보내 응답에 반영되는지 확인 | `frontend/src/screens/Departure.tsx`, `frontend/src/state.ts`, `frontend/src/App.tsx` |
| 검증 | Kiro Crew 채팅 (셸 실행) | 백엔드 192개 테스트 통과(계약 테스트 52개 포함), 프론트 8개 통과·빌드 성공. 개발 서버로 모레 출발 추천, 범위 밖 날짜 400을 실제 호출로 확인 | `backend/test/`, `frontend/src/lib/lib.test.ts` |
| 기타 | Kiro Crew Git 작업 | 기능별 브랜치를 만들어 커밋·푸시하고 PR 링크 생성 | [PR #2](https://github.com/candy3157/kirothon-team-010/pull/2), [PR #5](https://github.com/candy3157/kirothon-team-010/pull/5), [PR #7](https://github.com/candy3157/kirothon-team-010/pull/7), [PR #9](https://github.com/candy3157/kirothon-team-010/pull/9) |
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
| 기획 | Kiro Crew 채팅 + 웹 검색 | 실제 데이터 출처 조사: 영화(TMDB·KOBIS), 영화관(인허가 데이터), 시간표·잔여 좌석(공개 API 없음), 길찾기(카카오 대중교통·도보는 제휴 전용). 가져올 수 없는 데이터를 표로 정리 | 이 문서 "개발 과정에서 바뀐 점" |
| 기획 | Task Runner 명세 작성 | 실제 데이터 연동, 공식 예매 사이트 바로가기 작업을 Task Runner 입력용 명세로 작성 | `.kiro/specs/real-movie-data/requirements.md`, `.kiro/specs/booking-deeplink/requirements.md` |
| 구현 | Kiro Crew 채팅 | `SHOWTIME_PROVIDER=real`: 영화 목록·포스터·러닝타임은 TMDB, 영화관은 인허가 CSV, 회차는 데모 값. 키가 없거나 `sample`이면 기존과 같음 | `backend/src/data/tmdb.ts`, `backend/src/data/cinemaCsv.ts`, `backend/src/data/real.ts` |
| 구현 | Kiro Crew 채팅 | 인허가 CSV 좌표(EPSG:5174, Bessel TM)를 WGS84로 바꾸는 변환을 의존성 없이 구현 | `backend/src/data/geo5174.ts` |
| 검증 | Kiro Crew 채팅 | 좌표 변환, CSV 묶기·이름 정리, TMDB 파싱·캐시·실패, 데모 회차, real 공급자 API 통합 테스트 | `backend/test/realData.test.ts` |
| 문서 | Kiro Crew 채팅 | 데이터 출처·가공 규칙 정리 | `docs/data-sources.md` |
| 연동 | Kiro Crew 채팅 + 웹 검색 | 장소 이름("센터필드") 검색 실패 원인 분석: NCP 콘솔(NAVER API HUB) 키인데 옛 개발자센터 주소·헤더로 부르고 있었음. 주소에 맞춰 헤더를 고르게 하고, 실패 이유(상태 코드만)를 로그에 남김 | `backend/src/places/provider.ts`, `backend/src/config.ts` |
| 구현 | Kiro Crew 채팅 | 지도 첫 화면을 결과 전체(전국)가 아닌 출발지 + 상위 5곳에 맞춤 | `frontend/src/components/MapView.tsx`, `frontend/src/lib/recommend.ts` |
| 구현 | Kiro Crew 채팅 | 지도와 목록에 구역마다 상위 5곳만 표시 (서버 결과는 그대로) | `frontend/src/screens/Recommend.tsx`, `frontend/src/lib/recommend.ts` |
| 구현 | Kiro Crew 채팅 | 여유·이동·지각 시간을 소수점 없이 표시 (버림, 반올림 안 함) | `frontend/src/lib/time.ts`, `frontend/src/components/TheaterDetail.tsx` |

## 개발 과정에서 바뀐 점

- **포트 통일**: 처음엔 코드 기본 포트가 3000, OpenAPI 문서는 3001이었어요. 리뷰에서 찾아 3001로 맞췄어요.
- **경로 조회 줄이기 규칙 확정**: 영화관마다 경로 API를 다 부르면 느리고 비싸요. 그렇다고 km 반경으로 자르면 "검색 반경 없음" 원칙을 어겨요. 그래서 "직선거리 ÷ 이동수단 최고 속도"로 가장 짧은 시간을 먼저 구하고, 이 시간에도 마지막 회차에 못 가면 경로 조회를 건너뛰게 했어요 (`backend/src/services/lowerBound.ts`).
- **상태 나누기**: "도착 불가"와 "이동시간 미확인", "상영 없음"과 "확인 불가"를 서로 다른 응답으로 나눴어요. 경로 조회가 일부 실패해도 나머지 결과는 보여 줘요 (`docs/examples/recommendation-partial-route-failure.json`).
- **프론트 통합 검증 보류 → 디자인 데모 추가**: Task Runner 실행 때는 프론트 코드가 없어서 완료 조건 ②를 보류했어요. 대신 계약 테스트와 연동 가이드로 연동 준비를 끝냈어요. 그 뒤 화면 흐름을 먼저 확인하려고 단일 HTML 디자인 데모를 만들었어요. 데모 화면 S01–S04는 명세서의 사용자 흐름(영화 선택 → 출발 조건 → 추천 → 회차 선택)을 그대로 따라요.
- **디자인 데모 → React 프로젝트**: 처음엔 데모 HTML에 API만 붙이는 방법도 생각했어요. 하지만 파일 하나(1,200줄)로는 함께 고치기 어렵고, 백엔드도 Vite 개발 서버(`localhost:5173`)를 가정하고 있었어요. 그래서 디자인을 확정한 뒤 React + Vite 프로젝트로 옮겼어요.
- **API 계약에 맞춰 화면 조정**:

  | 데모 화면 | React 화면 | 이유 |
  |---|---|---|
  | 상영 전 여유 시간 −/+ 설정 | ~~설정 없음~~ → −/+ 칸 복구 (아래 참고) | 처음엔 서버 고정값(10분)이라 요청으로 못 바꿈 |
  | 출발 날짜·시간 지정 | ~~오늘 시간만 지정~~ → 날짜 + 시간 (아래 참고) | 처음엔 백엔드가 오늘만 허용 |
  | 현재 상영작 / 상영 예정작 탭 | 탭 없음. 오늘 상영 없는 영화는 흐리게 | 상영 예정작 데이터가 없음 |
  | 정렬 3가지 | `sortBy: earliest` 고정 | 디자인 검토에서 정렬 버튼을 빼기로 함 |
  | 임의 포스터 사진 | `posterUrl`, 없으면 제목 카드 | 가짜 포스터를 실제처럼 보이지 않게 |

- **출발 날짜는 프론트 기준으로**: React로 옮길 때 백엔드에 맞춰 "오늘 시간만" 고르게 바꿨어요. 하지만 팀 논의 끝에 원래 디자인(날짜 + 시간)이 맞다고 정했어요. 백엔드 담당과 합의하고 백엔드도 함께 고쳤어요. `feature/departure-any-date`에서는 오늘 영업일부터 7일까지 고를 수 있고, 고른 영업일의 시간표로 계산해요 (API 1.1.0, `MAX_ADVANCE_DAYS = 6`).
- **여유 시간도 프론트 기준으로**: 백엔드가 여유 시간을 10분으로 고정해 두어서 React에서 −/+ 칸을 뺐어요. 눌러도 결과가 안 바뀌는 칸은 사용자를 속이기 때문이에요. 그런데 데모를 React에 맞추자 팀이 "여유 시간 설정이 왜 사라졌냐"고 물었어요. 출발 날짜 때처럼 백엔드를 고쳐 요청으로 값을 받게 하고, `feature/buffer-minutes` 브랜치에서 칸을 원래 모양 그대로 되살렸어요 (API 1.2.0).
- **움직임은 비교해서 고르기**: 애니메이션은 말로 정하기 어려워서 후보를 데모 페이지에 나란히 놓고 직접 눌러 보며 골랐어요. 차분한 분위기를 해치지 않는 "눌림"과 앞뒤 방향이 보이는 "밀기"로 정했어요.
- **가져올 수 없는 정보 빼기**: 잔여 좌석은 영화관 3사 모두 공개 API가 없어요. 그래서 좌석 정보를 화면에서 뺐어요. 상영관 번호와 포맷(IMAX 등)도 디자인 검토 때 함께 뺐어요.

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

- **실제 데이터: 가져올 수 있는 것만**: 영화와 영화관은 공개 데이터로 바꿨어요. 상영시간표와 잔여 좌석은 3사 모두 공개 API가 없어요. 예매 사이트 크롤링은 약관 위험 때문에 하지 않기로 했어요. 그래서 회차는 데모 값으로 두고, 응답 `source`를 `sample`로 표시해 실제 정보로 오해하지 않게 했어요.
- **전국 영화관이 지도에 다 뜸**: 실제 영화관 약 630곳을 쓰자, 한 영화를 트는 곳이 전국에 퍼져 지도가 너무 넓어졌어요. "검색 반경 없음" 원칙 때문에 거리로 빼지는 않았어요. 먼저 지도 첫 화면만 상위 5곳에 맞췄고, 이어서 사용자 요청으로 지도와 목록 모두 순위 상위 5곳만 보이게 했어요. 거리 기준이 아니라 추천 순위 기준이라 원칙과 맞아요.
- **Task Runner 대신 채팅으로**: 처음엔 실제 데이터 연동을 Task Runner로 돌렸어요. 그 사이 사용자가 영화관 CSV를 직접 구해 와서 범위가 좁아졌어요(TMDB + CSV). 그래서 채팅에서 바로 구현하고, 같은 일을 하던 Task Runner 실행은 멈췄어요.

## 어려웠던 점과 해결 방법

- **실패하던 AT 시나리오**: 중간 검토에서 AT-10, AT-19 테스트가 실패했어요. 다음 실행에서 고쳐 통과시켰어요 (`backend/test/recommend.test.ts`).
- **명세와 코드가 어긋날 위험**: 문서와 실제 응답이 달라지기 쉬워요. 그래서 `docs/openapi.yaml`과 `docs/examples/`를 실제 응답과 비교하는 계약 테스트 52개를 만들었어요.
- **"반경" 문자열 오해**: grep에 `EARTH_RADIUS_KM`이 걸렸어요. 이건 거리 계산(haversine)용 지구 반지름이라, 검색 반경이 아님을 완료 기록에 남겼어요.
- **Windows 콘솔 한글 깨짐**: 터미널에서 한글 주석이 깨져 보였어요. 파일은 UTF-8로 정상이고 콘솔 인코딩 문제임을 확인했어요.
- **재검색 버튼 주변에 생긴 회색 상자**: "이 지역 재검색" 버튼을 반투명 빨강으로 바꿨는데 회색 테두리 상자가 계속 보였어요. 테두리 속성을 지워도 그대로였어요. 사용자가 보낸 스크린샷으로 원인을 찾았어요. 버튼을 보이게 하는 CSS 클래스 `show`가 상영회차 카드 클래스 `.show`와 이름이 같았어요. 회차 카드 클래스를 `showtime`으로 바꿔 해결했어요. 같은 이름을 쓰던 로딩 안내, 확인 창, 토스트도 함께 고쳐졌어요.
- **피드백을 잘못 이해한 경우**: "여유 시간 설정을 토글로 두지 말아 달라"는 요청을 "형태를 바꿔 달라"로 이해해 버튼 묶음으로 바꿨다가, 원래 −/+ 형태로 되돌렸어요. 이후로는 바꿀 부분만 바꾸고 나머지는 그대로 두었어요.
- **간격을 넓히면 작은 화면에서 넘침**: 출발 조건 화면을 "스크롤 없이 한 화면"으로 만들면서 간격을 넓히자 작은 폰에서 내용이 넘쳤어요. 버튼 크기는 그대로 두라는 조건이 있어서, 큰 간격을 화면 높이에 따라 늘었다 줄었다 하는 빈칸으로 바꿨어요. 아주 작은 화면(높이 약 620px 미만)에서만 안쪽 스크롤이 생겨요.
- **"API에 맞추기"와 "디자인 지키기" 사이**: React로 옮기며 API에 없는 기능(출발 날짜, 여유 시간)을 화면에서 뺐는데, 둘 다 나중에 되살리게 됐어요. 처음부터 "화면에서 뺄지, API를 고칠지"를 팀에 먼저 물었다면 두 번 일하지 않았을 거예요. 이후 같은 상황에서는 바로 빼지 않고 먼저 묻기로 했어요.
- **"7일 안이면 그날 시간표로"의 한계**: 샘플 데이터는 날짜별 시간표가 없어서 매일 같은 시간표로 가정했어요. 실제 데이터를 붙이면 날짜마다 달라져요.
- **화면을 직접 볼 수 없음**: 작업 컴퓨터에 브라우저 자동화 도구가 없어 화면 캡처로 확인하지 못했어요. 대신 코드 문법 검사, 타입 검사, 빌드, 실제 API 호출로 검증하고, 화면은 사용자가 보고 스크린샷·스케치로 피드백했어요.

- **백엔드가 `.env`를 읽지 않음**: 키를 `.env`로 관리하려다 서버가 이 파일을 전혀 읽지 않는 것을 찾았어요. Node 기본 기능 `process.loadEnvFile`로 읽게 했고, 이미 설정된 환경변수는 덮어쓰지 않아요.
- **API 키를 채팅에 쓰지 않기**: 키는 사용자가 직접 `.env` 파일에 넣었어요. Kiro는 값을 출력하지 않고 길이만 보고 확인했어요. 그 과정에서 지도 키가 `VITE_API_BASE` 칸에 들어가 영화 목록이 404가 나는 것을 찾았어요.
- **지역 검색 좌표 형식**: 공식 문서 예시는 옛 좌표 형식이지만 설명은 WGS84예요. 1e7배 정수로 받아 변환하고, 한국 밖 좌표는 버리도록 했어요.
- **검은 지도**: 개발 모드(React StrictMode)가 지도를 두 번 만들면서, 지운 요소 위에 다시 그려 지도가 검게 보였어요. 지도를 만들 때마다 새 요소를 쓰게 고쳤어요.
- **OpenAPI 들여쓰기 오류**: 영업일 문구를 바꾸면서 YAML 블록 들여쓰기가 깨졌어요. `/api/places`를 넣을 때 찾아 고쳤어요.

- **CSV 한 줄 = 상영관 하나**: 인허가 CSV는 "CGV 대학로 3관"처럼 상영관마다 한 줄이에요. 같은 좌표 + 같은 브랜드를 영화관 하나로 묶고, 이름에서 "5관", "(주)", "DOLBY CINEMA관" 같은 말을 지웠어요. 영업 중인 3,489행이 약 630곳이 돼요.
- **좌표계 변환**: CSV 좌표는 위경도가 아닌 평면 좌표(EPSG:5174)예요. 외부 라이브러리 없이 TM 역변환과 7변수 좌표 변환을 직접 구현했어요. 좌표계는 공개 자료로 추정한 값이라 지도에서 확인이 필요해요.
- **키가 에러 메시지에 찍힘**: TMDB 키를 `.env`의 다른 줄에 넣자, 설정 오류 메시지가 그 값을 그대로 콘솔에 찍었어요. 설정 오류에는 값을 넣지 않도록 고치고 테스트를 추가했어요.

- **바뀐 네이버 검색 API 주소**: 지역 검색이 주소는 찾는데 장소 이름은 못 찾았어요. 키 길이(10자·40자)를 보고 NCP 콘솔 키임을 알아냈어요. 네이버 검색 API가 NAVER API HUB로 옮겨 가면서 주소와 헤더가 바뀌었는데, 코드는 옛 주소를 쓰고 있었어요. 공식 문서를 못 찾아 다른 서비스의 설명서로 주소를 확인했어요.
- **소수점 여유 시간**: "지금 출발"은 초 단위까지 계산해서 "10.0991…분 여유"처럼 보였어요. 화면에서는 소수점을 버리도록 했어요(반올림하면 실제보다 여유가 많아 보일 수 있어요).

## 남은 일

- `docs/integration-report.md`의 9개 시나리오를 실제로 다시 검증해야 해요.
- 장소 검색 결과의 핀 위치를 실제 키로 확인해야 해요.
- 상영시간표와 경로는 데모/mock 데이터예요. 시간표는 영화관 회사 제휴가 필요해요. 경로는 자동차(NCP Directions), 대중교통(ODsay) 후보를 찾아 두었어요.
- 영화관 핀 위치(좌표 변환)를 지도에서 확인해야 해요.
- 6위 아래 영화관은 화면에서 볼 수 없어요. 필요하면 "더 보기"를 붙여야 해요.
- NAVER API HUB 지역 검색 주소는 공식 문서로 다시 확인해야 해요.
- TMDB 이용 조건에 따른 출처 표시를 화면에 넣어야 해요.
- `frontend/demo/`는 디자인 기록용이고 실제 화면은 `frontend/src/`예요.
- 출발 날짜 기능은 [PR #10](https://github.com/candy3157/kirothon-team-010/pull/10)에서 병합을 기다려요. 범위(7일, `MAX_ADVANCE_DAYS`)는 실제 공급자의 시간표 제공 범위에 맞춰 정해야 해요.
- 여유 시간 설정은 `feature/buffer-minutes` 브랜치 작업이에요. 반영 시 화면(0–40분)과 API(0–60분)의 범위를 팀에서 맞춰야 해요.
- 이동수단별 최고 속도(자동차 150, 대중교통 350, 도보 10 km/h)는 임시 기본값이에요.
- AT-16은 테스트에 번호 표기가 없어요. 확인이 필요해요.
