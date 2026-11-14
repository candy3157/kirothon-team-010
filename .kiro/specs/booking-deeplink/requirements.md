# 공식 예매 사이트 바로가기(딥링크) 명세

> 작성일: 2026-11-14 · 기준 명세: `.kiro/specs/cinema-recommendation/requirements.md` (v1.2)
> 선행 작업: `.kiro/specs/real-movie-data/requirements.md` (이 작업이 끝난 뒤 실행한다)
> 이 문서는 Kiro Crew Task Runner 입력용이다.

## 0. 작업 환경 (반드시 지킬 것)

- **작업 폴더:** `C:\Users\tkwk9\workplace\kirothon-team-010` (git 레포). 다른 폴더에 새 프로젝트를 만들지 않는다.
- **브랜치:** `feature/booking-deeplink`. 시작할 때 `feature/real-movie-data`가 push된 상태인지 확인하고, 그 위에서 `git switch -c feature/booking-deeplink`로 만든다. `develop` 브랜치는 건드리지 않는다.
- **push:** 마지막 단계에서만 `git push origin feature/booking-deeplink`. `main`에는 push하지 않는다.
- **비밀값:** `backend/.env`, `frontend/.env.local`을 읽거나 출력하거나 커밋하지 않는다.
- **외부 사이트:** 예매 사이트를 자동으로 긁거나(크롤링), 로그인하거나, 비공개 API를 부르지 않는다. 이 작업은 **사용자가 버튼을 누르면 공식 사이트를 새 탭으로 여는 링크**만 만든다. 남은 좌석은 사용자가 그 공식 페이지에서 직접 본다.

## 1. 목표

추천 결과의 회차(또는 영화관)에서 "예매하러 가기"를 누르면, 해당 브랜드(CGV·롯데시네마·메가박스)의 공식 예매 페이지가 열리고 **가능한 만큼 미리 선택된 상태**(영화관 → 영화 → 날짜 → 회차 순)로 이동한다. 미리 선택할 수 없는 값은 건너뛰고, 최소한 그 브랜드의 공식 예매 첫 화면으로는 반드시 간다.

`도착 가능 ≠ 예매 가능` 원칙은 유지한다. 버튼 근처에 "남은 좌석은 예매 사이트에서 확인하세요"를 표시한다.

## 2. 기능 요구사항

### FR-1 링크 템플릿 (백엔드)
- `backend/data/booking-links.json`에 브랜드별 템플릿을 둔다. 예:
  ```json
  {
    "cgv": {
      "fallback": "https://cgv.co.kr/cnm/movieBook/movie",
      "levels": {
        "cinema":   "미확인",
        "movie":    "미확인",
        "date":     "미확인",
        "showtime": "미확인"
      },
      "allowedHosts": ["cgv.co.kr", "www.cgv.co.kr", "m.cgv.co.kr"]
    }
  }
  ```
  - `levels`는 미리 선택할 수 있는 단계별 URL 템플릿이다 (`{cinemaCode}`, `{movieCode}`, `{date}`(YYYYMMDD), `{time}` 같은 자리표시자).
  - 확인하지 못한 단계는 `"미확인"`으로 둔다. 코드는 확인된 가장 깊은 단계를 쓰고, 하나도 없으면 `fallback`을 쓴다.
- 자리표시자에 들어가는 값은 `encodeURIComponent`로 넣는다. 결과 URL이 `https://`이고 호스트가 `allowedHosts` 안일 때만 응답에 넣는다. 아니면 `fallback`.
- 지점 코드·영화 코드는 `backend/data/cinema-map.json`(선행 작업에서 만든 파일)에 브랜드 코드 필드를 추가해 읽는다. 코드가 없으면 그 단계는 건너뛴다.

### FR-2 템플릿 확인 (공식 사이트에서 직접)
- 각 브랜드 공식 예매 사이트를 브라우저로 열어 보고, 영화관·영화·날짜를 고를 때 주소창 URL이 어떻게 바뀌는지 기록한다. 확인 방법과 날짜를 `docs/booking-links.md`에 적는다.
- **URL에 값이 나타나지 않는 단계(사이트 안에서만 상태가 바뀌는 경우)는 "미확인/불가"로 적고 템플릿을 만들지 않는다.** 추측한 파라미터를 넣지 않는다.
- 확인한 템플릿마다 실제 지점 1곳으로 열어 본 결과(성공/실패)를 표로 남긴다.

### FR-3 API 응답
- `Showtime.bookingUrl`(이미 있음)을 FR-1 규칙으로 채운다.
- 영화관 단위 링크 `cinemas[].bookingUrl`(회차 선택 전 영화관만 고른 링크)을 추가한다. 없으면 `null`.
- `bookingUrl`이 어느 단계까지 미리 선택하는지 `bookingLevel`(`showtime` | `date` | `movie` | `cinema` | `home`)을 함께 준다.
- 계약이 바뀌므로 `docs/openapi.yaml` 버전을 올리고 변경 이력·예제·계약 테스트를 갱신한다.

### FR-4 프론트엔드
- `frontend/src/components/TheaterDetail.tsx`의 회차 선택 영역에 "예매하러 가기" 버튼을 둔다. 선택한 회차의 `bookingUrl`, 없으면 영화관 `bookingUrl`을 쓴다.
- 새 탭으로 연다: `target="_blank"`, `rel="noopener noreferrer"`.
- `bookingLevel`이 `showtime`이 아니면 버튼 아래에 어디까지 선택되는지 안내한다. 예: "CGV 강남 페이지로 이동해요. 영화와 시간은 직접 골라 주세요."
- 버튼 근처에 "남은 좌석은 예매 사이트에서 확인하세요"를 항상 표시한다.
- 링크가 하나도 없으면 버튼을 숨기지 말고 비활성화하고 이유를 보여 준다.

## 3. 품질 요구사항

- 백엔드 단위 테스트: 템플릿 단계 선택(가장 깊은 확인 단계 사용), 미확인 단계 건너뛰기, 코드 없음 → 상위 단계, 허용 호스트 밖 → fallback, `http://` → fallback, 자리표시자 인코딩(공백·한글·`&`), 심야 회차 `25:10`의 날짜는 영업일이 아닌 **실제 날짜**인지 사이트 규칙을 문서에 적고 테스트한다.
- 프론트 테스트: 링크 선택 규칙(회차 → 영화관 → 없음), 안내 문구.
- 기존 테스트는 모두 통과한다.

## 4. 단계

1. 선행 작업 결과 확인(`feature/real-movie-data` push 여부, `cinema-map.json` 형식), 새 브랜치 생성.
2. 브랜드별 공식 예매 사이트 URL 규칙 확인과 `docs/booking-links.md` 작성 (FR-2).
3. `booking-links.json`과 링크 생성 모듈 구현, 테스트.
4. 추천 응답에 `bookingUrl`, `bookingLevel`, `cinemas[].bookingUrl` 연결, OpenAPI·예제·계약 테스트 갱신.
5. 프론트 버튼·안내 구현, 테스트.
6. 검증: `backend`와 `frontend`에서 각각 `npm test`, `npx tsc --noEmit` 통과.
7. `BUILD_REPORT.md`에 추가(사용한 Kiro 기능: Task Runner), 커밋, `git push origin feature/booking-deeplink`.

## 5. 완료 조건

- 두 폴더 모두 `npm test`, `npx tsc --noEmit` 통과.
- 세 브랜드 모두 최소 `home`(공식 예매 첫 화면) 링크가 나온다.
- 확인된 단계만 템플릿에 있고, 확인 근거가 `docs/booking-links.md`에 있다.
- `feature/booking-deeplink`가 push되었다.

## 6. 하지 않을 것

- 남은 좌석 조회, 예매 사이트 크롤링, 로그인 자동화, 비공개 API 호출.
- 사이트 안에서 자동 클릭·입력(스크립트 주입)으로 선택을 흉내 내는 것.
- `main` push, `develop` 수정.
