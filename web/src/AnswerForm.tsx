import { useEffect, useId, useRef, useState } from 'preact/hooks';
import type { Question } from '../../src/core/reduce';
import { KeyHint, keyShortcuts } from './KeyHint';
import type { Draft } from './QuestionCard';

/** Recommendation, options, free text and note of an unfolded card. Controlled: the card owns the draft. */
export function AnswerForm({ q, draft, saved, onChange }: {
  q: Question; draft: Draft; saved: boolean; onChange(d: Draft): void;
}) {
  const id = useId();
  const options = q.options ?? [];
  const recommended = options.filter((o) => o.recommended).map((o) => o.id);
  const recText = q.recommendation ?? options.filter((o) => o.recommended).map((o) => o.label).join(', ');

  const accept = () => {
    if (recommended.length > 0) onChange({ ...draft, optionIds: q.multi ? recommended : recommended.slice(0, 1) });
    else if (q.recommendation) onChange({ ...draft, text: q.recommendation });
  };
  const toggle = (oid: string, on: boolean) => {
    const set = new Set(q.multi ? draft.optionIds : []);
    if (on) set.add(oid); else set.delete(oid);
    onChange({ ...draft, optionIds: options.filter((o) => set.has(o.id)).map((o) => o.id) });
  };

  return (
    <>
      {recText && (
        <div class="rt-rec">
          <div class="rt-rec-text">
            <div class="rt-eyebrow">Agent recommends</div>
            <div class="rt-pre">{recText}</div>
          </div>
          <button type="button" class="rt-btn" data-rt-action="accept" aria-keyshortcuts={keyShortcuts('accept')} onClick={accept}>Accept<KeyHint k="accept" /></button>
        </div>
      )}
      {options.length > 0 && (
        <fieldset class="rt-options">
          <legend class="rt-eyebrow">{q.multi ? 'Pick any' : 'Pick one'}</legend>
          {options.map((o) => {
            const checked = draft.optionIds.includes(o.id);
            return (
              <label key={o.id} class={`rt-option${checked ? ' is-checked' : ''}`}>
                <input type={q.multi ? 'checkbox' : 'radio'} name={`${id}-opt`} checked={checked}
                  onChange={(e) => toggle(o.id, e.currentTarget.checked)}
                  // A checked radio gets no change event, so a second click (or its number key) deselects it here.
                  onClick={() => { if (!q.multi && checked) toggle(o.id, false); }} />
                <span class="rt-option-text">
                  <span class="rt-option-head">
                    <span class="rt-option-label">{o.label}</span>
                    {o.recommended && <span class="rt-tag">Recommended</span>}
                  </span>
                  {o.consequence && <span class="rt-option-consequence">{o.consequence}</span>}
                </span>
              </label>
            );
          })}
        </fieldset>
      )}
      <div class="rt-field">
        <label class="rt-field-label" for={`${id}-text`}>{options.length > 0 ? 'Write my own answer' : 'Your answer'}</label>
        <textarea id={`${id}-text`} class="rt-input rt-textarea" rows={3} value={draft.text}
          onInput={(e) => onChange({ ...draft, text: e.currentTarget.value })} />
        <div class="rt-hint" aria-live="polite">{saved ? 'Draft saved' : ''}</div>
      </div>
      <div class="rt-field">
        <label class="rt-field-label" for={`${id}-note`}>Add a note (optional)</label>
        <input id={`${id}-note`} class="rt-input" type="text" value={draft.note} placeholder="For example: only for v1"
          onInput={(e) => onChange({ ...draft, note: e.currentTarget.value })} />
      </div>
    </>
  );
}

const REASONS = ['wrong premise', 'already answered', 'out of scope', 'unclear'] as const;

/** Invalid asks for a reason and an optional note before it folds. */
export function InvalidPanel({ onCancel, onSubmit }: { onCancel(): void; onSubmit(reason: string): void }) {
  const id = useId();
  const [reason, setReason] = useState<string | null>(null);
  const [why, setWhy] = useState('');
  const first = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  // Bring the whole panel above the fixed Respond bar, not only the first chip.
  useEffect(() => { first.current?.focus(); panel.current?.scrollIntoView?.({ block: 'nearest' }); }, []);
  const submit = () => { if (reason) onSubmit(why.trim() ? `${reason}: ${why.trim()}` : reason); };
  return (
    <div ref={panel} class="rt-invalid-panel" role="group" aria-labelledby={`${id}-why`}>
      <div class="rt-field-label" id={`${id}-why`}>Why is this question invalid?</div>
      <div class="rt-chips">
        {REASONS.map((r, i) => (
          <button key={r} ref={i === 0 ? first : undefined} type="button" class="rt-chip" aria-pressed={reason === r}
            onClick={() => setReason(r)}>{r[0]!.toUpperCase() + r.slice(1)}</button>
        ))}
      </div>
      <div class="rt-field">
        <label class="rt-field-label" for={`${id}-note`}>Explain (optional)</label>
        <input id={`${id}-note`} class="rt-input" type="text" value={why} onInput={(e) => setWhy(e.currentTarget.value)} />
      </div>
      <div class="rt-actions">
        <button type="button" class="rt-btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="button" class="rt-btn-primary" disabled={!reason} onClick={submit}>Mark invalid</button>
      </div>
    </div>
  );
}
