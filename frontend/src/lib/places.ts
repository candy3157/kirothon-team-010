// 출발지 직접 선택용 장소 목록.
// 백엔드는 주소→좌표 변환을 하지 않으므로(명세 5절 #6) 지금은 미리 정한 장소만 고른다.
// TODO: 카카오 로컬 API(키워드 검색) 연동으로 교체.
export interface Place {
  label: string;
  latitude: number;
  longitude: number;
}

export const PLACES: Place[] = [
  { label: '강남역', latitude: 37.4979, longitude: 127.0276 },
  { label: '잠실역', latitude: 37.5133, longitude: 127.1001 },
  { label: '서울역', latitude: 37.5547, longitude: 126.9707 },
  { label: '홍대입구역', latitude: 37.5572, longitude: 126.9245 },
  { label: '성수역', latitude: 37.5446, longitude: 127.0559 },
  { label: '여의도역', latitude: 37.5216, longitude: 126.9243 },
  { label: '수원역', latitude: 37.2656, longitude: 127.0000 },
  { label: '부산 서면역', latitude: 35.1578, longitude: 129.0597 },
  { label: '부산 센텀시티역', latitude: 35.1690, longitude: 129.1318 },
];
