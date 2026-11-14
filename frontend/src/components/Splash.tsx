import { useEffect, useRef, useState } from 'react';

/** 로고 + 슬로건을 1.5초 보여주고 다음 화면으로. 누르면 바로 넘어간다. */
export function Splash({ onDone, duration = 1500 }: { onDone: () => void; duration?: number }) {
  const [out, setOut] = useState(false);
  const done = useRef(false);

  const next = () => {
    if (done.current) return;
    done.current = true;
    setOut(true);
    setTimeout(onDone, 600);
  };

  useEffect(() => {
    const t = setTimeout(next, duration);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className={`screen splash ${out ? 'out' : ''}`} aria-label="Moviepato" onClick={next}>
      <div className="splash-inner">
        <div className="splash-logo">
          Moviepato<b>.</b>
        </div>
        <p className="splash-slogan">Now showing, near you</p>
      </div>
    </section>
  );
}
