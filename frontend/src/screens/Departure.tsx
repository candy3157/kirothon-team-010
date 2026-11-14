import { useEffect, useMemo, useState } from 'react';
import { ApiError, api } from '../api/client';
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

type RemoteStatus = 'idle' | 'loading' | 'ok' | 'off' | 'error';

interface Suggestion {
  label: string;
  /** 주소 (이름과 다를 때만) */
  sub?: string;
  latitude: number;
  longitude: number;
}

/** S02 출발 조건 */
export function Departure({ ctx, onChange, onChangeMovie, onSubmit }: Props) {
  const m = ctx.movie!;
  const [q, setQ] = useState('');
  const [showSuggest, setShowSuggest] = useState(false);
  const [geo, setGeo] = useState<'idle' | 'loading' | 'fail'>('idle');

  const [remote, setRemote] = useState<{ status: RemoteStatus; items: Suggestion[] }>({ status: 'idle', items: [] });

  // 2자 이상이면 서버 장소 검색(네이버). 입력이 멈추고 300ms 뒤에 부르고, 이전 요청은 취소한다.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setRemote({ status: 'idle', items: [] });
      return;
    }
    const ac = new AbortController();
    setRemote((r) => ({ status: 'loading', items: r.items }));
    const t = setTimeout(() => {
      api
        .searchPlaces(term, ac.signal)
        .then((res) =>
          setRemote({
            status: 'ok',
            items: res.places.map((p) => ({ label: p.name, sub: p.address !== p.name ? p.address : undefined, latitude: p.latitude, longitude: p.longitude })),
          }),
        )
        .catch((e) => {
          if (ac.signal.aborted) return;
          // 503 = 서버에 키 없음. 그 밖은 일시 오류. 둘 다 기본 장소 목록으로 대신한다.
          setRemote({ status: e instanceof ApiError && e.status === 503 ? 'off' : 'error', items: [] });
        });
    }, 300);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [q]);

  const local = useMemo<Suggestion[]>(() => (q.trim() ? PLACES.filter((p) => p.label.includes(q.trim())) : PLACES), [q]);
  const suggestions = remote.status === 'ok' ? remote.items : local;

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
    <section className="screen" aria-labelledby="s02h">
      <div className="wrap">
        <Steps step={2} />
        <h1 id="s02h">어디서, 어떻게 출발하나요?</h1>

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
        <div className="label">출발지</div>
        <div className="origin-row">
          <button
            className={`btn sm ${ctx.origin?.fromGeo ? 'primary' : 'ghost'}`}
            aria-pressed={!!ctx.origin?.fromGeo}
            onClick={useGeo}
          >
            <Icon name="pin" /> 현재 위치 사용
          </button>
          <label className="field" style={{ flex: 1, padding: '8px 12px' }}>
            <input
              placeholder="장소 이름이나 주소 검색"
              aria-label="출발지 검색"
              autoComplete="off"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onFocus={() => setShowSuggest(true)}
            />
          </label>
        </div>
        {showSuggest && (
          <div className="suggest" role="listbox">
            {remote.status === 'loading' && remote.items.length === 0 ? (
              <button disabled>
                <span className="spinner" /> 장소 찾는 중…
              </button>
            ) : suggestions.length ? (
              suggestions.map((p) => (
                <button
                  key={`${p.label}|${p.latitude},${p.longitude}`}
                  role="option"
                  aria-selected={ctx.origin?.label === p.label}
                  onClick={() => {
                    onChange({ origin: { label: p.label, latitude: p.latitude, longitude: p.longitude } });
                    setQ('');
                    setShowSuggest(false);
                  }}
                >
                  <Icon name="pin" /> {p.label}
                  {p.sub && <span className="ms"> · {p.sub}</span>}
                </button>
              ))
            ) : (
              <button disabled>일치하는 장소가 없어요</button>
            )}
            {(remote.status === 'off' || remote.status === 'error') && (
              <button disabled>
                {remote.status === 'off' ? '장소 검색이 설정되지 않아' : '장소 검색에 실패해'} 기본 장소만 보여요
              </button>
            )}
          </div>
        )}
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
