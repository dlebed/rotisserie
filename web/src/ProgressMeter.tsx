import type { Progress } from '../../src/core/reduce';

const SEGMENTS = [
  { key: 'sent', label: 'Sent' },
  { key: 'done', label: 'Done, not sent' },
  { key: 'open', label: 'Open' },
] as const;

/** Answered versus remaining: sent, done-not-sent and open, in that fixed order. */
export function ProgressMeter({ progress }: { progress: Progress }) {
  const { sent, done, open, total, totalAtLastBatch } = progress;
  const grew = totalAtLastBatch !== null && total > totalAtLastBatch;
  const counts = { sent, done, open };
  return (
    <section class="rt-progress" aria-label="Progress">
      <div class="rt-progress-head">
        <div>
          <span class="rt-progress-count">{`${sent + done} of ${total}`}</span> <span class="rt-text-2">answered</span>
        </div>
        <div class="rt-progress-note">
          {`${open} to go`}{grew ? ` · total grew from ${totalAtLastBatch} to ${total}` : ''}
        </div>
      </div>
      {total > 0 && (
        <div class="rt-meter-bar" role="img" aria-label={`${sent} sent, ${done} done and not yet sent, ${open} open`}>
          {SEGMENTS.filter((s) => counts[s.key] > 0).map((s) => (
            <span key={s.key} class={`rt-meter-seg rt-fill-${s.key}`} style={{ flexGrow: counts[s.key] }} />
          ))}
        </div>
      )}
      <div class="rt-legend" data-testid="progress-legend">
        {SEGMENTS.map((s) => (
          <span key={s.key} class="rt-legend-item">
            <span class={`rt-swatch rt-fill-${s.key}`} aria-hidden="true" />
            {s.label} <span class="rt-legend-n">{counts[s.key]}</span>
          </span>
        ))}
      </div>
    </section>
  );
}
