import { useEffect, useId, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { Question } from '../../src/core/reduce';
import type { UserResponse } from '../../src/core/events';
import type { Rejected } from './outbox';
import { AnswerForm, InvalidPanel } from './AnswerForm';
import { KeyHint, keyShortcuts } from './KeyHint';
import { StateIcon, StateLabel, stateInfo } from './StateBadge';

/** What the user has typed or picked but not marked Done. */
export type Draft = { optionIds: string[]; text: string; note: string };

export type CardProps = {
  question: Question;
  /** Seeds an open question's form once, on mount. Later changes are ignored so a refetch never overwrites typing. */
  draft?: Draft | undefined;
  expanded: boolean;
  later?: boolean;
  readOnly?: boolean;
  hidden?: boolean;
  /** The card the keyboard is on (the one that last held focus). */
  focused?: boolean;
  rejected?: Rejected[];
  onDone(qid: string, response: UserResponse): void;
  onSkip(qid: string): void;
  onInvalid(qid: string, reason: string): void;
  onLater(qid: string): void;
  /** Unfold this card: Edit, Reopen, or a click on a folded open question. */
  onEdit(qid: string): void;
  onDraft?(qid: string, draft: Draft): void;
  onDismiss?(cid: string): void;
};

export const FOLD_MS = 200;
const DRAFT_MS = 500;
const EMPTY: Draft = { optionIds: [], text: '', note: '' };

function fromResponse(r: UserResponse | undefined): Draft {
  return r?.kind === 'answer' ? { optionIds: [...r.optionIds], text: r.text ?? '', note: r.note ?? '' } : EMPTY;
}

function animates(): boolean {
  try { return !window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

/** Keeps the body mounted for the length of the collapse, so it can animate before it goes. */
function useFold(open: boolean) {
  const [mounted, setMounted] = useState(open);
  useLayoutEffect(() => {
    if (open) { setMounted(true); return; }
    if (!mounted) return;
    if (!animates()) { setMounted(false); return; }
    const t = setTimeout(() => setMounted(false), FOLD_MS);
    return () => clearTimeout(t);
  }, [open]);
  return { shown: open || mounted, closing: !open && mounted };
}

export function optionLabels(q: Question, ids: string[]): string[] {
  return ids.map((id) => q.options?.find((o) => o.id === id)?.label ?? id);
}

/** The one-line form of the answer or decision on a folded row. */
function oneLine(q: Question): string {
  if (q.status === 'retracted') return `Retracted by agent: ${q.reason ?? ''}`;
  if ((q.status === 'settled' || q.status === 'assumed') && q.decision) return q.decision;
  const r = q.response;
  if (!r) return '';
  if (r.kind === 'skip') return 'You skipped. The agent will decide.';
  if (r.kind === 'invalid') return r.reason;
  return [...optionLabels(q, r.optionIds), r.text ?? '', r.note ?? ''].filter((s) => s.trim() !== '').join(' · ');
}

export function QuestionCard(p: CardProps) {
  const q = p.question;
  const info = stateInfo(q, p.later);
  const retracted = q.status === 'retracted';
  const open = p.expanded && !retracted && !p.readOnly;
  const fold = useFold(open);
  const quiet = q.status === 'sent' || q.status === 'settled' || q.status === 'assumed';
  const root = useRef<HTMLDivElement>(null);

  const [draft, setDraft] = useState<Draft>(() => (q.status === 'open' ? p.draft ?? EMPTY : fromResponse(q.response)));
  const [saved, setSaved] = useState(false);
  /** The user has typed or picked something not yet marked (including a restored draft). */
  const [dirty, setDirty] = useState(() => q.status === 'open' && (p.draft?.text.trim() ?? '') !== '');
  const [invalid, setInvalid] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef({ draft, onDraft: p.onDraft });
  latest.current = { draft, onDraft: p.onDraft };

  // Unfolding an answered question for Edit or Reopen starts from what was answered.
  const wasOpen = useRef(open);
  useLayoutEffect(() => {
    if (open && !wasOpen.current && q.status !== 'open') { setDraft(fromResponse(q.response)); setSaved(false); setDirty(false); }
    if (!open) setInvalid(false);
    wasOpen.current = open;
  }, [open]);

  const cancelDraft = () => { clearTimeout(timer.current); timer.current = undefined; };
  // Leaving the page within the debounce window still keeps the last keystrokes.
  useEffect(() => () => {
    if (timer.current === undefined) return;
    cancelDraft();
    latest.current.onDraft?.(q.id, latest.current.draft);
  }, []);

  const change = (next: Draft) => {
    setDraft(next);
    setSaved(false);
    setDirty(true);
    cancelDraft();
    timer.current = setTimeout(() => {
      timer.current = undefined;
      latest.current.onDraft?.(q.id, next);
      setSaved(true);
    }, DRAFT_MS);
  };

  const finish = (act: () => void) => { cancelDraft(); setDirty(false); act(); };
  // A retraction must not make text the user typed disappear from view.
  const unsent = retracted && dirty && draft.text.trim() !== '' ? draft.text : '';

  return (
    <div ref={root} data-qid={q.id} tabIndex={-1} hidden={p.hidden}
      class={`rt-card${fold.shown ? ' is-expanded' : ''}${retracted ? ' is-retracted' : ''}${q.isNew ? ' is-new' : ''}${quiet ? ' is-quiet' : ''}${p.focused ? ' is-kbd-focus' : ''}`}>
      {!fold.shown && <Row q={q} p={p} />}
      {fold.shown && (
        <div class={`rt-card-fold${fold.closing ? ' is-closing' : ''}`} inert={fold.closing}>
          <div class="rt-card-fold-inner">
            <div class="rt-card-head">
              <StateIcon info={info} />
              <span class="rt-qid">{q.id}</span>
              {q.isNew && <span class="rt-badge-new">New</span>}
              <StateLabel info={info} />
            </div>
            <div class="rt-card-text">
              <h2 class="rt-card-title">{q.title}</h2>
              {q.body && <p class="rt-card-body">{q.body}</p>}
            </div>
            {q.decision && (
              <div class="rt-callout">
                <div class="rt-eyebrow">{q.status === 'assumed' ? 'Agent assumed' : 'Agent decided'}</div>
                <div class="rt-pre">{q.decision}</div>
                {q.status === 'assumed' && q.reason && <div class="rt-pre rt-why"><span class="rt-eyebrow">Why</span> {q.reason}</div>}
              </div>
            )}
            <AnswerForm q={q} draft={draft} saved={saved} onChange={change} />
            {invalid
              ? <InvalidPanel onCancel={() => { setInvalid(false); root.current?.focus(); }} onSubmit={(reason) => finish(() => p.onInvalid(q.id, reason))} />
              : <Actions q={q} draft={draft} onSkip={() => finish(() => p.onSkip(q.id))} onInvalid={() => setInvalid(true)}
                  onLater={() => finish(() => p.onLater(q.id))} onDone={(r) => finish(() => p.onDone(q.id, r))} />}
          </div>
        </div>
      )}
      {unsent && (
        <div class="rt-unsent">
          <span class="rt-eyebrow">Your unsent text:</span>
          <p class="rt-unsent-text">{unsent}</p>
        </div>
      )}
      {(p.rejected?.length ?? 0) > 0 && <Rejections q={q} rejected={p.rejected ?? []} onDismiss={p.onDismiss} />}
    </div>
  );
}

function Row({ q, p }: { q: Question; p: CardProps }) {
  const info = stateInfo(q, p.later);
  const summary = oneLine(q);
  const hint = q.status === 'open' ? (q.options?.length ? `${q.options.length} options` : 'Free text') : '';
  const body = (
    <>
      <StateIcon info={info} />
      <span class="rt-qid rt-row-qid">{q.id}</span>
      <span class="rt-row-main">
        <span class={`rt-row-title${q.status === 'retracted' ? ' is-struck' : ''}`}>{q.title}</span>
        {summary && <span class={`rt-row-sub${q.status === 'assumed' ? ' is-full' : ''}`} title={q.status === 'assumed' ? undefined : summary}>{summary}</span>}
        {q.status === 'assumed' && q.reason && <span class="rt-row-sub is-full rt-why"><span class="rt-eyebrow">Why</span> {q.reason}</span>}
      </span>
      {q.isNew && <span class="rt-badge-new">New</span>}
      {hint && <span class="rt-row-hint">{hint}</span>}
      <StateLabel info={info} />
    </>
  );
  if (q.status === 'open' && !p.readOnly) {
    return (
      <button type="button" class="rt-row rt-row-button" aria-expanded="false" onClick={() => p.onEdit(q.id)}>
        {body}
        <svg class="rt-chevron" aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6" /></svg>
      </button>
    );
  }
  const action = p.readOnly || q.status === 'retracted' ? null : q.status === 'done' ? 'Edit' : 'Reopen';
  return (
    <div class="rt-row">
      {body}
      {action && <button type="button" class="rt-btn rt-btn-small" onClick={() => p.onEdit(q.id)}>{action}</button>}
    </div>
  );
}

function Actions({ q, draft, onSkip, onInvalid, onLater, onDone }: {
  q: Question; draft: Draft; onSkip(): void; onInvalid(): void; onLater(): void; onDone(r: UserResponse): void;
}) {
  const [empty, setEmpty] = useState(false);
  useEffect(() => setEmpty(false), [draft]);
  const done = () => {
    if (draft.optionIds.length === 0 && draft.text.trim() === '') { setEmpty(true); return; }
    onDone({ kind: 'answer', optionIds: draft.optionIds,
      ...(draft.text.trim() !== '' ? { text: draft.text } : {}),
      ...(draft.note.trim() !== '' ? { note: draft.note } : {}) });
  };
  return (
    <>
      {empty && <p class="rt-error" role="alert">Choose an option or write an answer first.</p>}
      <div class="rt-actions">
        <div class="rt-actions-secondary">
          <button type="button" class="rt-btn-ghost" data-rt-action="skip" aria-keyshortcuts={keyShortcuts('skip')} onClick={onSkip}>Skip<KeyHint k="skip" /></button>
          <button type="button" class="rt-btn-ghost" data-rt-action="invalid" aria-keyshortcuts={keyShortcuts('invalid')} onClick={onInvalid}>Invalid question<KeyHint k="invalid" /></button>
          {q.status === 'open' && <button type="button" class="rt-btn-ghost" data-rt-action="later" aria-keyshortcuts={keyShortcuts('later')} onClick={onLater}>Later<KeyHint k="later" /></button>}
        </div>
        <button type="button" class="rt-btn-primary" data-rt-action="done" aria-keyshortcuts={keyShortcuts('done')} onClick={done}>Done<KeyHint k="done" /></button>
      </div>
    </>
  );
}

function carried(q: Question, r: Rejected): string[] {
  const a = r.action;
  if (a.kind === 'mark') {
    const res = a.response;
    if (res.kind === 'skip') return ['Skip'];
    if (res.kind === 'invalid') return [`Invalid: ${res.reason}`];
    const labels = optionLabels(q, res.optionIds).join(', ');
    return [labels, res.text ?? '', res.note ?? ''].filter((s) => s.trim() !== '');
  }
  if (a.kind === 'draft') {
    const d = a.draft as Partial<Draft> | null;
    return typeof d?.text === 'string' && d.text.trim() !== '' ? [d.text] : [];
  }
  return [];
}

function Rejections({ q, rejected, onDismiss }: { q: Question; rejected: Rejected[]; onDismiss?: ((cid: string) => void) | undefined }) {
  const id = useId();
  return (
    <div class="rt-rejections">
      {rejected.map((r, i) => (
        <div key={r.action.cid} class="rt-rejected">
          <div class="rt-rejected-main">
            <p class="rt-rejected-msg" id={`${id}-${i}`}>Not sent: {r.message}</p>
            {carried(q, r).map((t, j) => <p key={j} class="rt-rejected-text">{t}</p>)}
          </div>
          <button type="button" class="rt-btn rt-btn-small" aria-describedby={`${id}-${i}`}
            onClick={() => onDismiss?.(r.action.cid)}>Dismiss</button>
        </div>
      ))}
    </div>
  );
}
