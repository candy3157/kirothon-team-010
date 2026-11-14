import { useState } from 'react';
import type { Movie } from '../api/types';
import { Icon } from './Icon';

/** 포스터. posterUrl이 없거나 못 불러오면 제목만 있는 어두운 카드로 보여준다. */
export function Poster({ movie, picked = false, small = false }: { movie: Movie; picked?: boolean; small?: boolean }) {
  const [broken, setBroken] = useState(false);
  const hasImg = !!movie.posterUrl && !broken;
  return (
    <div className={`poster ${hasImg ? '' : 'noimg'} ${small ? 'sm' : ''}`}>
      {hasImg ? (
        <img src={movie.posterUrl!} alt="" loading="lazy" onError={() => setBroken(true)} />
      ) : (
        !small && <span className="ptitle">{movie.title}</span>
      )}
      {picked && (
        <span className="pick">
          <Icon name="check" />
        </span>
      )}
    </div>
  );
}
