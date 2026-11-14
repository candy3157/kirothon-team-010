import { useCallback, useRef, useState } from 'react';
import { api, ApiError } from './api/client';
import { FeedbackProvider } from './components/Feedback';
import { Splash } from './components/Splash';
import { departureISO } from './lib/time';
import { Departure } from './screens/Departure';
import { MovieSelect } from './screens/MovieSelect';
import { Recommend, type ResultState } from './screens/Recommend';
import { contextKey, initialContext, type SearchContext } from './state';

type Screen = 'splash' | 'movie' | 'departure' | 'recommend';
/** 화면 순서. 뒤 화면으로 가면 오른쪽에서, 앞 화면으로 돌아가면 왼쪽에서 들어온다. */
const ORDER: Screen[] = ['splash', 'movie', 'departure', 'recommend'];

export default function App() {
  const [screen, setScreen] = useState<Screen>('splash');
  const [dir, setDir] = useState<'fwd' | 'back' | ''>('');
  const [ctx, setCtx] = useState<SearchContext>(initialContext);
  const [result, setResult] = useState<ResultState | null>(null);
  const reqSeq = useRef(0);

  const go = (s: Screen) => {
    setDir(ORDER.indexOf(s) > ORDER.indexOf(screen) ? 'fwd' : 'back');
    setScreen(s);
    window.scrollTo(0, 0);
  };
  const patch = (p: Partial<SearchContext>) => setCtx((c) => ({ ...c, ...p }));

  /** 추천 요청. 늦게 도착한 이전 응답은 버린다. */
  const search = useCallback(async (c: SearchContext) => {
    if (!c.movie || !c.origin) return;
    const key = contextKey(c);
    const seq = ++reqSeq.current;
    setResult({ key, loading: true });
    try {
      const data = await api.createRecommendation({
        movieId: c.movie.movieId,
        origin: { latitude: c.origin.latitude, longitude: c.origin.longitude },
        transportMode: c.transportMode,
        sortBy: 'earliest', // 가장 빨리 볼 수 있는 순
        ...(c.departure !== 'now' ? { departureTime: departureISO(c.departure) } : {}),
      });
      if (seq === reqSeq.current) setResult({ key, loading: false, data });
    } catch (e) {
      if (seq !== reqSeq.current) return;
      setResult({ key, loading: false, error: e instanceof ApiError ? e : new ApiError(0, 'unknown', '알 수 없는 오류가 났어요.') });
    }
  }, []);

  return (
    <FeedbackProvider>
      <div id="live" className="sr-only" aria-live="polite">
        {result?.loading ? '추천 영화관을 찾는 중입니다' : result?.data ? `관람 가능한 영화관 ${result.data.cinemas.length}곳을 찾았습니다` : ''}
      </div>

      {/* 화면 전환: key가 바뀔 때마다 새 화면이 dir 방향으로 밀려 들어온다 (styles.css "화면 전환") */}
      <div key={screen} className={`page ${dir}`}>
      {screen === 'splash' && <Splash onDone={() => go('movie')} />}

      {screen === 'movie' && (
        <MovieSelect
          selectedId={ctx.movie?.movieId}
          onPick={(m) => {
            patch({ movie: m });
            go('departure');
          }}
        />
      )}

      {screen === 'departure' && ctx.movie && (
        <Departure
          ctx={ctx}
          onChange={patch}
          onChangeMovie={() => go('movie')}
          onSubmit={() => {
            go('recommend');
            // 조건이 그대로면 이전 결과를 다시 쓴다 (명세 6장)
            if (!result || result.key !== contextKey(ctx) || result.error) search(ctx);
          }}
        />
      )}

      {screen === 'recommend' && ctx.movie && ctx.origin && (
        <Recommend
          ctx={ctx}
          result={result}
          onRetry={() => search(ctx)}
          onEditConditions={() => go('departure')}
          onChangeMovie={() => go('movie')}
        />
      )}
      </div>
    </FeedbackProvider>
  );
}
