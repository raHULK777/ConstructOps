export function ProgressBar({ percentage }: { percentage: number }) {
  const value = Math.min(100, Math.max(0, Math.round(percentage)));

  return (
    <div
      className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Project progress"
    >
      <div
        className="h-full rounded-full bg-brandSecondary transition-all duration-500 ease-out"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}
