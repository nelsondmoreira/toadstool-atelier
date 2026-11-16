export interface WeeklyProgressProps {
  completed: number;
  total: number;
}

export function WeeklyProgress({
  completed,
  total,
}: WeeklyProgressProps) {
  const percentage =
    total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="card">
      <div className="row">
        <h2>This week's progress</h2>
        <b>{percentage}%</b>
      </div>

      <div
        className="progress"
        role="progressbar"
        aria-label="Weekly mission progress"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={completed}
      >
        <span style={{ width: `${percentage}%` }} />
      </div>

      <div className="muted small">
        {completed} of {total} missions completed
      </div>

      <div className="small muted weekly-progress-note">
        Every effort counts. No streaks or penalties.
      </div>
    </div>
  );
}