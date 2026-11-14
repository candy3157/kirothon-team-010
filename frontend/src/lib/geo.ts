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

/** 길찾기 링크가 없을 때 쓰는 카카오맵 웹 길찾기 */
export function kakaoDirectionsUrl(name: string, at: Coordinates): string {
  return `https://map.kakao.com/link/to/${encodeURIComponent(name)},${at.latitude},${at.longitude}`;
}
