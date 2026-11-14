export function Steps({ step, total = 3 }: { step: number; total?: number }) {
  return (
    <div className="steps" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={i < step ? 'on' : ''} />
      ))}
    </div>
  );
}
