import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

/* ---------------- Toast ---------------- */
const ToastCtx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

/* ---------------- 외부 이동 확인 모달 ---------------- */
interface ConfirmOpts {
  title: string;
  body: ReactNode;
  url: string;
}
const ConfirmCtx = createContext<(o: ConfirmOpts) => void>(() => {});
export const useConfirmOut = () => useContext(ConfirmCtx);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  const [confirm, setConfirm] = useState<ConfirmOpts | null>(null);
  const okRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!confirm) return;
    okRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setConfirm(null);
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [confirm]);

  return (
    <ToastCtx.Provider value={showToast}>
      <ConfirmCtx.Provider value={setConfirm}>
        {children}
        <div className={`toast ${toast ? 'on' : ''}`} role="status">
          {toast}
        </div>
        {confirm && (
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="mTitle" onClick={() => setConfirm(null)}>
            <div className="box" onClick={(e) => e.stopPropagation()}>
              <h4 id="mTitle">{confirm.title}</h4>
              <p>{confirm.body}</p>
              <div className="acts">
                <button className="btn ghost" onClick={() => setConfirm(null)}>
                  취소
                </button>
                <button
                  ref={okRef}
                  className="btn primary"
                  onClick={() => {
                    window.open(confirm.url, '_blank', 'noopener');
                    setConfirm(null);
                  }}
                >
                  이동하기
                </button>
              </div>
            </div>
          </div>
        )}
      </ConfirmCtx.Provider>
    </ToastCtx.Provider>
  );
}
