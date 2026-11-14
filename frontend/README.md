# Moviepato 프론트엔드

React 18 + TypeScript + Vite. 백엔드(`backend/`, `docs/openapi.yaml` 1.0.0)에 연결된다.

## 실행

```bash
# 1) 백엔드 (127.0.0.1:3001)
cd backend && npm install && npm run dev

# 2) 프론트 (127.0.0.1:5173) — /api 요청은 백엔드로 프록시됨
cd frontend && npm install && npm run dev
```

브라우저에서 http://127.0.0.1:5173 을 연다.

| 명령 | 하는 일 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 타입 검사 + 배포용 빌드(`dist/`) |
| `npm run typecheck` | 타입 검사만 |
| `npm test` | 단위 테스트(vitest) |

배포 시 백엔드가 다른 주소면 `.env.example`을 참고해 `VITE_API_BASE`를 지정한다.

## 화면 흐름

`스플래시(1.5초)` → `S01 영화 선택` → `S02 출발 조건` → `S03 지도 추천` → `S04 영화관 상세(바텀시트)`

## 폴더

| 경로 | 내용 |
|---|---|
| `src/api/types.ts` | OpenAPI 스키마 타입 |
| `src/api/client.ts` | API 호출 · 오류(`ApiError`) |
| `src/App.tsx` | 화면 전환 · 검색 조건 유지 · 추천 요청 |
| `src/state.ts` | `SearchContext` (UX 명세 6장) |
| `src/screens/` | `MovieSelect`(S01) · `Departure`(S02) · `Recommend`(S03 + 목록 상태) |
| `src/components/` | `MapView` · `TheaterCard` · `TheaterDetail`(S04) · `Poster` · `Icon`(손그림 아이콘) · `Splash` · `Feedback`(토스트·이동 확인창) |
| `src/lib/` | 시간(서울 기준) · 거리 · 추천 배지 · 출발지 목록 |
| `src/styles.css` | 전체 스타일 (블랙 & 레드) |

## 백엔드 계약에 맞춘 결정

| 항목 | 결정 | 이유 |
|---|---|---|
| 정렬 | `sortBy: earliest` 고정 | 가장 빨리 볼 수 있는 순. 정렬 버튼은 디자인에서 뺌 |
| 상영 전 여유 시간 | 사용자 설정 없음. `meta.policy.bufferMinutes`를 상세 화면에 표시 | 서버 정책값이라 요청으로 못 바꿈 |
| 출발 날짜 | 오늘만, 시간만 고름 | MVP는 오늘 영업일만 허용 |
| 출발지 검색 | 미리 정한 장소 목록(`src/lib/places.ts`) + 현재 위치 | 백엔드에 주소→좌표 변환 없음. **TODO: 카카오 로컬 API** |
| 지도 | 가짜 배경 지도(`MapView`) | **TODO: 카카오/네이버 지도 SDK**. props는 그대로 두고 내부만 교체 |
| 포스터 | `posterUrl` 없으면 제목 카드 | 샘플 데이터는 포스터 없음 |
| 상영관·포맷·좌석 | 표시 안 함 | 디자인 결정 |
| 길찾기 | `directionsUrl`, 없으면 카카오맵 웹 길찾기 | |
| 예매 | 회차 `bookingUrl`, 없으면 안내 토스트 | |

## 상태 표시 (명세 4절)

| 서버 값 | 화면 |
|---|---|
| `outcome: recommended` | 지도 핀 + 카드 목록 |
| `no_feasible_showtime` | "관람 가능한 회차가 없어요" + 조건 변경 |
| `no_route_confirmed` | "이동시간을 확인하지 못했어요" + 다시 시도 |
| `not_showing` | "오늘 상영하는 영화관이 없어요" + 영화 변경 |
| `availability_unknown` | "상영 정보를 확인하지 못했어요 (미상영 아님)" + 다시 시도 |
| `unroutableCinemas` | "확인이 필요한 영화관" (회색 핀 `?`) |
| `unreachableCinemas` | "시간 안에 갈 수 없는 영화관" (흐리게) |
| `notices` | 목록 위 안내 줄 |
| 400 `departure_out_of_range` | "출발 시각을 확인해 주세요" + 조건 변경 |
