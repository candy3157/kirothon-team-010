import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Coordinates, RankedCinema, UnroutableCinema } from '../api/types';
import { distanceKm, offsetKm } from '../lib/geo';
import { representative } from '../lib/recommend';
import { loadNaverMaps, naverMapScriptUrl, onNaverAuthFailure, type NaverMapState } from '../lib/naverMap';
import { clockTime, pad2 } from '../lib/time';
import { Icon } from './Icon';

interface Props {
  origin: Coordinates;
  cinemas: RankedCinema[];
  unroutable: UnroutableCinema[];
  selectedId: string | null;
  loading: boolean;
  /** 지도 위 UI(요약 바)·바텀시트가 가리는 높이. 선택한 영화관을 보이는 곳 가운데로 옮길 때 쓴다. */
  topInset: number;
  bottomInset: number;
  onSelect: (cinemaId: string) => void;
  onDragged: () => void;
}

/**
 * 추천 지도. VITE_NAVER_MAP_KEY_ID가 있으면 네이버 지도를 쓰고,
 * 키가 없거나 로드·인증에 실패하면 SDK 없이 그린 가짜 배경 지도를 쓴다.
 */
export function MapView(props: Props) {
  const [state, setState] = useState<NaverMapState>(() => (naverMapScriptUrl() ? 'loading' : 'fail'));

  useEffect(() => {
    if (state !== 'loading') return;
    let alive = true;
    loadNaverMaps().then(
      () => alive && setState('ready'),
      () => alive && setState('fail'),
    );
    return () => {
      alive = false;
    };
  }, [state]);

  useEffect(() => onNaverAuthFailure(() => setState('fail')), []);

  return state === 'ready' ? <NaverMapView {...props} /> : <FakeMapView {...props} />;
}

/** 0x0 상자 안에 둔 마커 내용. 기존 .pin/.me CSS가 (0,0)을 기준으로 그려진다. */
function anchorBox(...children: HTMLElement[]): HTMLElement {
  const box = document.createElement('div');
  box.style.cssText = 'position:relative;width:0;height:0';
  box.append(...children);
  return box;
}

function el(tag: string, className: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = className;
  if (text !== undefined) e.textContent = text; // 데이터는 textContent로만 넣는다
  return e;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function NaverMapView({ origin, cinemas, unroutable, selectedId, loading, topInset, bottomInset, onSelect, onDragged }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const originMarker = useRef<any>(null);
  const markers = useRef<any[]>([]);
  const cb = useRef({ onSelect, onDragged });
  cb.current = { onSelect, onDragged };
  const N = window.naver!.maps;
  const ll = (p: Coordinates) => new N.LatLng(p.latitude, p.longitude);

  // 지도는 한 번만 만든다. 개발 모드(StrictMode)는 effect를 두 번 돌리므로,
  // destroy()한 요소를 다시 쓰지 않도록 실행마다 새 상자를 만든다.
  useEffect(() => {
    const host = document.createElement('div');
    host.style.cssText = 'position:absolute;inset:0';
    ref.current!.appendChild(host);
    const map = new N.Map(host, {
      center: ll(origin),
      zoom: 13,
      scaleControl: false,
      mapDataControl: false,
      zoomControl: false,
      logoControlOptions: { position: N.Position.BOTTOM_LEFT },
    });
    mapRef.current = map;
    const l = N.Event.addListener(map, 'dragend', () => cb.current.onDragged());
    return () => {
      N.Event.removeListener(l);
      markers.current.forEach((m) => m.setMap(null));
      originMarker.current?.setMap(null);
      map.destroy();
      host.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 출발 위치 마커
  useEffect(() => {
    originMarker.current?.setMap(null);
    originMarker.current = new N.Marker({
      map: mapRef.current,
      position: ll(origin),
      zIndex: 10,
      icon: { content: anchorBox(el('div', 'me'), el('div', 'me-label', '출발')), anchor: new N.Point(0, 0) },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin.latitude, origin.longitude]);

  // 영화관 마커
  useEffect(() => {
    markers.current.forEach((m) => m.setMap(null));
    markers.current = [];
    if (loading) return;
    const add = (c: Coordinates, id: string, pin: HTMLElement, z: number) => {
      pin.style.cssText = 'left:0;top:0';
      pin.addEventListener('click', (e) => {
        e.stopPropagation();
        cb.current.onSelect(id);
      });
      markers.current.push(
        new N.Marker({
          map: mapRef.current,
          position: ll(c),
          zIndex: z,
          icon: { content: anchorBox(pin), anchor: new N.Point(0, 0) },
        }),
      );
    };
    for (const c of cinemas) {
      const rep = representative(c);
      const sel = selectedId === c.cinemaId;
      const pin = el('button', `pin ${c.rank <= 3 ? 'top' : ''} ${sel ? 'sel' : ''}`);
      pin.setAttribute('aria-label', `${c.rank}위 ${c.name}, ${rep ? clockTime(rep.businessTime) : ''} 상영`);
      pin.append(el('span', 'rk', pad2(c.rank)), document.createTextNode(rep ? clockTime(rep.businessTime) : ''));
      add(c.location, c.cinemaId, pin, sel ? 5 : c.rank <= 3 ? 3 : 1);
    }
    for (const c of unroutable) {
      const sel = selectedId === c.cinemaId;
      const pin = el('button', `pin unk ${sel ? 'sel' : ''}`);
      pin.setAttribute('aria-label', `${c.name}, 이동시간 확인 불가`);
      pin.append(el('span', 'rk', '?'), document.createTextNode('확인 불가'));
      add(c.location, c.cinemaId, pin, sel ? 5 : 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cinemas, unroutable, selectedId, loading]);

  // 결과가 바뀌면 출발지와 모든 영화관이 보이게
  useEffect(() => {
    const map = mapRef.current;
    const pts = [...cinemas, ...unroutable].map((c) => c.location);
    if (!map) return;
    if (pts.length === 0) {
      map.setCenter(ll(origin));
      return;
    }
    const b = new N.LatLngBounds(ll(origin), ll(origin));
    pts.forEach((p) => b.extend(ll(p)));
    map.fitBounds(b, { top: topInset + 40, bottom: bottomInset + 40, left: 40, right: 60 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cinemas, unroutable]);

  // 선택한 영화관을 보이는 영역 가운데로
  useEffect(() => {
    const map = mapRef.current;
    if (!selectedId || !map) return;
    const c = [...cinemas, ...unroutable].find((x) => x.cinemaId === selectedId);
    if (!c) return;
    const proj = map.getProjection();
    const o = proj.fromCoordToOffset(ll(c.location));
    const d = (topInset - bottomInset) / 2; // 보이는 영역 가운데가 화면 가운데보다 아래로 d px
    map.panTo(proj.fromOffsetToCoord(new N.Point(o.x, o.y - d)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const zoomBy = (step: number) => {
    const map = mapRef.current;
    if (map) map.setZoom(map.getZoom() + step, true);
  };

  return (
    <>
      <div ref={ref} className="map naver" aria-hidden="true" />
      <div className="map-tools" style={{ top: topInset + 14 }}>
        <button aria-label="확대" onClick={() => zoomBy(1)}>
          <Icon name="plus" />
        </button>
        <button aria-label="축소" onClick={() => zoomBy(-1)}>
          <Icon name="minus" />
        </button>
        <button aria-label="출발 위치로" onClick={() => mapRef.current?.panTo(ll(origin))}>
          <Icon name="target" />
        </button>
      </div>
    </>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** SDK 없이 그린 가짜 배경 지도 (키가 없을 때) */
function FakeMapView({ origin, cinemas, unroutable, selectedId, loading, topInset, bottomInset, onSelect, onDragged }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; px: number; py: number; moved: boolean } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current!;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 모든 영화관이 들어오도록 축척을 정한다 (최소 3km)
  const maxKm = useMemo(() => {
    const all = [...cinemas, ...unroutable].map((c) => distanceKm(origin, c.location));
    return Math.max(3, ...all) * 1.15;
  }, [origin, cinemas, unroutable]);
  const s = (Math.min(size.w, size.h || 1) / 2 / maxKm) * zoom; // px per km
  const proj = (p: Coordinates) => {
    const o = offsetKm(origin, p);
    return { x: o.x * s, y: -o.y * s };
  };

  // 선택한 영화관을 보이는 영역 가운데로
  useEffect(() => {
    if (!selectedId) return;
    const c = [...cinemas, ...unroutable].find((x) => x.cinemaId === selectedId);
    if (!c || !size.h) return;
    const p = proj(c.location);
    const visibleCenter = (topInset + (size.h - bottomInset)) / 2 - size.h / 2;
    setPan({ x: -p.x, y: -p.y + visibleCenter });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // 결과가 바뀌면 처음 위치로
  useEffect(() => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
  }, [cinemas, unroutable]);

  const zoomBy = (f: number) => {
    setZoom((z) => Math.min(4, Math.max(0.4, z * f)));
    setPan((p) => ({ x: p.x * f, y: p.y * f }));
  };

  return (
    <>
      <div
        ref={ref}
        className={`map ${dragging ? 'dragging' : ''}`}
        aria-hidden="true"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('.pin')) return;
          drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y, moved: false };
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const dx = e.clientX - d.x;
          const dy = e.clientY - d.y;
          if (Math.abs(dx) + Math.abs(dy) > 4) {
            d.moved = true;
            setDragging(true);
          }
          setPan({ x: d.px + dx, y: d.py + dy });
        }}
        onPointerUp={() => {
          if (drag.current?.moved) onDragged();
          drag.current = null;
          setDragging(false);
        }}
        onPointerCancel={() => {
          drag.current = null;
          setDragging(false);
        }}
      >
        <div className="world" style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}>
          <FakeMapBg />
          <div className="me" />
          <div className="me-label">출발</div>
          {!loading &&
            cinemas.map((c) => {
              const p = proj(c.location);
              const rep = representative(c);
              return (
                <button
                  key={c.cinemaId}
                  className={`pin ${c.rank <= 3 ? 'top' : ''} ${selectedId === c.cinemaId ? 'sel' : ''}`}
                  style={{ left: p.x, top: p.y }}
                  aria-label={`${c.rank}위 ${c.name}, ${rep ? clockTime(rep.businessTime) : ''} 상영`}
                  onClick={() => onSelect(c.cinemaId)}
                >
                  <span className="rk">{pad2(c.rank)}</span>
                  {rep && clockTime(rep.businessTime)}
                </button>
              );
            })}
          {!loading &&
            unroutable.map((c) => {
              const p = proj(c.location);
              return (
                <button
                  key={c.cinemaId}
                  className={`pin unk ${selectedId === c.cinemaId ? 'sel' : ''}`}
                  style={{ left: p.x, top: p.y }}
                  aria-label={`${c.name}, 이동시간 확인 불가`}
                  onClick={() => onSelect(c.cinemaId)}
                >
                  <span className="rk">?</span>확인 불가
                </button>
              );
            })}
        </div>
      </div>

      <div className="map-tools" style={{ top: topInset + 14 }}>
        <button aria-label="확대" onClick={() => zoomBy(1.3)}>
          <Icon name="plus" />
        </button>
        <button aria-label="축소" onClick={() => zoomBy(1 / 1.3)}>
          <Icon name="minus" />
        </button>
        <button aria-label="출발 위치로" onClick={() => setPan({ x: 0, y: 0 })}>
          <Icon name="target" />
        </button>
      </div>
    </>
  );
}

/** 장식용 가짜 지도 배경 */
function FakeMapBg() {
  const svg = useMemo(() => {
    const rnd = (i: number) => (((i * 9301 + 49297) % 233280) / 233280);
    const roads: string[] = [];
    for (let i = 0; i < 26; i++) {
      const v = -2000 + i * 160 + rnd(i) * 60;
      roads.push(`<line x1="${v}" y1="-2000" x2="${v + rnd(i + 50) * 300 - 150}" y2="2000" stroke="#1d1d1d" stroke-width="${i % 5 === 0 ? 9 : 3}"/>`);
      roads.push(`<line x1="-2000" y1="${v}" x2="2000" y2="${v + rnd(i + 90) * 300 - 150}" stroke="#1d1d1d" stroke-width="${i % 6 === 0 ? 9 : 3}"/>`);
    }
    const parks: string[] = [];
    for (let i = 0; i < 14; i++) {
      parks.push(`<rect x="${rnd(i + 7) * 3600 - 1800}" y="${rnd(i + 19) * 3600 - 1800}" width="${60 + rnd(i + 3) * 140}" height="${50 + rnd(i + 5) * 120}" rx="24" fill="#161616"/>`);
    }
    return `${parks.join('')}${roads.join('')}<path d="M-2000 -260 C -1200 -420, -700 -40, -150 -200 S 700 -520, 1200 -300 S 1800 -160, 2000 -260" stroke="#2a0e12" stroke-width="70" fill="none"/>`;
  }, []);
  return <svg className="bg" viewBox="-2000 -2000 4000 4000" dangerouslySetInnerHTML={{ __html: svg }} />;
}
