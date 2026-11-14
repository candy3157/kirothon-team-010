import type { NaverConfig } from '../config.js';

/** 출발지 후보 한 개. 좌표는 WGS84. */
export interface Place {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  /** local = 네이버 지역 검색, geocode = NCP Geocoding */
  source: 'local' | 'geocode';
}

export type PlaceSearchResult =
  | { status: 'ok'; places: Place[] }
  /** 키가 하나도 없어서 검색할 수 없음 */
  | { status: 'not_configured' }
  /** 설정된 외부 API가 모두 실패함 */
  | { status: 'unavailable' };

export interface PlaceSearchProvider {
  search(query: string): Promise<PlaceSearchResult>;
}

export type FetchLike = (url: string, init: { headers: Record<string, string>; signal: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export const PLACE_RESULT_MAX = 5;
const UPSTREAM_TIMEOUT_MS = 3000;

// 대한민국 근처 좌표만 받는다. 잘못된 좌표가 추천 계산에 들어가지 않게 한다.
const inKorea = (lat: number, lng: number) => lat >= 32 && lat <= 39.5 && lng >= 124 && lng <= 132.5;

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" };
/** 지역 검색 title의 <b> 태그와 HTML 엔티티를 지운다. */
export function plainText(s: string): string {
  return s
    .replace(/<[^>]*>/g, '')
    .replace(/&(amp|lt|gt|quot|apos|#39);/g, (_, k: string) => ENTITIES[k] ?? '')
    .trim();
}

/** 지역 검색 mapx/mapy(WGS84 x 1e7 정수 문자열)를 도 단위로 바꾼다. 형식이 다르면 null. */
export function localCoord(mapx: unknown, mapy: unknown): { latitude: number; longitude: number } | null {
  const x = Number(mapx);
  const y = Number(mapy);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const longitude = x / 1e7;
  const latitude = y / 1e7;
  return inKorea(latitude, longitude) ? { latitude, longitude } : null;
}

interface LocalItem {
  title?: unknown;
  address?: unknown;
  roadAddress?: unknown;
  mapx?: unknown;
  mapy?: unknown;
}
interface GeocodeAddress {
  roadAddress?: unknown;
  jibunAddress?: unknown;
  x?: unknown;
  y?: unknown;
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/**
 * 네이버 지역 검색으로 장소 이름을 찾고, 결과가 없으면 NCP Geocoding으로 주소를 찾는다.
 * 키는 요청 헤더에만 쓰고 결과·오류·로그에 담지 않는다.
 */
export class NaverPlaceProvider implements PlaceSearchProvider {
  private readonly fetch: FetchLike;

  constructor(
    private readonly cfg: NaverConfig,
    fetchImpl?: FetchLike,
  ) {
    this.fetch = fetchImpl ?? ((url, init) => globalThis.fetch(url, init));
  }

  get hasLocal(): boolean {
    return !!(this.cfg.searchClientId && this.cfg.searchClientSecret);
  }
  get hasGeocode(): boolean {
    return !!(this.cfg.mapsApiKeyId && this.cfg.mapsApiKey);
  }

  async search(query: string): Promise<PlaceSearchResult> {
    if (!this.hasLocal && !this.hasGeocode) return { status: 'not_configured' };

    let anyOk = false;
    if (this.hasLocal) {
      const local = await this.searchLocal(query);
      if (local) {
        anyOk = true;
        if (local.length > 0) return { status: 'ok', places: local };
      }
    }
    if (this.hasGeocode) {
      const geo = await this.geocode(query);
      if (geo) return { status: 'ok', places: geo };
    }
    return anyOk ? { status: 'ok', places: [] } : { status: 'unavailable' };
  }

  /** 실패하면 null */
  private async getJson(url: URL, headers: Record<string, string>): Promise<unknown | null> {
    try {
      const res = await this.fetch(url.toString(), { headers, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  private async searchLocal(query: string): Promise<Place[] | null> {
    const url = new URL(this.cfg.searchLocalUrl);
    url.searchParams.set('query', query);
    url.searchParams.set('display', String(PLACE_RESULT_MAX));
    const body = (await this.getJson(url, {
      'X-Naver-Client-Id': this.cfg.searchClientId!,
      'X-Naver-Client-Secret': this.cfg.searchClientSecret!,
    })) as { items?: unknown } | null;
    if (!body || !Array.isArray(body.items)) return null;

    const places: Place[] = [];
    for (const it of body.items as LocalItem[]) {
      const c = localCoord(it.mapx, it.mapy);
      const name = plainText(str(it.title));
      if (!c || !name) continue;
      places.push({ name, address: str(it.roadAddress) || str(it.address), ...c, source: 'local' });
    }
    return places.slice(0, PLACE_RESULT_MAX);
  }

  private async geocode(query: string): Promise<Place[] | null> {
    const url = new URL(this.cfg.geocodeUrl);
    url.searchParams.set('query', query);
    url.searchParams.set('count', String(PLACE_RESULT_MAX));
    const body = (await this.getJson(url, {
      'x-ncp-apigw-api-key-id': this.cfg.mapsApiKeyId!,
      'x-ncp-apigw-api-key': this.cfg.mapsApiKey!,
      Accept: 'application/json',
    })) as { status?: unknown; addresses?: unknown } | null;
    if (!body || body.status !== 'OK' || !Array.isArray(body.addresses)) return null;

    const places: Place[] = [];
    for (const a of body.addresses as GeocodeAddress[]) {
      const longitude = Number(a.x);
      const latitude = Number(a.y);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !inKorea(latitude, longitude)) continue;
      const address = str(a.roadAddress) || str(a.jibunAddress);
      if (!address) continue;
      places.push({ name: address, address, latitude, longitude, source: 'geocode' });
    }
    return places.slice(0, PLACE_RESULT_MAX);
  }
}
