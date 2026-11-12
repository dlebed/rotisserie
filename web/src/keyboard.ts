import { useEffect, useRef } from 'preact/hooks';
import type { Question } from '../../src/core/reduce';

/**
 * The first question after `from` in `order` whose status is `open`, or null. It does not wrap.
 * An unknown `from` starts from the top.
 */
export function nextOpen(order: string[], questions: Record<string, Question>, from: string): string | null {
  for (let i = order.indexOf(from) + 1; i < order.length; i++) {
    const qid = order[i];
    if (qid !== undefined && questions[qid]?.status === 'open') return qid;
  }
  return null;
}

let macOverride: boolean | undefined;
/** Test seam: force the platform (true is macOS), or undefined to detect it again. */
export function setPlatform(mac: boolean | undefined): void { macOverride = mac; }

/** True on macOS, where Mod is Cmd; everywhere else Mod is Ctrl. */
export function isMac(): boolean {
  if (macOverride !== undefined) return macOverride;
  if (typeof navigator === 'undefined') return false;
  const platform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform
    || navigator.platform || '';
  return /mac|iphone|ipad/i.test(platform);
}

export type HintKey = 'done' | 'respond' | 'skip' | 'invalid' | 'later' | 'accept';

/** What a button shows as its hint, and its `aria-keyshortcuts` value. */
export function hintFor(k: HintKey): { text: string; shortcut: string } {
  const mac = isMac();
  switch (k) {
    case 'done': return mac ? { text: '⌘↵', shortcut: 'Meta+Enter' } : { text: 'Ctrl+Enter', shortcut: 'Control+Enter' };
    case 'respond': return mac ? { text: '⌘⇧↵', shortcut: 'Meta+Shift+Enter' } : { text: 'Ctrl+Shift+Enter', shortcut: 'Control+Shift+Enter' };
    case 'skip': return { text: 's', shortcut: 's' };
    case 'invalid': return { text: 'i', shortcut: 'i' };
    case 'later': return { text: 'l', shortcut: 'l' };
    case 'accept': return { text: 'a', shortcut: 'a' };
  }
}

/** The rows of the `?` list, with the platform's Mod symbol. */
export function shortcutList(): { keys: string; does: string }[] {
  const mod = isMac() ? '⌘' : 'Ctrl+';
  const enter = isMac() ? '↵' : 'Enter';
  const shift = isMac() ? '⇧' : 'Shift+';
  return [
    { keys: `${mod}${enter}`, does: 'Done, then the next open question' },
    { keys: `${mod}${shift}${enter}`, does: 'Respond to the agent' },
    { keys: 'Alt+↓ / Alt+↑', does: 'Next / previous question, also while typing' },
    { keys: 'j / k', does: 'Next / previous question' },
    { keys: 'n', does: 'Next new question' },
    { keys: '1–9', does: 'Pick or toggle that option' },
    { keys: 'a', does: 'Accept the recommendation' },
    { keys: 's / i / l', does: 'Skip, Invalid, Later' },
    { keys: 'e or Enter', does: 'Unfold the focused question' },
    { keys: 'Esc', does: 'Leave the text field; again to fold an answered question unchanged' },
    { keys: '?', does: 'Show or hide this list' },
  ];
}

export type KeyAction =
  | { kind: 'done' | 'respond' | 'next' | 'prev' | 'nextNew' | 'accept' | 'skip' | 'invalid' | 'later' | 'unfold' | 'escape' | 'help' }
  | { kind: 'option'; n: number };

/** Inputs where a letter is text. Radios, checkboxes and buttons are controls, so plain keys still work on them. */
function isTextField(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  if (t.isContentEditable || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return true;
  return t instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'image'].includes(t.type);
}

/** What a keydown means, or null when it is not ours (an IME, a browser shortcut, a letter being typed). */
export function keyAction(e: KeyboardEvent, mac: boolean): KeyAction | null {
  const a = parse(e, mac);
  // Holding a key must not repeat Done, Skip or Respond; only navigation may repeat.
  return a && e.repeat && a.kind !== 'next' && a.kind !== 'prev' ? null : a;
}

function parse(e: KeyboardEvent, mac: boolean): KeyAction | null {
  if (e.isComposing) return null;
  const mod = mac ? e.metaKey : e.ctrlKey;
  const stray = mac ? e.ctrlKey : e.metaKey;
  if (e.key === 'Enter' && mod && !stray && !e.altKey) return { kind: e.shiftKey ? 'respond' : 'done' };
  if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
    if (e.key === 'ArrowDown') return { kind: 'next' };
    if (e.key === 'ArrowUp') return { kind: 'prev' };
    return null;
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  if (e.key === 'Escape') return { kind: 'escape' };
  if (isTextField(e.target)) return null;
  switch (e.key) {
    case 'j': return { kind: 'next' };
    case 'k': return { kind: 'prev' };
    case 'n': return { kind: 'nextNew' };
    case 'a': return { kind: 'accept' };
    case 's': return { kind: 'skip' };
    case 'i': return { kind: 'invalid' };
    case 'l': return { kind: 'later' };
    case 'e': return { kind: 'unfold' };
    case '?': return { kind: 'help' };
    case 'Enter': return e.target instanceof HTMLElement && e.target.hasAttribute('data-qid') ? { kind: 'unfold' } : null;
  }
  return /^[1-9]$/.test(e.key) ? { kind: 'option', n: Number(e.key) } : null;
}

/**
 * One document-level keydown listener. `run` gets each shortcut and returns true when it handled it
 * (only then is the browser's own behaviour prevented).
 */
export function useSessionKeys(run: (action: KeyAction, target: EventTarget | null) => boolean): void {
  const latest = useRef(run);
  latest.current = run;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const action = keyAction(e, isMac());
      if (action && latest.current(action, e.target)) e.preventDefault();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
}
