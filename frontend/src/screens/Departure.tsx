import { useMemo, useState } from 'react';
import type { TransportMode } from '../api/types';
import { Icon } from '../components/Icon';
import { Poster } from '../components/Poster';
import { Steps } from '../components/Steps';
import { PLACES } from '../lib/places';
import { isPastTime, suggestTime } from '../lib/time';
import { MODE, type SearchContext } from '../state';

interface Props {
  ctx: SearchContext;
  onChange: (patch: Partial<SearchContext>) => void;
  onChangeMovie: () => void;
  onSubmit: () => void;
}

/** S02 출발 조건 */
export function Departure({ ctx, onChange, onChangeMovie, onSubmit }: Props) {
  const m = ctx.movie!;
  const [q, setQ] = useState('');
  const [showSuggest, setShowSuggest] = useState(false);
  const [geo, setGeo] = useState<'idle' | 'loading' | 'fail'>('idle');

  const suggestions = useMemo(() => (q.trim() ? PLACES.filter((p) => p.label.includes(q.trim())) : PLACES), [q]);

  const past = ctx.departure !== 'now' && isPastTime(ctx.departure);
  const valid = !!(ctx.movie && ctx.origin && ctx.transportMode) && !past;

  const useGeo = () => {
    if (!navigator.geolocation) return setGeo('fail');
    setGeo('loading');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setGeo('idle');
        onChange({ origin: { latitude: p.coords.latitude, longitude: p.coords.longitude, label: '현재 위치', fromGeo: true } });
      },
      () => setGeo('fail'),
      { timeout: 8000 },
    );
  };

  return (
    <section className="screen dep-screen" aria-labelledby="s02h">
      <div className="wrap">
        <Steps step={2} />
        <i className="sp sp-a" aria-hidden="true" />
        <h1 id="s02h">어디서, 어떻게 출발하나요?</h1>
        <i className="sp sp-b" aria-hidden="true" />

        <div className="picked">
          <Poster movie={m} small />
          <div className="info">
            <div className="t">{m.title}</div>
            {m.runtimeMinutes && <div className="ms">{m.runtimeMinutes}분</div>}
          </div>
          <button className="btn sm ghost" onClick={onChangeMovie}>
            변경
          </button>
        </div>

        {/* 출발지 */}
        <i className="sp sp-c" aria-hidden="true" />
        <div className="label">출발지</div>
        <div className="origin-row">
          <button
            className={`btn sm ${ctx.origin?.fromGeo ? 'primary' : 'ghost'}`}
            aria-pressed={!!ctx.origin?.fromGeo}
            onClick={useGeo}
          >
            <Icon name="pin" /> 현재 위치 사용
          </button>
          {/* 장소 목록은 아래 내용을 밀지 않고 위에 떠서 열린다 (화면 스크롤 방지) */}
          <div className="origin-field">
          <label className="field" style={{ padding: '8px 12px' }}>
            <input
              placeholder="장소 검색"
              aria-label="출발지 검색"
              autoComplete="off"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onFocus={() => setShowSuggest(true)}
              onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
            />
          </label>
        {showSuggest && (
          <div className="suggest" role="listbox">
            {suggestions.length ? (
              suggestions.map((p) => (
                <button
                  key={p.label}
                  role="option"
                  aria-selected={ctx.origin?.label === p.label}
                  onClick={() => {
                    onChange({ origin: { ...p } });
                    setQ('');
                    setShowSuggest(false);
                  }}
                >
                  <Icon name="pin" /> {p.label}
                </button>
              ))
            ) : (
              <button disabled>일치하는 장소가 없어요</button>
            )}
          </div>
        )}
          </div>
        </div>
        {geo === 'loading' && (
          <div className="notice">
            <span className="spinner" />
            현재 위치 확인 중…
          </div>
        )}
        {geo === 'fail' && <div className="notice warn">위치를 사용할 수 없습니다. 출발지를 직접 선택해 주세요.</div>}
        {ctx.origin && geo !== 'loading' && (
          <div className="origin-set">
            <Icon name="check" />
            <span>
              <b>{ctx.origin.label}</b>에서 출발
            </span>
          </div>
        )}

        {/* 이동수단 */}
        <i className="sp sp-c" aria-hidden="true" />
        <div className="label">이동수단</div>
        <div className="seg" role="group" aria-label="이동수단">
          {(Object.keys(MODE) as TransportMode[]).map((k) => (
            <button key={k} aria-pressed={ctx.transportMode === k} onClick={() => onChange({ transportMode: k })}>
              <Icon name={MODE[k].icon} />
              {MODE[k].label}
            </button>
          ))}
        </div>

        {/* 출발 시각 (오늘만) */}
        <i className="sp sp-c" aria-hidden="true" />
        <div className="label">출발 시각 · 오늘</div>
        <div className="chips">
          <button className="chip" aria-pressed={ctx.departure === 'now'} onClick={() => onChange({ departure: 'now' })}>
            지금 출발
          </button>
          <button
            className="chip"
            aria-pressed={ctx.departure !== 'now'}
            onClick={() => ctx.departure === 'now' && onChange({ departure: suggestTime() })}
          >
            시간 지정
          </button>
        </div>
        {ctx.departure !== 'now' && (
          <input
            type="time"
            className="time-input"
            aria-label="출발 시간"
            value={ctx.departure}
            onChange={(e) => e.target.value && onChange({ departure: e.target.value })}
          />
        )}
        {past && <div className="notice bad">지난 시각이에요. 출발 시각을 다시 선택해 주세요.</div>}
      </div>

      {/* 한 화면 레이아웃의 맨 아래 칸 (고정 위치 대신 흐름 안에 둔다) */}
      <div className="cta-bar">
        <div className="inner">
          <button className="btn primary" disabled={!valid} onClick={onSubmit}>
            영화관 추천받기
          </button>
        </div>
      </div>
    </section>
  );
}
