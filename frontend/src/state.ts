import type { Movie, TransportMode } from './api/types';
import type { IconName } from './components/Icon';

export interface Origin {
  latitude: number;
  longitude: number;
  label: string;
  /** 브라우저 현재 위치로 얻었는지 */
  fromGeo?: boolean;
}

/** 화면 사이에 유지하는 검색 조건 (UX 명세 6장 SearchContext) */
export interface SearchContext {
  movie: Movie | null;
  origin: Origin | null;
  transportMode: TransportMode;
  /** 'now' 또는 "YYYY-MM-DDTHH:mm" (서울 시각, 오늘부터 7일) */
  departure: 'now' | string;
  /** 상영 전 도착 여유(분). −/+ 로 5분씩, 0–40분 */
  bufferMinutes: number;
}

export const initialContext: SearchContext = {
  movie: null,
  origin: null,
  transportMode: 'transit',
  departure: 'now',
  bufferMinutes: 10,
};

export const MODE: Record<TransportMode, { label: string; icon: IconName }> = {
  transit: { label: '대중교통', icon: 'train' },
  car: { label: '자동차', icon: 'car' },
  walk: { label: '도보', icon: 'walk' },
};

/** 조건이 바뀌었는지 비교하는 키 */
export const contextKey = (c: SearchContext) =>
  JSON.stringify([c.movie?.movieId, c.origin?.latitude, c.origin?.longitude, c.transportMode, c.departure, c.bufferMinutes]);
