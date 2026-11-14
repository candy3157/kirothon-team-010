import { useState } from 'react';
import type { Coordinates, RankedCinema, ResultMeta, Showtime, UnroutableCinema, UnroutableShowtime } from '../api/types';
import { distanceKm, kakaoDirectionsUrl } from '../lib/geo';
import { representative, unarrivableReason } from '../lib/recommend';
import { addMinISO, clockTime, hm, pad2 } from '../lib/time';
import { MODE } from '../state';
import { useConfirmOut, useToast } from './Feedback';
import { Icon } from './Icon';

interface Props {
  cinema: RankedCinema | UnroutableCinema;
  origin: Coordinates;
  meta: ResultMeta;
  movieTitle: string;
  runtimeMinutes?: number | null;
  onBack: () => void;
  onRetry: () => void;
}

const isRanked = (c: RankedCinema | UnroutableCinema): c is RankedCinema => 'rank' in c;
const isJudged = (s: Showtime | UnroutableShowtime): s is Showtime => 'verdict' in s;

/** S04 영화관 상세 · 상영회차 · 예매 · 길찾기 */
export function TheaterDetail({ cinema: c, origin, meta, movieTitle, runtimeMinutes, onBack, onRetry }: Props) {
  const confirmOut = useConfirmOut();
  const toast = useToast();
  const ranked = isRanked(c);
  const now = Date.now();
  const [selId, setSelId] = useState<string | null>(ranked ? representative(c)?.showtimeId ?? null : null);

  const directions = () =>
    confirmOut({
      title: '길찾기로 이동',
      body: (
        <>
          <b>{c.name}</b>까지 길찾기를 엽니다.
        </>
      ),
      url: (ranked && c.directionsUrl) || kakaoDirectionsUrl(c.name, c.location),
    });

  const shows = c.showtimes.filter((s) => Date.parse(s.startTime) > now); // 이미 시작한 회차는 숨김
  const sel = ranked ? c.showtimes.find((s) => s.showtimeId === selId) : undefined;

  return (
    <div className="sheet-body detail">
      <div className="detail-head">
        <button className="back" aria-label="목록으로" onClick={onBack}>
          <Icon name="back" />
        </button>
        <div style={{ flex: 1 }}>
          <h3>
            {ranked && <span className="rank">{pad2(c.rank)}</span>}
            {c.name}
          </h3>
          <p>{c.address}</p>
        </div>
      </div>

      {ranked ? (
        <>
          <div className="travel-box">
            <div>
              <small>{MODE[c.transportMode].label}</small>
              <b>{c.travelMinutes}분</b>
            </div>
            <div>
              <small>예상 도착</small>
              <b>{hm(c.arrivalTime)}</b>
            </div>
            <div>
              <small>거리</small>
              <b>{distanceKm(origin, c.location).toFixed(1)}km</b>
            </div>
          </div>
          <p className="ms hint">상영 {meta.policy.bufferMinutes}분 전 도착 기준 · 예상값</p>
        </>
      ) : (
        <div className="notice warn">
          {c.message || '이동시간을 확인하지 못했어요.'} 관람 가능 여부를 판단할 수 없어요.{' '}
          <button className="btn sm ghost" onClick={onRetry}>
            다시 조회
          </button>
        </div>
      )}

      <div className="section-t shows-t">{movieTitle} · 오늘 상영회차</div>
      {shows.length === 0 ? (
        <p className="ms">남은 회차가 없어요.</p>
      ) : (
        <div className="shows" role="group" aria-label="상영회차">
          {shows.map((s) => {
            const end = runtimeMinutes ? hm(addMinISO(s.startTime, runtimeMinutes)) : null;
            if (!isJudged(s)) {
              return (
                <button key={s.showtimeId} className="showtime" disabled>
                  <b>{clockTime(s.businessTime)}</b>
                  {end && <span className="f">~{end}</span>}
                  <div className="why">도착 시간 확인 불가</div>
                </button>
              );
            }
            const ok = s.verdict === 'arrivable';
            return (
              <button
                key={s.showtimeId}
                className="showtime"
                aria-pressed={s.showtimeId === selId}
                disabled={!ok}
                onClick={() => setSelId(s.showtimeId)}
              >
                <b>{clockTime(s.businessTime)}</b>
                {end && <span className="f">~{end}</span>}
                <div className="why">
                  {ok ? (
                    <span className="ok">
                      <Icon name="check" /> {s.waitMinutes}분 여유
                    </span>
                  ) : (
                    unarrivableReason(s)
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {ranked && sel && sel.verdict === 'arrivable' && (
        <div className="pick-sum">
          <b>{clockTime(sel.businessTime)} 회차 선택</b>
          <br />
          {hm(c.arrivalTime)} 도착 예상 → 상영 <b>{sel.waitMinutes}분 전</b> 도착
          {sel.spareMinutes != null && sel.spareMinutes >= 0 && (
            <>
              <br />
              <span className="ms">
                늦어도 <b>{hm(addMinISO(meta.departureTime, sel.spareMinutes))}</b>에는 출발하세요
              </span>
            </>
          )}
        </div>
      )}

      <p className="ms hint">상영시간표는 바뀔 수 있어요. 예매 페이지 정보가 최종 기준이에요.</p>

      <div className="detail-cta">
        <button className="btn soft-red" onClick={directions}>
          <Icon name="route" /> 길찾기
        </button>
        <button
          className="btn primary"
          disabled={!sel}
          onClick={() => {
            if (!sel) return;
            if (!sel.bookingUrl) return toast('이 회차는 예매 링크가 없어요. 영화관 공식 사이트에서 예매해 주세요.');
            confirmOut({
              title: '공식 예매 페이지로 이동',
              body: (
                <>
                  공식 예매 페이지로 이동합니다.
                  <br />
                  회차 정보가 자동으로 넘어가지 않으면 <b>{clockTime(sel.businessTime)}</b> 회차를 다시 선택해 주세요.
                </>
              ),
              url: sel.bookingUrl,
            });
          }}
        >
          <Icon name="ticket" /> 예매하기
        </button>
      </div>
    </div>
  );
}
