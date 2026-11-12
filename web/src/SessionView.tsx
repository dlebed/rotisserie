import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { Question, SessionState } from '../../src/core/reduce';
import type { UserResponse } from '../../src/core/events';
import { api as defaultApi } from './api';
import type { Api, SendResult } from './api';
import type { Action, OutboxDeps } from './outbox';
import { KeyHint, keyShortcuts } from './KeyHint';
import { nextOpen, shortcutList, useSessionKeys } from './keyboard';
import type { KeyAction } from './keyboard';
import { ProgressMeter } from './ProgressMeter';
import { QuestionCard } from './QuestionCard';
import { Summary } from './Summary';
import type { Draft } from './QuestionCard';
import { useSessionData } from './useSessionData';
import './session.css';

type Props = {
  pk: string;
  id: string;
  /** The project folder, shown in the header (the session payload does not carry it). */
  dir?: string | undefined;
  api?: Api;
  storage?: Storage;
  send?: (a: Action) => Promise<SendResult>;
  timers?: OutboxDeps['timers'];
};

type Filter = 'all' | 'unanswered' | 'new' | 'assumed';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' }, { key: 'unanswered', label: 'Unanswered' },
  { key: 'new', label: 'New' }, { key: 'assumed', label: 'Assumed by agent' },
];
const matches = (q: Question, f: Filter) => f === 'all' || (f === 'unanswered' && q.status === 'open')
  || (f === 'new' && q.isNew) || (f === 'assumed' && q.status === 'assumed');

const OFFLINE = "The agent's session is closed. Your answers are saved in this browser and will be sent when it is back.";
export const AUTH_LOST = 'This page lost its access. Open the link from your terminal again.';
const NOT_SAVED = 'Your answers are not being saved in this browser. Keep this tab open until they are sent.';

/** localStorage, or a stand-in whose writes fail so the outbox reports storageOk() === false. */
function browserStorage(): Storage {
  try { if (window.localStorage) return window.localStorage; } catch { /* blocked */ }
  return { length: 0, clear() {}, getItem: () => null, key: () => null, removeItem() {},
    setItem() { throw new Error('storage unavailable'); } };
}

function readLater(storage: Storage, key: string): string[] {
  try {
    const v: unknown = JSON.parse(storage.getItem(key) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch { return []; }
}

function asDraft(v: unknown): Draft | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const d = v as Partial<Draft>;
  if (!Array.isArray(d.optionIds) || typeof d.text !== 'string' || typeof d.note !== 'string') return undefined;
  return { optionIds: d.optionIds.filter((x): x is string => typeof x === 'string'), text: d.text, note: d.note };
}

const cardEl = (root: Element | null, qid: string) =>
  [...(root?.querySelectorAll<HTMLElement>('[data-qid]') ?? [])].find((el) => el.dataset.qid === qid) ?? null;

function firstOpen(s: SessionState, later: string[]): string | null {
  return s.order.find((qid) => s.questions[qid]?.status === 'open' && !later.includes(qid)) ?? null;
}

const plural = (n: number, word: string) => (n === 1 ? word : `${word}s`);

function statusLine(s: SessionState): { text: string; working: boolean } {
  if (s.phase === 'confirmed') return { text: 'Session closed', working: false };
  if (s.phase === 'summary') return { text: 'Agent posted a summary and is waiting for your confirmation', working: false };
  const custom = s.agentStatus?.trim();
  if (custom) return { text: custom, working: s.pendingWake };
  if (s.pendingWake) {
    const n = Object.values(s.questions).filter((q) => q.status === 'sent').length;
    return { text: n > 0 ? `Agent is working through your ${n} ${plural(n, 'update')}` : 'Agent is working', working: true };
  }
  if (s.progress.open > 0) return { text: 'Agent is waiting for you', working: false };
  if (s.progress.total === 0) return { text: 'Agent is preparing questions', working: false };
  return { text: 'All questions answered', working: false };
}

export function SessionView({ pk, id, dir, api = defaultApi, storage: storageProp, send, timers }: Props) {
  const [storage] = useState(() => storageProp ?? browserStorage());
  const listRef = useRef<HTMLDivElement>(null);
  const respondRef = useRef<HTMLButtonElement>(null);
  /** After a fold: the card to unfold and focus, or null for Respond (or the folded card when Respond is off). */
  const focusAfter = useRef<{ next: string | null; from: string; waits: number; scroll?: boolean; card?: boolean } | null>(null);
  const anchor = useRef<{ el: Element; top: number } | null>(null);
  /** The card that last held focus. Task 10 drives this too. */
  const [focused, setFocused] = useState<string | null>(null);
  const focusedRef = useRef(focused);
  focusedRef.current = focused;
  const [help, setHelp] = useState(false);
  /** Set each render once the state is known; the one document keydown listener calls it. */
  // The listener is registered once, but needs the current state, which only exists after the early returns below.
  const keyRun = useRef<(a: KeyAction, target: EventTarget | null) => boolean>(() => false);
  useSessionKeys((a, target) => keyRun.current(a, target));

  const data = useSessionData({ pk, id, api, storage, send, timers,
    // Remember where the card the user is in sits, so the layout effect below can keep it there.
    beforeUpdate: () => {
      const active = document.activeElement?.closest?.('[data-qid]') ?? cardEl(listRef.current, focusedRef.current ?? '');
      anchor.current = active ? { el: active, top: active.getBoundingClientRect().top } : null;
    } });
  const { outbox, state, drafts, queued, offline, authLost } = data;

  const laterKey = `rt-later-${pk}-${id}`;
  const [later, setLater] = useState(() => readLater(storage, laterKey));
  const [filter, setFilter] = useState<Filter>('all');
  /** The unfolded card; undefined until the first state arrives. Task 10 drives this too. */
  const [expanded, setExpanded] = useState<string | null | undefined>(undefined);
  /** The user pressed Change on an assumed question in the summary: the list is shown until Back to summary. */
  const [listFromSummary, setListFromSummary] = useState(false);
  /** A closed session is a record: any number of its cards can be unfolded at once. */
  const [records, setRecords] = useState<string[]>([]);
  const phase = data.state?.phase;
  useEffect(() => { if (phase === 'active' && listFromSummary) setListFromSummary(false); }, [phase, listFromSummary]);

  // A live update must not move the card the user is in: undo any shift caused by content above it,
  // whether new content or the offline or lost-access banner appearing or going.
  useLayoutEffect(() => {
    const a = anchor.current;
    anchor.current = null;
    if (!a || !a.el.isConnected) return;
    const delta = a.el.getBoundingClientRect().top - a.top;
    if (delta !== 0) window.scrollBy(0, delta);
  }, [data.payload, offline, authLost]);

  const shownExpanded = expanded !== undefined ? expanded : state ? firstOpen(state, later) : null;
  useLayoutEffect(() => { if (expanded === undefined && state) setExpanded(shownExpanded); });

  useEffect(() => {
    const target = focusAfter.current;
    if (target === null) return;
    const root = (qid: string) => cardEl(listRef.current, qid);
    // A card that was folded back keeps the keyboard: focus the card itself, not a field of its closing form.
    if (target.card) { focusAfter.current = null; root(target.from)?.focus(); return; }
    // An effect left over from an earlier render can run before the render that unfolds the card.
    // Wait for the card to show its form, but only for a couple of runs so a stale request cannot linger.
    if (target.next !== null && !root(target.next)?.classList.contains('is-expanded') && target.waits++ < 2) return;
    focusAfter.current = null;
    if (target.next !== null) {
      const card = root(target.next);
      (card?.querySelector<HTMLElement>('input, textarea') ?? card)?.focus();
      if (target.scroll) card?.scrollIntoView?.({ block: 'center' });
    } else if (respondRef.current && !respondRef.current.disabled) {
      respondRef.current.focus();
    } else {
      root(target.from)?.focus();
    }
  });

  if (data.loadError === 'not_found') return <Message text="This session was not found." />;
  if (data.loadError === 'unsupported') return <Message text="Update Rotisserie to view this session." />;
  if (!state) {
    if (authLost) return <Message text="This session cannot be loaded." banner={AUTH_LOST} />;
    return data.failures > 0
      ? <Message text="This session cannot be loaded right now. Retrying…" banner={OFFLINE} />
      : <Message text="Loading session…" />;
  }

  const readOnly = state.phase === 'confirmed';
  const inSummary = (state.phase === 'summary' || state.phase === 'confirmed') && !listFromSummary;
  const rejected = outbox.rejected();
  const orphanRejected = rejected.filter((r) => !('qid' in r.action) || !state.questions[r.action.qid]);
  const activeQid = (document.activeElement?.closest?.('[data-qid]') as HTMLElement | null)?.dataset.qid;
  const visible = (q: Question) => matches(q, filter) || q.id === activeQid;
  const isLater = (qid: string) => later.includes(qid) && state.questions[qid]?.status === 'open';

  const saveLater = (next: string[]) => {
    setLater(next);
    try { storage.setItem(laterKey, JSON.stringify(next)); } catch { /* kept for this visit only */ }
  };
  /** Fold the card and unfold the next open one below it, moving focus there (or to Respond). */
  const advance = (qid: string, nowLater: string[]) => {
    const eligible = state.order.filter((x) => x === qid
      || (!nowLater.includes(x) && matches(state.questions[x]!, filter)));
    const next = nextOpen(eligible, state.questions, qid);
    setExpanded(next);
    focusAfter.current = { next, from: qid, waits: 0 };
  };
  const mark = (qid: string, response: UserResponse) => {
    outbox.enqueue({ kind: 'mark', qid, response });
    const nowLater = later.filter((x) => x !== qid);
    if (nowLater.length !== later.length) saveLater(nowLater);
    advance(qid, nowLater);
  };
  const handlers = {
    onDone: mark,
    onSkip: (qid: string) => mark(qid, { kind: 'skip' }),
    onInvalid: (qid: string, reason: string) => mark(qid, { kind: 'invalid', reason }),
    onLater: (qid: string) => {
      const nowLater = later.includes(qid) ? later : [...later, qid];
      saveLater(nowLater);
      advance(qid, nowLater);
    },
    // Edit and Reopen remove the button that was clicked, so move focus into the unfolded card; otherwise
    // focus falls to the page and the card's shortcuts stop working.
    onEdit: (qid: string) => {
      if (readOnly) { setRecords((r) => (r.includes(qid) ? r : [...r, qid])); focusAfter.current = { next: null, from: qid, waits: 0, card: true }; return; }
      setExpanded(qid); focusAfter.current = { next: qid, from: qid, waits: 0 };
    },
    onClose: (qid: string) => {
      if (readOnly) setRecords((r) => r.filter((x) => x !== qid)); else setExpanded(null);
      focusAfter.current = { next: null, from: qid, waits: 0, card: true };
    },
    onDraft: (qid: string, draft: Draft) => outbox.enqueue({ kind: 'draft', qid, draft }),
    onDismiss: (cid: string) => outbox.dismissRejected(cid),
  };

  const currentQid = () =>
    (document.activeElement?.closest?.('[data-qid]') as HTMLElement | null)?.dataset.qid ?? null;
  const press = (qid: string, selector: string): boolean => {
    const el = cardEl(listRef.current, qid)?.querySelector<HTMLElement>(selector);
    if (!el || (el instanceof HTMLButtonElement && el.disabled)) return false;
    el.click();
    return true;
  };
  /** j, k, Alt+arrows and n: focus another card, starting from the first when none is focused. */
  const moveTo = (pick: (ids: string[], at: number) => string | undefined): boolean => {
    const ids = state.order.filter((x) => cardEl(listRef.current, x)?.hidden === false);
    const cur = currentQid();
    const target = pick(ids, cur === null ? -1 : ids.indexOf(cur));
    if (!target) return false;
    cardEl(listRef.current, target)?.focus();
    return true;
  };
  keyRun.current = (a, target) => {
    if (a.kind === 'help') { setHelp(!help); return true; }
    if (a.kind === 'escape') {
      if (help) { setHelp(false); return true; }
      const cur = currentQid();
      if (cur && target instanceof HTMLElement && !target.hasAttribute('data-qid') && target.matches('input, textarea, select')) {
        cardEl(listRef.current, cur)?.focus();
        return true;
      }
      // Esc on an unfolded answered card folds it back, unless that would throw away edits.
      return cur !== null && press(cur, '[data-rt-action="close"]:not([data-rt-dirty])');
    }
    if (a.kind === 'respond') {
      const btn = respondRef.current;
      if (!btn || btn.disabled) return false;
      btn.click();
      return true;
    }
    if (a.kind === 'next') return moveTo((ids, at) => ids[at < 0 ? 0 : at + 1]);
    if (a.kind === 'prev') return moveTo((ids, at) => ids[at < 0 ? 0 : at - 1]);
    if (a.kind === 'nextNew') return moveTo((ids, at) => ids.slice(at + 1).find((x) => state.questions[x]?.isNew));
    // With focus outside every card (a fresh page, a click on the header), the unfolded card is the one the
    // key hints on screen belong to, so the keys act on it.
    const cur = currentQid() ?? (shownExpanded && cardEl(listRef.current, shownExpanded)?.hidden === false ? shownExpanded : null);
    if (!cur) return false;
    switch (a.kind) {
      case 'done': return press(cur, '[data-rt-action="done"]');
      case 'skip': return press(cur, '[data-rt-action="skip"]');
      case 'invalid': return press(cur, '[data-rt-action="invalid"]');
      case 'later': return press(cur, '[data-rt-action="later"]');
      case 'accept': return press(cur, '[data-rt-action="accept"]');
      case 'option': {
        const input = cardEl(listRef.current, cur)?.querySelectorAll<HTMLInputElement>('.rt-option input')[a.n - 1];
        if (!input || input.disabled) return false;
        input.click();
        return true;
      }
      case 'unfold': {
        if (readOnly) { if (records.includes(cur)) handlers.onClose(cur); else handlers.onEdit(cur); return true; }
        if (state.questions[cur]?.status === 'retracted') return false;
        if (shownExpanded === cur) {
          const card = cardEl(listRef.current, cur);
          (card?.querySelector<HTMLElement>('input, textarea') ?? card)?.focus();
        } else {
          setExpanded(cur);
          focusAfter.current = { next: cur, from: cur, waits: 0 };
        }
        return true;
      }
    }
  };

  const renderNode = (qid: string) => {
    const q = state.questions[qid];
    if (!q) return null;
    return (
      <div class="rt-node" key={qid}>
        <QuestionCard question={q} draft={asDraft(drafts[qid])} expanded={readOnly ? records.includes(qid) : shownExpanded === qid} later={isLater(qid)}
          readOnly={readOnly} hidden={!visible(q)} focused={focused === qid} rejected={rejected.filter((r) => 'qid' in r.action && r.action.qid === qid)}
          {...handlers} />
        <div class="rt-children">{q.childIds.map(renderNode)}</div>
      </div>
    );
  };
  const roots = state.order.filter((qid) => {
    const parent = state.questions[qid]?.parentId;
    return parent === undefined || !state.questions[parent];
  });
  const counts: Record<Filter, number> = {
    all: state.progress.total, unanswered: state.progress.open, new: state.progress.newCount,
    assumed: Object.values(state.questions).filter((q) => q.status === 'assumed').length,
  };
  const status = statusLine(state);

  return (
    <div class="rt-session-view">
      <main class="rt-content rt-session-main">
        {authLost
          ? <p class="rt-banner is-alert" role="alert">{AUTH_LOST}</p>
          : offline && <p class="rt-banner" role="alert">{OFFLINE}</p>}
        {!outbox.storageOk() && <p class="rt-warning">{NOT_SAVED}</p>}
        <header class="rt-session-header">
          <div class="rt-title-row">
            <div class="rt-title-block">
              <h1 class="rt-h1">{state.title}</h1>
              <div class="rt-meta">
                <span class="rt-id-chip">{state.id}</span>
                {dir && <span>{dir}</span>}
              </div>
            </div>
            <button type="button" class="rt-btn rt-btn-small" aria-expanded={help} onClick={() => setHelp(!help)}>
              Keyboard shortcuts
            </button>
            <div role="status" class={`rt-status${status.working ? ' is-working' : ''}`}>
              {status.working
                ? <svg class="rt-spinner" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 3a9 9 0 1 0 9 9" /></svg>
                : <span class="rt-status-dot" aria-hidden="true" />}
              <span>{status.text}</span>
            </div>
          </div>
          {help && (
            <div class="rt-keys-panel" role="dialog" aria-label="Keyboard shortcuts">
              <dl class="rt-keys-list">
                {shortcutList().map((r) => (
                  <div key={r.keys} class="rt-keys-row"><dt><kbd class="rt-keycap">{r.keys}</kbd></dt><dd>{r.does}</dd></div>
                ))}
              </dl>
            </div>
          )}
          <ProgressMeter progress={state.progress} />
          <div class="rt-filters" role="group" aria-label="Filter questions">
            {FILTERS.map((f) => (
              <button key={f.key} type="button" class="rt-chip" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
                {f.label} <span class="rt-chip-n">{counts[f.key]}</span>
              </button>
            ))}
          </div>
        </header>
        {inSummary && (
          <Summary state={state} outbox={outbox} offline={offline}
            confirmPending={outbox.pending().some((a) => a.kind === 'confirm')}
            rejected={rejected.filter((r) => r.action.kind === 'confirm' || r.action.kind === 'reopen')}
            onViewList={() => setListFromSummary(true)}
            onChange={(qid) => {
              setListFromSummary(true);
              setExpanded(qid);
              focusAfter.current = { next: qid, from: qid, waits: 0, scroll: true };
            }} />
        )}
        {listFromSummary && (
          <div class="rt-list-bar">
            <button type="button" class="rt-btn rt-btn-small rt-back-summary" onClick={() => setListFromSummary(false)}>Back to summary</button>
            {readOnly && (
              <button type="button" class="rt-btn rt-btn-small"
                onClick={() => setRecords(records.length > 0 ? [] : state.order.filter((x) => state.questions[x]))}>
                {records.length > 0 ? 'Collapse all' : 'Expand all'}
              </button>
            )}
            {readOnly && <span class="rt-list-note">This session is closed. Questions and answers are read-only.</span>}
          </div>
        )}
        <div class="rt-questions" ref={listRef} hidden={inSummary}
          onFocusIn={(e) => {
            const qid = (e.target as Element | null)?.closest?.('[data-qid]')?.getAttribute('data-qid');
            if (qid && qid !== focused) setFocused(qid);
          }}>
          {roots.map(renderNode)}
        </div>
      </main>
      {!readOnly && !inSummary && (
        <div class="rt-respond-bar">
          <div class="rt-respond-inner">
            <div class="rt-respond-text">
              {queued !== null
                ? `Queued: ${queued} ${plural(queued, 'update')}`
                : state.unsentCount > 0
                  ? `${state.unsentCount} ${plural(state.unsentCount, 'update')} ready to send`
                  : 'Nothing new to send. Mark an answer Done to enable Respond.'}
              {orphanRejected.map((r) => (
                <span key={r.action.cid} class="rt-rejected-inline">
                  {`Not sent: ${r.message}`}
                  <button type="button" class="rt-btn rt-btn-small" onClick={() => outbox.dismissRejected(r.action.cid)}>Dismiss</button>
                </span>
              ))}
            </div>
            <button ref={respondRef} type="button" class="rt-btn-accent" aria-keyshortcuts={keyShortcuts('respond')}
              disabled={state.unsentCount === 0}
              onClick={() => outbox.enqueue({ kind: 'respond' })}>
              {offline ? 'Will send when the agent is back' : 'Respond to agent'}
              <KeyHint k="respond" />
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Message({ text, banner }: { text: string; banner?: string }) {
  return (
    <main class="rt-content">
      {banner && <p class="rt-banner" role="alert">{banner}</p>}
      <p class="rt-muted">{text}</p>
    </main>
  );
}
