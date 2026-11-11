import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { SessionState } from '../../src/core/reduce';

const CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data:";
const THEME_VARS = ['--rt-bg', '--rt-surface', '--rt-text', '--rt-text-2', '--rt-muted', '--rt-border', '--rt-accent',
  '--rt-sent', '--rt-done', '--rt-assumed', '--rt-invalid'];
/** Hex, rgb()/hsl() forms or a plain keyword. Nothing that could close a style element or start a url(). */
const SAFE_COLOUR = /^(?:#[0-9a-f]{3,8}|(?:rgb|rgba|hsl|hsla)\([0-9a-z\s.,%/+-]{1,80}\)|[a-z]{3,30})$/i;
const SAFE_NAME = /^--rt-[a-z0-9-]+$/;
const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

/** The document shown inside the sandboxed frame. The agent's html goes in verbatim: the sandbox and the CSP are the defence. */
export function buildSummaryDoc(html: string, themeVars: Record<string, string>): string {
  const vars = Object.entries(themeVars)
    .filter(([k, v]) => SAFE_NAME.test(k) && SAFE_COLOUR.test(v.trim()))
    .map(([k, v]) => `${k}:${v.trim()}`).join(';');
  const css = `:root{${vars}}`
    + `html{color-scheme:light dark}`
    + `body{margin:0;padding:20px 24px;background:var(--rt-surface,Canvas);color:var(--rt-text,CanvasText);font:15px/1.6 ${FONT};overflow-wrap:anywhere}`
    + `h1,h2,h3,h4{line-height:1.3;margin:1.2em 0 .5em}h1{font-size:1.5em}h2{font-size:1.25em}h3{font-size:1.05em}`
    + `p,ul,ol{margin:.6em 0}a{color:var(--rt-accent,LinkText)}`
    + `table{border-collapse:collapse;max-width:100%}th,td{border:1px solid var(--rt-border,GrayText);padding:6px 10px;text-align:left}`
    + `code,pre{font-family:${MONO};font-size:.9em}pre{overflow:auto;padding:12px;border:1px solid var(--rt-border,GrayText);border-radius:8px}`
    + `svg{max-width:100%}img{max-width:100%}`;
  return `<!doctype html>\n<html><head>\n<meta http-equiv="Content-Security-Policy" content="${CSP}">\n<meta charset="utf-8">\n`
    + `<style>${css}</style>\n</head>\n<body>\n${html}\n</body></html>`;
}

function readThemeVars(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const cs = getComputedStyle(document.documentElement);
    for (const name of THEME_VARS) {
      const v = cs.getPropertyValue(name).trim();
      if (v) out[name] = v;
    }
  } catch { /* no computed style: the frame falls back to system colours */ }
  return out;
}

/** The live theme variables; changes when data-theme on <html> or the system colour scheme changes. */
function useThemeVars(): Record<string, string> {
  const [vars, setVars] = useState(readThemeVars);
  useEffect(() => {
    const update = () => setVars((prev) => {
      const next = readThemeVars();
      return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
    });
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const mq = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    mq?.addEventListener?.('change', update);
    update();
    return () => { observer.disconnect(); mq?.removeEventListener?.('change', update); };
  }, []);
  return vars;
}

type Props = {
  state: SessionState;
  outbox: { enqueue: (a: { kind: 'confirm' } | { kind: 'reopen'; note: string }) => unknown; dismissRejected: (cid: string) => void };
  offline: boolean;
  /** A confirm is queued but not delivered yet: the page still shows the confirm block. */
  confirmPending: boolean;
  /** Refused confirm/reopen actions, shown here because the Respond bar is not. */
  rejected: { action: { cid: string }; message: string }[];
  onChange: (qid: string) => void;
};

export function Summary({ state, outbox, offline, confirmPending, rejected, onChange }: Props) {
  const summary = state.summary;
  const themeVars = useThemeVars();
  const doc = useMemo(() => buildSummaryDoc(summary?.html ?? '', themeVars), [summary?.html, themeVars]);
  const [big, setBig] = useState(false);
  const [note, setNote] = useState('');
  const [missing, setMissing] = useState(false);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  if (!summary) return null;
  const closed = state.phase === 'confirmed' && !confirmPending;
  const assumed = state.order.map((qid) => state.questions[qid]).filter((q) => q?.status === 'assumed');

  const notYet = () => {
    const text = note.trim();
    if (text === '') { setMissing(true); noteRef.current?.focus(); return; }
    outbox.enqueue({ kind: 'reopen', note: text });
    setNote(''); setMissing(false);
  };
  const exportMd = () => {
    const url = URL.createObjectURL(new Blob([summary.markdown], { type: 'text/markdown;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `${state.id}-summary.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <section class="rt-summary" aria-label="Summary">
      <div class="rt-summary-head">
        <h2 class="rt-summary-title">{closed ? 'Shared understanding, confirmed' : 'Do we have a shared understanding?'}</h2>
        <button type="button" class="rt-btn rt-export" onClick={exportMd}>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11" /><path d="M7 11l5 5 5-5" /><path d="M5 20h14" /></svg>
          {' '}Export Markdown
        </button>
      </div>
      <div class="rt-summary-frame-card">
        <div class="rt-summary-frame-bar">
          <span class="rt-eyebrow">Summary from the agent</span>
          <button type="button" class="rt-btn rt-btn-small" aria-expanded={big} onClick={() => setBig(!big)}>
            {big ? 'Collapse' : 'Expand'}
          </button>
        </div>
        {summary.abstract && <p class="rt-summary-abstract rt-pre">{summary.abstract}</p>}
        <iframe class="rt-summary-frame" title="Summary from the agent" sandbox="" referrerpolicy="no-referrer"
          style={{ height: big ? '90vh' : 'min(70vh, 720px)' }} srcdoc={doc} />
      </div>
      {assumed.length > 0 && (
        <section class="rt-assumed-list" aria-label="Decisions assumed by the agent">
          <h3 class="rt-assumed-title">Assumed by agent ({assumed.length}). Check these before you confirm.</h3>
          {assumed.map((q) => q && (
            <div key={q.id} class="rt-assumed-row">
              <span class="rt-qid">{q.id}</span>
              <div class="rt-assumed-text">
                <div class="rt-assumed-decision">{q.decision ?? q.title}</div>
                {q.reason && <div class="rt-assumed-reason">{`Why: ${q.reason}`}</div>}
              </div>
              {!closed && !confirmPending && <button type="button" class="rt-btn" onClick={() => onChange(q.id)}>Change</button>}
            </div>
          ))}
        </section>
      )}
      {closed
        ? <p class="rt-summary-closed" role="status"><span class="rt-state-label">Closed</span> The session is confirmed and read-only.</p>
        : (
          <div class="rt-confirm-block">
            <label class="rt-confirm-label" for="rt-notyet">Not there yet? Tell the agent what is missing.</label>
            <textarea id="rt-notyet" ref={noteRef} class="rt-confirm-note" rows={3} value={note}
              aria-describedby={missing ? 'rt-notyet-error' : undefined} aria-invalid={missing}
              onInput={(e) => { setNote((e.target as HTMLTextAreaElement).value); if (missing) setMissing(false); }} />
            {missing && <p id="rt-notyet-error" class="rt-confirm-error">Add a note so the agent knows what is missing.</p>}
            <div class="rt-confirm-actions">
              <p class="rt-confirm-hint">Confirming closes the session and makes it read-only.</p>
              <button type="button" class="rt-btn" disabled={confirmPending} onClick={notYet}>Not yet, keep grilling</button>
              <button type="button" class="rt-btn-accent" onClick={() => { if (!confirmPending) outbox.enqueue({ kind: 'confirm' }); }}>
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                Confirm shared understanding
              </button>
            </div>
            {rejected.map((r) => (
              <p key={r.action.cid} class="rt-confirm-error" role="alert">
                {`Not sent: ${r.message}`}{' '}
                <button type="button" class="rt-btn rt-btn-small" onClick={() => outbox.dismissRejected(r.action.cid)}>Dismiss</button>
              </p>
            ))}
            {offline && <p class="rt-confirm-offline">The confirmation will be sent when the agent is back.</p>}
          </div>
        )}
    </section>
  );
}
