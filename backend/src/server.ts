import { existsSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { loadCinemasCsv, type CinemaLoadStats } from './data/cinemaCsv.js';
import type { ShowtimeProvider } from './data/provider.js';
import { RealShowtimeProvider } from './data/real.js';
import { TmdbMovieCatalog } from './data/tmdb.js';
import { NaverPlaceProvider, type PlaceWarning } from './places/provider.js';

// backend/.env가 있으면 읽는다(src/와 dist/ 모두 한 단계 위). 이미 설정된 환경변수는 덮어쓰지 않는다.
const envPath = fileURLToPath(new URL('../.env', import.meta.url));
if (existsSync(envPath)) process.loadEnvFile(envPath);

const config = loadConfig();

// SHOWTIME_PROVIDER=real: 영화는 TMDB, 영화관은 인허가 CSV, 회차는 데모 값.
let provider: ShowtimeProvider | undefined;
let cinemaStats: CinemaLoadStats | undefined;
if (config.realData) {
  const csvPath = isAbsolute(config.realData.cinemaCsvPath)
    ? config.realData.cinemaCsvPath
    : fileURLToPath(new URL(`../${config.realData.cinemaCsvPath}`, import.meta.url));
  const { cinemas, stats } = await loadCinemasCsv(csvPath);
  cinemaStats = stats;
  provider = new RealShowtimeProvider(new TmdbMovieCatalog(config.realData.tmdb), cinemas);
}

// 장소 검색 실패 이유를 남긴다(상태 코드만, 키·검색어 없음). app은 아래에서 만들어진다.
let warn: (w: PlaceWarning) => void = () => {};
const places = new NaverPlaceProvider(config.naver, undefined, (w) => warn(w));
const app = buildApp(
  { logger: true },
  { frontendOrigins: config.frontendOrigins, places, ...(provider ? { provider } : {}) },
);
app.log.info({ showtimeProvider: config.showtimeProvider, cinemas: cinemaStats }, '상영 데이터 설정');
warn = (w) => app.log.warn({ placeSearch: w }, '장소 검색 외부 API 문제');
app.log.info(
  { placeSearch: { local: places.hasLocal, geocode: places.hasGeocode } },
  '장소 검색 설정 (키 값은 기록하지 않음)',
);

try {
  await app.listen({ port: config.port, host: config.host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
