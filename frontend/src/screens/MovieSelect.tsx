import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import type { Movie } from '../api/types';
import { Icon } from '../components/Icon';
import { Poster } from '../components/Poster';
import { Steps } from '../components/Steps';
import { useToast } from '../components/Feedback';

type Load = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ok'; movies: Movie[] };

/** S01 영화 선택 */
export function MovieSelect({ selectedId, onPick }: { selectedId?: string; onPick: (m: Movie) => void }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoad({ state: 'loading' });
    const t = setTimeout(() => {
      api
        .searchMovies(q, ctrl.signal)
        .then((r) => setLoad({ state: 'ok', movies: r.movies }))
        .catch((e) => {
          if (ctrl.signal.aborted) return;
          setLoad({ state: 'error', message: e instanceof ApiError ? e.message : '영화 정보를 불러오지 못했어요.' });
        });
    }, q ? 250 : 0);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, retry]);

  return (
    <section className="screen" aria-labelledby="s01h">
      <div className="wrap">
        <Steps step={1} />
        <h1 id="s01h">어떤 영화를 볼까요?</h1>

        <label className="field">
          <Icon name="search" />
          <input
            type="search"
            placeholder="영화 제목 검색"
            aria-label="영화 제목 검색"
            autoComplete="off"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q && (
            <button className="btn sm ghost" aria-label="검색어 지우기" onClick={() => setQ('')}>
              <Icon name="close" />
            </button>
          )}
        </label>

        <div className="grid">
          {load.state === 'loading' &&
            Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="movie-skel" aria-hidden="true">
                <div className="poster skel-box" />
              </div>
            ))}

          {load.state === 'error' && (
            <div className="empty" style={{ gridColumn: '1/-1' }}>
              <b>영화 정보를 불러오지 못했어요</b>
              {load.message}
              <br />
              <br />
              <button className="btn sm primary" onClick={() => setRetry((n) => n + 1)}>
                다시 시도
              </button>
            </div>
          )}

          {load.state === 'ok' && !load.movies.length && (
            <div className="empty" style={{ gridColumn: '1/-1' }}>
              <b>{q ? `‘${q}’ 검색 결과가 없습니다` : '오늘 상영 중인 영화가 없어요'}</b>
              {q && '띄어쓰기나 철자를 확인하거나 다른 제목으로 검색해 보세요.'}
            </div>
          )}

          {load.state === 'ok' &&
            load.movies.map((m) => {
              const off = m.isShowingToday === false;
              return (
                <button
                  key={m.movieId}
                  className={`movie ${off ? 'off' : ''}`}
                  aria-pressed={selectedId === m.movieId}
                  aria-label={`${m.title}${m.runtimeMinutes ? ` ${m.runtimeMinutes}분` : ''}${off ? ' 오늘 상영 없음' : ''}`}
                  onClick={() => (off ? toast('오늘은 이 영화를 상영하는 회차가 없어요.') : onPick(m))}
                >
                  <Poster movie={m} picked={selectedId === m.movieId} />
                  <div className="mt">{m.title}</div>
                  <div className="ms">
                    {off ? '오늘 상영 없음' : m.runtimeMinutes ? `${m.runtimeMinutes}분` : ' '}
                  </div>
                </button>
              );
            })}
        </div>
      </div>
    </section>
  );
}
