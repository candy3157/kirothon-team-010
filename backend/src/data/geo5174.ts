/**
 * EPSG:5174 (Korean 1985 / Modified Central Belt, Bessel 1841) -> WGS84 위경도.
 * 지방행정 인허가 데이터(문화_영화상영관.csv)의 좌표정보(X), 좌표정보(Y)가 이 좌표계다.
 *
 * proj4 정의:
 *   +proj=tmerc +lat_0=38 +lon_0=127.0028902777778 +k=1 +x_0=200000 +y_0=500000
 *   +ellps=bessel +towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43
 * 1) 횡단 메르카토르 역변환(Snyder, Map Projections 1987, 식 8-18~8-25)으로 Bessel 위경도를 구하고
 * 2) 7변수 Helmert(position vector)로 WGS84 지심좌표로 옮긴 뒤 위경도로 바꾼다.
 */

const DEG = Math.PI / 180;
const ARCSEC = DEG / 3600;

const BESSEL = { a: 6377397.155, f: 1 / 299.1528128 };
const WGS84 = { a: 6378137, f: 1 / 298.257223563 };

const LAT0 = 38 * DEG;
const LON0 = 127.0028902777778 * DEG;
const K0 = 1;
const X0 = 200000;
const Y0 = 500000;

const TOWGS84 = { tx: -115.8, ty: 474.99, tz: 674.11, rx: 1.16, ry: -2.31, rz: -1.63, ppm: 6.43 };

const e2Of = (f: number) => 2 * f - f * f;

/** 적도에서 위도 phi까지 자오선 호 길이 */
function meridianArc(phi: number, a: number, e2: number): number {
  const e4 = e2 * e2;
  const e6 = e4 * e2;
  return (
    a *
    ((1 - e2 / 4 - (3 * e4) / 64 - (5 * e6) / 256) * phi -
      ((3 * e2) / 8 + (3 * e4) / 32 + (45 * e6) / 1024) * Math.sin(2 * phi) +
      ((15 * e4) / 256 + (45 * e6) / 1024) * Math.sin(4 * phi) -
      ((35 * e6) / 3072) * Math.sin(6 * phi))
  );
}

/** TM 역변환: 평면좌표(m) -> Bessel 위경도(rad) */
function tmInverse(x: number, y: number): { lat: number; lon: number } {
  const { a, f } = BESSEL;
  const e2 = e2Of(f);
  const ep2 = e2 / (1 - e2);
  const e4 = e2 * e2;
  const e6 = e4 * e2;

  const m = meridianArc(LAT0, a, e2) + (y - Y0) / K0;
  const mu = m / (a * (1 - e2 / 4 - (3 * e4) / 64 - (5 * e6) / 256));
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const phi1 =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);

  const sin1 = Math.sin(phi1);
  const cos1 = Math.cos(phi1);
  const tan1 = Math.tan(phi1);
  const c1 = ep2 * cos1 * cos1;
  const t1 = tan1 * tan1;
  const w = 1 - e2 * sin1 * sin1;
  const n1 = a / Math.sqrt(w);
  const r1 = (a * (1 - e2)) / w ** 1.5;
  const d = (x - X0) / (n1 * K0);

  const lat =
    phi1 -
    ((n1 * tan1) / r1) *
      (d ** 2 / 2 -
        ((5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * ep2) * d ** 4) / 24 +
        ((61 + 90 * t1 + 298 * c1 + 45 * t1 ** 2 - 252 * ep2 - 3 * c1 ** 2) * d ** 6) / 720);
  const lon =
    LON0 +
    (d - ((1 + 2 * t1 + c1) * d ** 3) / 6 + ((5 - 2 * c1 + 28 * t1 - 3 * c1 ** 2 + 8 * ep2 + 24 * t1 ** 2) * d ** 5) / 120) /
      cos1;
  return { lat, lon };
}

function toGeocentric(lat: number, lon: number, a: number, f: number): [number, number, number] {
  const e2 = e2Of(f);
  const n = a / Math.sqrt(1 - e2 * Math.sin(lat) ** 2);
  return [n * Math.cos(lat) * Math.cos(lon), n * Math.cos(lat) * Math.sin(lon), n * (1 - e2) * Math.sin(lat)];
}

function fromGeocentric(x: number, y: number, z: number, a: number, f: number): { lat: number; lon: number } {
  const e2 = e2Of(f);
  const lon = Math.atan2(y, x);
  const p = Math.hypot(x, y);
  let lat = Math.atan2(z, p * (1 - e2));
  for (let i = 0; i < 6; i++) {
    const n = a / Math.sqrt(1 - e2 * Math.sin(lat) ** 2);
    const h = p / Math.cos(lat) - n;
    lat = Math.atan2(z, p * (1 - (e2 * n) / (n + h)));
  }
  return { lat, lon };
}

/** EPSG:5174 평면좌표(m) -> WGS84 { latitude, longitude } (도) */
export function epsg5174ToWgs84(x: number, y: number): { latitude: number; longitude: number } {
  const b = tmInverse(x, y);
  const [X, Y, Z] = toGeocentric(b.lat, b.lon, BESSEL.a, BESSEL.f);
  const { tx, ty, tz } = TOWGS84;
  const rx = TOWGS84.rx * ARCSEC;
  const ry = TOWGS84.ry * ARCSEC;
  const rz = TOWGS84.rz * ARCSEC;
  const s = 1 + TOWGS84.ppm * 1e-6;
  // position vector 규약 (proj4 towgs84와 같음)
  const X2 = tx + s * (X - rz * Y + ry * Z);
  const Y2 = ty + s * (rz * X + Y - rx * Z);
  const Z2 = tz + s * (-ry * X + rx * Y + Z);
  const w = fromGeocentric(X2, Y2, Z2, WGS84.a, WGS84.f);
  return { latitude: w.lat / DEG, longitude: w.lon / DEG };
}
