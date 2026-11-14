import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Coordinates, RankedCinema, UnroutableCinema } from '../api/types';
import { distanceKm, offsetKm } from '../lib/geo';
import { representative } from '../lib/recommend';
import { pad2 } from '../lib/time';
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
 * 추천 지도. 지금은 SDK 없이 그린 가짜 배경 지도다.
 * TODO: 카카오/네이버 지도 SDK로 교체할 때 이 컴포넌트만 바꾸면 된다(props 유지).
 */
export function MapView({ origin, cinemas, unroutable, selectedId, loading, topInset, bottomInset, onSelect, onDragged }: Props) {
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
                  aria-label={`${c.rank}위 ${c.name}, ${rep?.businessTime ?? ''} 상영`}
                  onClick={() => onSelect(c.cinemaId)}
                >
                  <span className="rk">{pad2(c.rank)}</span>
                  {rep?.businessTime}
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
