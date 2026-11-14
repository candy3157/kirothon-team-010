import type { Coordinates } from '../api/types';

/** 두 좌표 사이 직선거리(km) */
export function distanceKm(a: Coordinates, b: Coordinates): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** 출발지 기준 동·북 방향 km 오프셋 (지도 투영용 근사) */
export function offsetKm(origin: Coordinates, p: Coordinates): { x: number; y: number } {
  const kmPerLng = 111.32 * Math.cos((origin.latitude * Math.PI) / 180);
  return {
    x: (p.longitude - origin.longitude) * kmPerLng,
    y: (p.latitude - origin.latitude) * 110.57,
  };
}

export type DirectionsMode = 'car' | 'transit' | 'walk';

/** 이름 안의 쉼표·슬래시는 네이버 길찾기 주소의 구분자와 겹쳐서 공백으로 바꾼다. */
const pathName = (s: string) => encodeURIComponent(s.replace(/[,/]/g, ' ').replace(/\s+/g, ' ').trim() || '위치');

/**
 * 네이버 지도 웹 길찾기.
 * 형식: https://map.naver.com/p/directions/{경도},{위도},{이름},,/{경도},{위도},{이름},,/-/{car|transit|walk}
 * 네이버 공식 문서에 없는 웹 주소 규칙이다. 네이버가 바꾸면 깨질 수 있으니 바뀌면 이 함수만 고친다.
 */
export function naverDirectionsUrl(
  from: Coordinates & { label?: string },
  to: Coordinates & { name: string },
  mode: DirectionsMode,
): string {
  const pt = (p: Coordinates, name: string) => `${p.longitude},${p.latitude},${pathName(name)},,`;
  return `https://map.naver.com/p/directions/${pt(from, from.label ?? '출발')}/${pt(to, to.name)}/-/${mode}`;
}
