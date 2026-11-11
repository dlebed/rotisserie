import { hintFor } from './keyboard';
import type { HintKey } from './keyboard';

/** The shortcut shown inside a button. Hidden from screen readers, which get `aria-keyshortcuts` instead. */
export function KeyHint({ k }: { k: HintKey }) {
  return <kbd class="rt-keycap" aria-hidden="true">{hintFor(k).text}</kbd>;
}

export const keyShortcuts = (k: HintKey) => hintFor(k).shortcut;
