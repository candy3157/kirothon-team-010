import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ApiError } from '../api/client';
import type { RecommendationResult } from '../api/types';
import { Icon } from '../components/Icon';
import { MapView } from '../components/MapView';
import { TheaterCard } from '../components/TheaterCard';
import { TheaterDetail } from '../components/TheaterDetail';
import { reasonBadges } from '../lib/recommend';
import { hm } from '../lib/time';
import { MODE, type SearchContext } from '../state';

export interface ResultState {
  key: string;
  loading: boolean;
  data?: RecommendationResult;
  error?: ApiError;
}

interface Props {
  ctx: SearchContext;
  result: ResultState | null;
  onRetry: () => void;
  onEditConditions: () => void;
  onChangeMovie: () => void;
}

type Sheet = 'peek' | 'mid' | 'full';

/** S03 지도 기반 추천 + S04 상세(바텀시트 / 데스크톱 사이드 패널) */
export function Recommend({ ctx, result, onRetry, onEditConditions, onChangeMovie }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>('mid');
  const [showResearch, setShowResearch] = useState(false);
  const listScroll = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [insets, setInsets] = useState({ top: 72, bottom: 0 });

  const data = result?.data;
  const loading = !result || result.loading;
  const movie = ctx.movie!;
  const origin = ctx.origin!;

  // 새 결과가 오면 선택 해제 (목록이 새로 그려질 때는 밀기 없이)
  useEffect(() => {
    setPaneDir('');
    setSelectedId(null);
    setShowResearch(false);
    listScroll.current = 0;
  }, [data]);

  // 요약 바·시트가 가리는 높이 측정 (지도 가운데 맞춤용)
  useLayoutEffect(() => {
    const measure = () =>
      setInsets({
        top: topRef.current?.offsetHeight ?? 72,
        bottom: innerWidth >= 900 ? 0 : sheetRef.current?.offsetHeight ?? 0,
      });
    measure();
    addEventListener('resize', measure);
    return () => removeEventListener('resize', measure);
  }, [sheet, selectedId]);

  // 목록 ↔ 상세 전환 방향 (상세로 들어가면 fwd, 목록으로 돌아오면 back)
  const [paneDir, setPaneDir] = useState<'fwd' | 'back' | ''>('');
  const close = () => {
    setPaneDir('back');
    setSelectedId(null);
  };

  // Esc로 상세 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.querySelector('.modal')) return;
      setPaneDir('back');
      setSelectedId(null);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  // 목록 스크롤 위치 복원
  useLayoutEffect(() => {
    if (!selectedId && listRef.current) listRef.current.scrollTop = listScroll.current;
  }, [selectedId]);

  const badges = useMemo(() => reasonBadges(data?.cinemas ?? []), [data]);

  const open = (id: string) => {
    if (listRef.current) listScroll.current = listRef.current.scrollTop;
    setPaneDir('fwd');
    setSelectedId(id);
    if (sheet === 'peek') setSheet('mid');
  };

  const selected =
    data && selectedId
      ? data.cinemas.find((c) => c.cinemaId === selectedId) ?? data.unroutableCinemas.find((c) => c.cinemaId === selectedId)
      : undefined;

  const depLabel = ctx.departure === 'now' ? '지금 출발' : `${ctx.departure} 출발`;

  return (
    <section className="screen map-screen" aria-labelledby="s03h">
      <h2 id="s03h" className="sr-only">
        영화관 추천 지도
      </h2>

      <MapView
        origin={origin}
        cinemas={data?.cinemas ?? []}
        unroutable={data?.unroutableCinemas ?? []}
        selectedId={selectedId}
        loading={loading}
        topInset={insets.top}
        bottomInset={insets.bottom}
        onSelect={open}
        onDragged={() => data && setShowResearch(true)}
      />

      {loading && (
        <div className="loading-pill">
          <span className="spinner" />
          상영시간표와 이동시간 확인 중…
        </div>
      )}

      <div className="topbar" ref={topRef}>
        <div className="summary">
          <button className="back" aria-label="조건 변경으로 돌아가기" onClick={onEditConditions}>
            <Icon name="back" />
          </button>
          <div className="s-main" role="button" tabIndex={0} aria-label="조건 변경" onClick={onEditConditions} onKeyDown={(e) => e.key === 'Enter' && onEditConditions()}>
            <div className="s-title">{movie.title}</div>
            <div className="s-sub">
              <Icon name="pin" /> {origin.label} · <Icon name={MODE[ctx.transportMode].icon} /> {MODE[ctx.transportMode].label} · {depLabel}
            </div>
          </div>
          <button className="btn sm ghost" onClick={onChangeMovie}>
            영화 변경
          </button>
        </div>
      </div>

      {showResearch && (
        <div className="research" style={{ top: insets.top + 2 }}>
          <button
            onClick={() => {
              setShowResearch(false);
              onRetry();
            }}
          >
            <Icon name="refresh" /> 이 지역 재검색
          </button>
        </div>
      )}

      <div className={`sheet ${sheet}`} ref={sheetRef}>
        <button
          className="handle"
          aria-label="목록 펼치기/접기"
          onClick={() => setSheet((s) => (s === 'peek' ? 'mid' : s === 'mid' ? 'full' : 'peek'))}
        >
          <i />
        </button>

        <div className="sheet-content">
          {selected && data ? (
            <div className={`pane ${paneDir}`} key={`detail-${selected.cinemaId}`}>
            <TheaterDetail
              cinema={selected}
              origin={origin}
              meta={data.meta}
              movieTitle={movie.title}
              runtimeMinutes={movie.runtimeMinutes}
              onBack={close}
              onRetry={onRetry}
            />
            </div>
          ) : (
            <div className={`pane ${paneDir}`} key="list">
            <ResultList
              result={result}
              loading={loading}
              listRef={listRef}
              renderCards={() =>
                data!.cinemas.map((c) => (
                  <TheaterCard
                    key={c.cinemaId}
                    cinema={c}
                    origin={origin}
                    departureTime={data!.meta.departureTime}
                    badges={badges.get(c.cinemaId) ?? []}
                    selected={selectedId === c.cinemaId}
                    onClick={() => open(c.cinemaId)}
                  />
                ))
              }
              onOpen={open}
              onRetry={onRetry}
              onEditConditions={onEditConditions}
              onChangeMovie={onChangeMovie}
              isNow={ctx.departure === 'now'}
            />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------------- 목록 (상태별) ---------------- */
interface ListProps {
  result: ResultState | null;
  loading: boolean;
  listRef: React.RefObject<HTMLDivElement>;
  renderCards: () => ReactNode;
  onOpen: (id: string) => void;
  onRetry: () => void;
  onEditConditions: () => void;
  onChangeMovie: () => void;
  isNow: boolean;
}

function ResultList({ result, loading, listRef, renderCards, onOpen, onRetry, onEditConditions, onChangeMovie, isNow }: ListProps) {
  const head = (meta?: ReactNode, count?: number) => (
    <div className="sheet-head">
      <h2>
        추천 영화관 {count != null && <span className="ms">{count}곳</span>}
      </h2>
      <div className="meta">{meta}</div>
    </div>
  );

  if (loading) {
    return (
      <>
        {head(
          <>
            <span className="spinner" />
            조회 중
          </>,
        )}
        <div className="sheet-body">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skel" />
          ))}
        </div>
      </>
    );
  }

  const refetch = (
    <button className="btn sm ghost refetch" aria-label="다시 조회" onClick={onRetry}>
      <Icon name="refresh" />
    </button>
  );

  // 요청 자체가 실패
  if (result?.error) {
    const e = result.error;
    const timeIssue = e.code === 'departure_out_of_range' || e.code === 'unsupported_date';
    return (
      <>
        {head()}
        <div className="sheet-body">
          <Empty title={timeIssue ? '출발 시각을 확인해 주세요' : '추천 정보를 불러오지 못했어요'} body={e.message}>
            {!timeIssue && (
              <button className="btn sm primary" onClick={onRetry}>
                다시 시도
              </button>
            )}
            <button className={`btn sm ${timeIssue ? 'primary' : 'ghost'}`} onClick={onEditConditions}>
              조건 변경
            </button>
          </Empty>
        </div>
      </>
    );
  }

  const data = result!.data!;
  const { meta } = data;
  const metaLine = (
    <>
      {hm(meta.requestedAt)} 기준 {refetch}
    </>
  );

  const notices = meta.notices.filter((n) => n.code !== 'booking_not_guaranteed');

  let body: ReactNode;
  switch (meta.outcome) {
    case 'not_showing':
      body = (
        <Empty title="오늘 이 영화를 상영하는 영화관이 없어요" body="다른 영화를 골라 보세요.">
          <button className="btn sm primary" onClick={onChangeMovie}>
            영화 변경
          </button>
        </Empty>
      );
      break;
    case 'availability_unknown':
      body = (
        <Empty title="상영 정보를 확인하지 못했어요" body="상영하지 않는다는 뜻은 아니에요. 잠시 후 다시 시도해 주세요.">
          <button className="btn sm primary" onClick={onRetry}>
            다시 시도
          </button>
        </Empty>
      );
      break;
    case 'no_feasible_showtime':
      body = (
        <Empty
          title={`${isNow ? '지금 출발하면' : '이 시각에 출발하면'} 관람 가능한 회차가 없어요`}
          body="출발 시각이나 이동수단을 바꿔 다시 찾아볼까요?"
        >
          <button className="btn sm primary" onClick={onEditConditions}>
            조건 변경
          </button>
        </Empty>
      );
      break;
    case 'no_route_confirmed':
      body = (
        <Empty title="이동시간을 확인하지 못했어요" body="관람 가능 여부를 판단할 수 없어요. 다시 시도해 주세요.">
          <button className="btn sm primary" onClick={onRetry}>
            다시 시도
          </button>
        </Empty>
      );
      break;
    default:
      body = renderCards();
  }

  return (
    <>
      {head(metaLine, data.cinemas.length)}
      <div className="sheet-body" ref={listRef}>
        {notices.map((n) => (
          <div key={n.code} className={`notice ${n.code === 'sample_data' ? '' : 'warn'}`}>
            {n.code !== 'sample_data' && <Icon name="alert" />} {n.message}
          </div>
        ))}

        {body}

        {data.unroutableCinemas.length > 0 && (
          <>
            <div className="section-t">확인이 필요한 영화관</div>
            {data.unroutableCinemas.map((c) => (
              <button key={c.cinemaId} className="card" onClick={() => onOpen(c.cinemaId)}>
                <div className="row1">
                  <span className="rank unk">?</span>
                  <div className="nm">
                    {c.name}
                    <small>{c.address}</small>
                  </div>
                </div>
                <div className="stats">
                  <span className="tag warn">이동시간을 확인하지 못했어요</span>
                  <span className="tag">관람 가능 여부 미확인</span>
                </div>
              </button>
            ))}
          </>
        )}

        {data.unreachableCinemas.length > 0 && (
          <>
            <div className="section-t">시간 안에 갈 수 없는 영화관</div>
            {data.unreachableCinemas.map((c) => (
              <div key={c.cinemaId} className="card dim">
                <div className="row1">
                  <span className="rank unk">–</span>
                  <div className="nm">
                    {c.name}
                    <small>
                      {c.reason === 'all_showtimes_missed'
                        ? `이동 ${c.travelMinutes}분 · 남은 회차에 모두 늦어요`
                        : `최소 ${c.lowerBoundMinutes}분 거리 · 마지막 회차 ${hm(c.lastShowtimeStart)}`}
                    </small>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {meta.outcome === 'recommended' && <p className="ms foot">이동시간은 예상값이에요. 실제 교통 상황에 따라 달라질 수 있어요.</p>}
      </div>
    </>
  );
}

function Empty({ title, body, children }: { title: string; body?: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <b>{title}</b>
      {body}
      {children && <div className="empty-acts">{children}</div>}
    </div>
  );
}
