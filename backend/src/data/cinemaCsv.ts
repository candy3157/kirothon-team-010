import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { Cinema } from '../types.js';
import { epsg5174ToWgs84 } from './geo5174.js';

/**
 * 지방행정 인허가 데이터 "문화_영화상영관.csv"를 영화관 목록으로 바꾼다.
 * - 한 행은 상영관(1관, 2관 …) 하나다. 같은 좌표 + 같은 브랜드(독립관은 같은 이름)를 영화관 하나로 묶는다.
 * - 영업상태명이 '영업/정상'인 행만 쓴다. 좌표가 없거나 한국 밖이면 버린다.
 * - 좌표는 EPSG:5174 -> WGS84로 바꾼다.
 */

export type Brand = 'cgv' | 'lotte' | 'megabox' | 'other';

export interface CinemaRecord extends Cinema {
  brand: Brand;
  /** 묶인 상영관 수 */
  screens: number;
}

export interface CinemaLoadStats {
  rows: number;
  active: number;
  noCoord: number;
  outOfRange: number;
  cinemas: number;
}

const COL = {
  status: '영업상태명',
  name: '사업장명',
  road: '도로명주소',
  lot: '지번주소',
  x: '좌표정보(X)',
  y: '좌표정보(Y)',
} as const;

const ACTIVE = '영업/정상';

/** UTF-8이면 그대로, 아니면 CP949(EUC-KR)로 읽는다. 공공데이터 CSV는 보통 CP949다. */
export function decodeCsv(buf: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^\uFEFF/, '');
  } catch {
    return new TextDecoder('euc-kr').decode(buf);
  }
}

/** RFC 4180 CSV 파서 (따옴표 안의 쉼표·줄바꿈·"" 처리) */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

export function brandOf(name: string): Brand {
  if (/CGV|씨지브이/i.test(name)) return 'cgv';
  if (/롯데/.test(name)) return 'lotte';
  if (/메가박스/.test(name)) return 'megabox';
  return 'other';
}

const SPECIAL_HALL =
  /\s+(르\s?리클라이너|리클라이너|COMFORT|DOLBY\s?CINEMA관?|돌비\s?시네마|샤롯데|SCREENX|IMAX|4DX|MX4D|MX|SWEETBOX|스위트박스|부티크|더\s?부티크|프라이빗|골드클래스|씨네드쉐프|템퍼시네마|씨네앤포레|씨네키즈|수퍼플렉스|슈퍼플렉스|컴포트).*$/i;

/** 상영관 이름에서 영화관 이름만 남긴다. 예: "메가박스중앙(주) 송도지점 DOLBY CINEMA관" -> "메가박스 송도" */
export function cinemaName(raw: string): string {
  let s = raw.replace(/\s+/g, ' ').trim();
  s = s.replace(/\[[^\]]*\]/g, ' ');
  s = s.replace(/\(주\)|㈜|주식회사/g, ' ');
  s = s.replace(/메가박스\s?(중앙|씨네플렉스)/g, '메가박스');
  s = s.replace(/롯데컬처웍스/g, '롯데시네마');
  s = s.replace(/씨지브이/g, 'CGV');
  s = s.replace(/\s+/g, ' ').trim();
  s = s.replace(/\s*\(?\s*제?\s*\d+\s*관\s*\)?.*$/, ''); // 5관, (제1관), 제7관, 3관(4DX)
  s = s.replace(SPECIAL_HALL, '');
  s = s.replace(/\s*\([^)]*\)\s*$/, ''); // 끝의 (4DX) 같은 괄호
  s = s.replace(/지점$/, '').replace(/(\S)점$/, '$1');
  s = s.replace(/^(CGV|롯데시네마|메가박스)(?=\S)/, '$1 ');
  s = s.replace(/\s+/g, ' ').trim();
  return s || raw.trim();
}

/** 도로명주소에서 층·호 같은 상세를 뺀 기본 주소 */
export function baseAddress(road: string, lot: string): string {
  const src = road.trim() || lot.trim();
  return src.split(',')[0]!.replace(/\s*\([^)]*\)\s*$/, '').replace(/\s+/g, ' ').trim();
}

const inKorea = (lat: number, lng: number) => lat >= 32 && lat <= 39.5 && lng >= 124 && lng <= 132.5;

function mostCommon(names: string[]): string {
  const count = new Map<string, number>();
  for (const n of names) count.set(n, (count.get(n) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length || a[0].localeCompare(b[0]))[0]![0];
}

/** CSV 텍스트 -> 영화관 목록 */
export function cinemasFromCsv(text: string): { cinemas: CinemaRecord[]; stats: CinemaLoadStats } {
  const [header, ...rows] = parseCsv(text);
  if (!header) throw new Error('영화관 CSV가 비어 있습니다.');
  const idx = Object.fromEntries(Object.entries(COL).map(([k, v]) => [k, header.findIndex((h) => h.trim() === v)])) as Record<
    keyof typeof COL,
    number
  >;
  const missing = Object.entries(idx).filter(([, i]) => i < 0);
  if (missing.length) throw new Error(`영화관 CSV에 필요한 열이 없습니다: ${missing.map(([k]) => COL[k as keyof typeof COL]).join(', ')}`);

  const stats: CinemaLoadStats = { rows: rows.length, active: 0, noCoord: 0, outOfRange: 0, cinemas: 0 };
  const groups = new Map<string, { names: string[]; address: string; brand: Brand; x: number; y: number }>();

  for (const r of rows) {
    if ((r[idx.status] ?? '').trim() !== ACTIVE) continue;
    stats.active++;
    const xs = (r[idx.x] ?? '').trim();
    const ys = (r[idx.y] ?? '').trim();
    const x = Number(xs);
    const y = Number(ys);
    if (!xs || !ys || !Number.isFinite(x) || !Number.isFinite(y)) {
      stats.noCoord++;
      continue;
    }
    const raw = (r[idx.name] ?? '').trim();
    const name = cinemaName(raw);
    const brand = brandOf(raw);
    const key = `${xs},${ys}|${brand === 'other' ? name : brand}`;
    const g = groups.get(key);
    if (g) g.names.push(name);
    else groups.set(key, { names: [name], address: baseAddress(r[idx.road] ?? '', r[idx.lot] ?? ''), brand, x, y });
  }

  const cinemas: CinemaRecord[] = [];
  for (const [key, g] of groups) {
    const { latitude, longitude } = epsg5174ToWgs84(g.x, g.y);
    if (!inKorea(latitude, longitude)) {
      stats.outOfRange++;
      continue;
    }
    cinemas.push({
      cinemaId: `cin_${createHash('sha1').update(key).digest('hex').slice(0, 12)}`,
      name: mostCommon(g.names),
      address: g.address,
      location: { latitude: Math.round(latitude * 1e6) / 1e6, longitude: Math.round(longitude * 1e6) / 1e6 },
      brand: g.brand,
      screens: g.names.length,
    });
  }
  cinemas.sort((a, b) => a.cinemaId.localeCompare(b.cinemaId));
  stats.cinemas = cinemas.length;
  return { cinemas, stats };
}

export async function loadCinemasCsv(path: string): Promise<{ cinemas: CinemaRecord[]; stats: CinemaLoadStats }> {
  return cinemasFromCsv(decodeCsv(await readFile(path)));
}
