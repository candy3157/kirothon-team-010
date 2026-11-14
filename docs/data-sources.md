# 데이터 출처

`backend/.env`의 `SHOWTIME_PROVIDER`로 고른다.

| 값 | 영화 | 영화관 | 회차 | 응답 `source` |
|---|---|---|---|---|
| `sample` (기본) | 샘플 4편 | 샘플 4곳 | 샘플 | `sample` |
| `real` | TMDB 현재 상영작 | 인허가 CSV | **데모(가짜)** | `sample` |

`real`도 회차가 가짜이므로 `source`는 `sample`이다. 실제 상영 정보로 오해하지 않게 하려는 것이다.

## 영화: TMDB

- 목록: `GET /movie/now_playing?language=ko-KR&region=KR&page=1..2` (최대 40편)
- 상세: `GET /movie/{id}?language=ko-KR` → `runtime`, `poster_path`
- 포스터: `TMDB_IMAGE_URL` + `poster_path` (기본 `https://image.tmdb.org/t/p/w342`)
- 인증: `TMDB_API_KEY`가 `eyJ`로 시작하면 v4 읽기 토큰(`Authorization: Bearer`), 아니면 v3 키(`api_key` 쿼리)
- `movieId` = `tmdb_<id>`
- 캐시: 목록 10분, 상세 24시간. 실패하면 이전 목록을 쓰고, 없으면 `unknown`.
- 문서: [now_playing](https://developer.themoviedb.org/reference/movie-now-playing-list), [details](https://developer.themoviedb.org/reference/movie-details), [images](https://developer.themoviedb.org/docs/image-basics)
- TMDB 이용 조건에 따라 화면 어딘가에 TMDB 출처 표시가 필요하다 (남은 일).

## 영화관: 지방행정 인허가 "문화_영화상영관" CSV

- 파일: `backend/data/cinemas.csv` (`CINEMA_CSV_PATH`로 변경). CP949 그대로 둔다.
- 한 행 = 상영관 하나. **같은 좌표 + 같은 브랜드**(CGV·롯데시네마·메가박스)를 영화관 하나로 묶는다. 독립관은 같은 좌표 + 같은 이름으로 묶는다.
- `영업상태명`이 `영업/정상`인 행만 쓴다. 좌표가 없으면 뺀다.
- 이름은 상영관 표기를 지운다. 예: `메가박스중앙(주) 송도지점 DOLBY CINEMA관` → `메가박스 송도`.
- 주소는 `도로명주소`에서 층·호를 뺀 값. 없으면 `지번주소`.
- 좌표 `좌표정보(X)`, `좌표정보(Y)`는 EPSG:5174(Bessel, 중부원점 TM)로 보고 WGS84로 바꾼다 (`backend/src/data/geo5174.ts`).
- `cinemaId` = `cin_` + sha1(좌표|브랜드 또는 이름) 앞 12자리. 같은 파일이면 항상 같다.

## 회차: 데모

공개 출처가 없어서 `backend/src/data/real.ts`가 만든다. 실제 상영 정보가 아니다.

- 영화관마다 트는 영화를 해시로 고른다. 인기 순위가 높을수록 많은 곳에서 튼다 (멀티플렉스 90%·60%·30%·12%, 독립관 더 적게).
- 하루 2~6회, 09:00~11:50에 시작해 `러닝타임 + 20~50분` 간격, 마지막 시작은 `25:30`까지.
- 같은 영화관·영화·영업일이면 항상 같은 회차가 나온다.
- `bookingUrl`은 `null`.
