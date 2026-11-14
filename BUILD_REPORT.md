# BUILD REPORT

이 프로젝트의 백엔드는 **Kiro Crew Task Runner**로 만들었어요. 요구사항 명세서를 넣으면 Kiro가 작업을 20단계로 나누고, 단계마다 별도 에이전트 세션이 구현과 검증을 맡았어요. 끝난 뒤에는 리뷰 세션이 결과를 다시 확인했어요.

- 실행 ID: `plan_1794630611880648100`
- 실행 시간: 약 34분 (2066초), 재계획 0회
- 결과: 20단계 모두 완료

프론트엔드는 **Kiro Crew 채팅 세션 하나**에서 두 단계로 만들었어요.

1. **디자인 데모**: UX 명세서를 넣고 단일 HTML 데모를 만든 뒤, 화면을 보며 피드백을 주고받아 디자인을 다듬었어요 ([PR #2](https://github.com/candy3157/kirothon-team-010/pull/2)).
2. **React 프로젝트**: 확정한 디자인을 React + TypeScript + Vite로 옮기고 백엔드 API에 연결했어요 ([PR #5](https://github.com/candy3157/kirothon-team-010/pull/5)).
3. **다듬기**: 움직임·간격을 데모로 비교해 고르고 React에 넣었어요 ([PR #7](https://github.com/candy3157/kirothon-team-010/pull/7), [PR #9](https://github.com/candy3157/kirothon-team-010/pull/9)). 출발 날짜 지정과 상영 전 도착 여유 설정은 프론트 디자인에 맞춰 백엔드 API도 함께 고쳤어요 (`feature/departure-any-date`, `feature/buffer-minutes`).

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

- **출발 날짜는 프론트 기준으로**: React로 옮길 때 백엔드에 맞춰 "오늘 시간만" 고르게 바꿨어요. 하지만 팀 논의 끝에 원래 디자인(날짜 + 시간)이 맞다고 정했어요. 백엔드 담당과 합의하고 백엔드도 함께 고쳤어요. 이제 오늘부터 7일까지 고를 수 있고, 고른 날의 시간표로 계산해요 (API 1.1.0, `MAX_ADVANCE_DAYS = 6`).
- **여유 시간도 프론트 기준으로**: 백엔드가 여유 시간을 10분으로 고정해 두어서 React에서 −/+ 칸을 뺐어요. 눌러도 결과가 안 바뀌는 칸은 사용자를 속이기 때문이에요. 그런데 데모를 React에 맞추자 팀이 "여유 시간 설정이 왜 사라졌냐"고 물었어요. 출발 날짜 때처럼 백엔드를 고쳐 요청으로 값을 받게 하고, 칸을 원래 모양 그대로 되살렸어요 (API 1.2.0).
- **움직임은 비교해서 고르기**: 애니메이션은 말로 정하기 어려워서 후보를 데모 페이지에 나란히 놓고 직접 눌러 보며 골랐어요. 차분한 분위기를 해치지 않는 "눌림"과 앞뒤 방향이 보이는 "밀기"로 정했어요.
- **가져올 수 없는 정보 빼기**: 잔여 좌석은 영화관 3사 모두 공개 API가 없어요. 그래서 좌석 정보를 화면에서 뺐어요. 상영관 번호와 포맷(IMAX 등)도 디자인 검토 때 함께 뺐어요.

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

## 남은 일

- 프론트(`frontend/`)는 백엔드 API에 연결됐어요. 이제 `docs/integration-report.md`의 9개 시나리오를 화면에서 다시 검증해야 해요.
- 지도는 아직 가짜 배경이에요. 카카오/네이버 지도 SDK 연결이 필요해요 (`frontend/src/components/MapView.tsx`만 바꾸면 돼요).
- 출발지 검색은 미리 정한 장소 9곳뿐이에요. 백엔드에 주소→좌표 변환이 없어서 카카오 장소 검색 API 연동이 필요해요 (`frontend/src/lib/places.ts`).
- `frontend/demo/`는 디자인 기록용으로 남겨 두었어요. 실제 화면은 `frontend/src/`예요.
- 상영시간표와 경로는 샘플/mock 데이터예요. 실제 데이터 연동이 필요해요. 샘플은 날짜와 관계없이 같은 시간표예요.
- 출발 날짜 범위(7일, `MAX_ADVANCE_DAYS`)는 임시값이에요. 실제 공급자가 며칠 치 시간표를 주는지 보고 정해야 해요.
- 여유 시간 범위가 화면(0–40분)과 API(0–60분)에서 달라요. 화면 쪽을 늘릴지 팀에서 정해야 해요.
- 이동수단별 최고 속도(자동차 150, 대중교통 350, 도보 10 km/h)는 임시 기본값이에요.
- 영업일이 바뀌는 시각은 아직 정하지 않았어요.
- AT-05, AT-16은 테스트에 번호 표기가 없어요. 백엔드 항목인지 확인이 필요해요.
