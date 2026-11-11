import type { ComponentChildren } from 'preact';
import type { Question } from '../../src/core/reduce';

/** Colour family of a state; maps to the --rt-* state tokens in session.css. */
export type Tone = 'open' | 'done' | 'sent' | 'assumed' | 'invalid';
type IconName = 'open' | 'later' | 'check' | 'skip' | 'alert' | 'sent' | 'sent-skip' | 'settled' | 'assumed' | 'retracted';
export type StateInfo = { icon: IconName; label: string; tone: Tone };

/** Icon, text label and colour for a question; `later` only applies while it is open. */
export function stateInfo(q: Question, later = false): StateInfo {
  const kind = q.response?.kind;
  const revised = q.isRevision ? ', revised' : '';
  switch (q.status) {
    case 'open':
      return later ? { icon: 'later', label: 'Later', tone: 'open' } : { icon: 'open', label: 'Open', tone: 'open' };
    case 'done':
      if (kind === 'skip') return { icon: 'skip', label: `Skipped, not sent${revised}`, tone: 'done' };
      if (kind === 'invalid') return { icon: 'alert', label: `Invalid, not sent${revised}`, tone: 'done' };
      return { icon: 'check', label: `Done, not sent${revised}`, tone: 'done' };
    case 'sent':
      if (kind === 'skip') return { icon: 'sent-skip', label: 'Skipped', tone: 'sent' };
      if (kind === 'invalid') return { icon: 'alert', label: 'Invalid', tone: 'invalid' };
      return { icon: 'sent', label: 'Sent', tone: 'sent' };
    case 'settled': return { icon: 'settled', label: 'Settled', tone: 'sent' };
    case 'assumed': return { icon: 'assumed', label: 'Assumed by agent', tone: 'assumed' };
    case 'retracted': return { icon: 'retracted', label: 'Retracted', tone: 'open' };
  }
}

/** Fresh vnodes per call: a vnode must not be mounted in two places at once. */
const paths = (): Record<IconName, ComponentChildren> => ({
  open: <circle cx="12" cy="12" r="9" />,
  later: <><circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3 2" /></>,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  skip: <path d="M5 7l5 5-5 5M13 7l5 5-5 5" />,
  alert: <><circle cx="12" cy="12" r="9" /><path d="M12 7.5V13" /><path d="M12 16.5v.1" /></>,
  sent: <><circle cx="12" cy="12" r="9" /><path d="M8 12.5l3 3 5-6" /></>,
  'sent-skip': <><circle cx="12" cy="12" r="9" /><path d="M8 9l3 3-3 3M12.5 9l3 3-3 3" /></>,
  settled: <><circle cx="12" cy="12" r="9" fill="currentColor" /><path class="rt-icon-knockout" d="M8 12.5l3 3 5-6" /></>,
  assumed: <path d="M12 3l2.2 5.6L20 9.3l-4.4 3.9L17 19l-5-3-5 3 1.4-5.8L4 9.3l5.8-.7z" />,
  retracted: <><circle cx="12" cy="12" r="9" /><path d="M8 12h8" /></>,
});

export function StateIcon({ info }: { info: StateInfo }) {
  return (
    <svg class={`rt-state-icon rt-tone-${info.tone}`} aria-hidden="true" width="20" height="20" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      {paths()[info.icon]}
    </svg>
  );
}

export function StateLabel({ info }: { info: StateInfo }) {
  return <span class={`rt-state-label rt-tone-${info.tone}`}>{info.label}</span>;
}
