import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { NaverPlaceProvider } from './places/provider.js';

// backend/.env가 있으면 읽는다(src/와 dist/ 모두 한 단계 위). 이미 설정된 환경변수는 덮어쓰지 않는다.
const envPath = fileURLToPath(new URL('../.env', import.meta.url));
if (existsSync(envPath)) process.loadEnvFile(envPath);

const config = loadConfig();

const places = new NaverPlaceProvider(config.naver);
const app = buildApp({ logger: true }, { frontendOrigins: config.frontendOrigins, places });
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
