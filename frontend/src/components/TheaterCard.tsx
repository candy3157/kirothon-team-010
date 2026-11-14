import type { Coordinates, RankedCinema } from '../api/types';
import { distanceKm } from '../lib/geo';
import { representative } from '../lib/recommend';
import { clockTime, diffMin, hm, pad2, wholeMin } from '../lib/time';
import { MODE } from '../state';
import { Icon } from './Icon';

interface Props {
  cinema: RankedCinema;
  origin: Coordinates;
  departureTime: string;
  badges: string[];
  selected: boolean;
  onClick: () => void;
}

/**
 * 01  CGV 강남 [가장 빠른 관람] [가장 가까움]     상영시간
 *     0.4km                                        19:40
 *     19:12 ━━━━━━(이동, 빨강)━━━|━━━━(대기)━━━ 19:40
 *           [🚇 14분 소요]               [19:26 도착]
 */
export function TheaterCard({ cinema: c, origin, departureTime, badges, selected, onClick }: Props) {
  const rep = representative(c);
  if (!rep) return null;
  const total = Math.max(1, diffMin(rep.startTime, departureTime));
  const travelPct = Math.min(100, Math.max(4, (c.travelMinutes / total) * 100));

  return (
    <button className={`card ${selected ? 'sel' : ''}`} onClick={onClick} aria-label={`${c.rank}위 ${c.name}`}>
      <div className="row1">
        <span className="rank">{pad2(c.rank)}</span>
        <div className="nm">
          <span className="nm-line">
            {c.name}
            {badges.map((b) => (
              <span key={b} className="badge">
                {b}
              </span>
            ))}
          </span>
          <small>{distanceKm(origin, c.location).toFixed(1)}km</small>
        </div>
        <div className="start">
          <small>상영시간</small>
          <b>{clockTime(rep.businessTime)}</b>
        </div>
      </div>

      <div className="tl">
        <div className="tl-bar">
          <span>{hm(departureTime)}</span>
          <div className="tl-track" aria-hidden="true">
            <i className="tl-go" style={{ width: `${travelPct}%` }} />
            <i className="tl-mark" style={{ left: `${travelPct}%` }} />
          </div>
          <span>{clockTime(rep.businessTime)}</span>
        </div>
        <div className="tl-tags">
          <span className="tag travel">
            <Icon name={MODE[c.transportMode].icon} /> {wholeMin(c.travelMinutes)}분 소요
          </span>
          <span className="tag">{hm(c.arrivalTime)} 도착</span>
        </div>
      </div>
    </button>
  );
}
