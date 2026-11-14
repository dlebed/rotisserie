import { cleanup, render, screen, waitFor, within } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionView } from '../../web/src/SessionView';
import { nextOpen, setPlatform } from '../../web/src/keyboard';
import type { Question } from '../../src/core/reduce';
import type { EventBody } from '../../src/core/events';
import { created, fakeServer, manualTimers, MemStorage, qi, question } from './fixtures';

afterEach(() => { cleanup(); setPlatform(undefined); vi.restoreAllMocks(); });

const posted = (...questions: ReturnType<typeof qi>[]): EventBody => ({ type: 'questions_posted', questions });
const cardOf = (qid: string) => document.querySelector(`[data-qid="${qid}"]`) as HTMLElement;
const findCard = (qid: string) => waitFor(() => {
  const el = cardOf(qid);
  if (!el) throw new Error(`no card ${qid}`);
  return el;
});
const label = (qid: string) => cardOf(qid).querySelector('.rt-state-label')?.textContent;
const answerBox = (qid: string) => within(cardOf(qid)).getByRole<HTMLTextAreaElement>('textbox', { name: /answer/i });
const respondBtn = () => screen.getByRole<HTMLButtonElement>('button', { name: /Respond to agent/ });

function mount(s: ReturnType<typeof fakeServer>) {
  const t = manualTimers();
  return render(<SessionView pk="pk" id="rt-0001" api={s.api} storage={new MemStorage()} timers={t.timers} />);
}
const abc = () => fakeServer([created(), posted(qi('Q1', 'One'), qi('Q2', 'Two'), qi('Q3', 'Three'))]);

describe('nextOpen', () => {
  const qs = (statuses: Record<string, Question['status']>) =>
    Object.fromEntries(Object.entries(statuses).map(([id, status]) => [id, question({ id, status })]));
  const order = ['Q1', 'Q1a', 'Q2'];

  it('returns the next open question, skipping retracted ones, and null after the last', () => {
    expect(nextOpen(order, qs({ Q1: 'open', Q1a: 'open', Q2: 'open' }), 'Q1')).toBe('Q1a');
    expect(nextOpen(order, qs({ Q1: 'open', Q1a: 'retracted', Q2: 'open' }), 'Q1')).toBe('Q2');
    expect(nextOpen(order, qs({ Q1: 'open', Q1a: 'open', Q2: 'open' }), 'Q2')).toBeNull();
    expect(nextOpen(order, qs({ Q1: 'open', Q1a: 'done', Q2: 'done' }), 'Q1')).toBeNull();   // no wrapping
  });
});

describe('keyboard shortcuts', () => {
  it('Mod+Enter in a textarea marks Done and moves focus into the next open card', async () => {
    const s = abc();
    mount(s);
    await userEvent.type(await within(await findCard('Q1')).findByRole('textbox', { name: 'Your answer' }), 'hello');
    await userEvent.keyboard('{Control>}{Enter}{/Control}');
    await waitFor(() => expect(s.send).toHaveBeenCalledWith(expect.objectContaining(
      { kind: 'mark', qid: 'Q1', response: { kind: 'answer', optionIds: [], text: 'hello' } })));
    await waitFor(() => expect(label('Q1')).toBe('Done, not sent'));
    expect(document.activeElement).toBe(answerBox('Q2'));
  });

  it('after the last open question, Mod+Enter focuses Respond', async () => {
    const s = fakeServer([created(), posted(qi('Q1', 'One'))]);
    mount(s);
    await userEvent.type(await within(await findCard('Q1')).findByRole('textbox', { name: 'Your answer' }), 'x');
    await userEvent.keyboard('{Control>}{Enter}{/Control}');
    await waitFor(() => expect(document.activeElement).toBe(respondBtn()));
  });

  it('uses Cmd on macOS and ignores Ctrl+Enter there', async () => {
    setPlatform(true);
    const s = abc();
    mount(s);
    await userEvent.type(await within(await findCard('Q1')).findByRole('textbox', { name: 'Your answer' }), 'x');
    await userEvent.keyboard('{Control>}{Enter}{/Control}');
    expect(s.send).not.toHaveBeenCalled();
    await userEvent.keyboard('{Meta>}{Enter}{/Meta}');
    await waitFor(() => expect(s.send).toHaveBeenCalledWith(expect.objectContaining({ kind: 'mark', qid: 'Q1' })));
  });

  it('Mod+Shift+Enter responds', async () => {
    const s = fakeServer([created(), posted(qi('Q1', 'One'), qi('Q2', 'Two')),
      { type: 'response_marked', qid: 'Q2', response: { kind: 'skip' } }]);
    mount(s);
    await waitFor(() => expect(respondBtn().disabled).toBe(false));
    await userEvent.keyboard('{Control>}{Shift>}{Enter}{/Shift}{/Control}');
    await waitFor(() => expect(s.send).toHaveBeenCalledWith(expect.objectContaining({ kind: 'respond' })));
  });

  it('a plain letter typed in a textarea is text, not a shortcut', async () => {
    const s = abc();
    mount(s);
    const ta = await within(await findCard('Q1')).findByRole('textbox', { name: 'Your answer' });
    await userEvent.type(ta, 'sj?');
    expect(ta).toHaveProperty('value', 'sj?');
    expect(s.send).not.toHaveBeenCalledWith(expect.objectContaining({ kind: 'mark' }));
    expect(screen.queryByRole('dialog', { name: 'Keyboard shortcuts' })).toBeNull();
  });

  it('s on a focused card skips it', async () => {
    const s = abc();
    mount(s);
    (await findCard('Q1')).focus();
    await userEvent.keyboard('s');
    await waitFor(() => expect(s.send).toHaveBeenCalledWith(expect.objectContaining({ kind: 'mark', qid: 'Q1', response: { kind: 'skip' } })));
    await waitFor(() => expect(label('Q1')).toBe('Skipped, not sent'));
  });

  it('with focus outside every card, s acts on the unfolded card', async () => {
    const s = abc();
    mount(s);
    await findCard('Q1');
    (document.activeElement as HTMLElement | null)?.blur();
    await userEvent.keyboard('s');
    await waitFor(() => expect(s.send).toHaveBeenCalledWith(expect.objectContaining({ kind: 'mark', qid: 'Q1', response: { kind: 'skip' } })));
  });

  it('does not take letters when Ctrl, Meta or Alt is held', async () => {
    const s = abc();
    mount(s);
    (await findCard('Q1')).focus();
    await userEvent.keyboard('{Control>}s{/Control}{Meta>}s{/Meta}');
    expect(s.send).not.toHaveBeenCalled();
  });

  it('i opens the invalid panel and l puts the card in Later', async () => {
    const s = abc();
    mount(s);
    (await findCard('Q1')).focus();
    await userEvent.keyboard('i');
    expect(within(cardOf('Q1')).getByText('Why is this question invalid?')).toBeTruthy();
    await userEvent.click(within(cardOf('Q1')).getByRole('button', { name: 'Cancel' }));
    cardOf('Q1').focus();
    await userEvent.keyboard('l');
    await waitFor(() => expect(label('Q1')).toBe('Later'));
  });

  it('a picks the recommendation', async () => {
    const s = fakeServer([created(), posted(qi('Q1', 'One', { options: [{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta', recommended: true }] }))]);
    mount(s);
    (await findCard('Q1')).focus();
    await userEvent.keyboard('a');
    await waitFor(() => expect(within(cardOf('Q1')).getByRole<HTMLInputElement>('radio', { name: /Beta/ }).checked).toBe(true));
  });

  it('a number picks that option, and again deselects it; it toggles checkboxes', async () => {
    const opts = [{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta' }];
    const s = fakeServer([created(), posted(qi('Q1', 'One', { options: opts }), qi('Q2', 'Two', { options: opts, multi: true }))]);
    mount(s);
    (await findCard('Q1')).focus();
    await userEvent.keyboard('2');
    await waitFor(() => expect(within(cardOf('Q1')).getByRole<HTMLInputElement>('radio', { name: /Beta/ }).checked).toBe(true));
    await userEvent.keyboard('2');
    await waitFor(() => expect(within(cardOf('Q1')).getByRole<HTMLInputElement>('radio', { name: /Beta/ }).checked).toBe(false));
    await userEvent.click(within(cardOf('Q2')).getByRole('button', { name: /Two/ }));
    cardOf('Q2').focus();
    await userEvent.keyboard('1');
    await waitFor(() => expect(within(cardOf('Q2')).getByRole<HTMLInputElement>('checkbox', { name: /Alpha/ }).checked).toBe(true));
    await userEvent.keyboard('1');
    await waitFor(() => expect(within(cardOf('Q2')).getByRole<HTMLInputElement>('checkbox', { name: /Alpha/ }).checked).toBe(false));
  });

  it('Alt+ArrowDown and Alt+ArrowUp move between questions, also from inside a textarea', async () => {
    const s = abc();
    mount(s);
    await userEvent.click(await within(await findCard('Q1')).findByRole('textbox', { name: 'Your answer' }));
    await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(document.activeElement).toBe(cardOf('Q2'));
    await userEvent.keyboard('{Alt>}{ArrowUp}{/Alt}');
    expect(document.activeElement).toBe(cardOf('Q1'));
  });

  it('j and k stop on every question, including answered ones; with no focus they start at the first', async () => {
    const s = fakeServer([created(), posted(qi('Q1', 'One'), qi('Q2', 'Two'), qi('Q3', 'Three')),
      { type: 'response_marked', qid: 'Q2', response: { kind: 'skip' } }]);
    mount(s);
    await findCard('Q1');
    (document.activeElement as HTMLElement | null)?.blur();
    await userEvent.keyboard('j');
    expect(document.activeElement).toBe(cardOf('Q1'));
    await userEvent.keyboard('j');
    expect(document.activeElement).toBe(cardOf('Q2'));
    await userEvent.keyboard('j');
    expect(document.activeElement).toBe(cardOf('Q3'));
    await userEvent.keyboard('k');
    expect(document.activeElement).toBe(cardOf('Q2'));
  });

  it('n goes to the next new question', async () => {
    const s = fakeServer([created(), posted(qi('Q1', 'One'), qi('Q2', 'Two')),
      { type: 'response_marked', qid: 'Q1', response: { kind: 'skip' } }, { type: 'batch_sent' },
      posted(qi('Q3', 'Three'), qi('Q4', 'Four'))]);
    mount(s);
    await findCard('Q1');
    cardOf('Q1').focus();
    await userEvent.keyboard('n');
    expect(document.activeElement).toBe(cardOf('Q3'));
    await userEvent.keyboard('n');
    expect(document.activeElement).toBe(cardOf('Q4'));
  });

  it('Enter or e on a focused folded card unfolds it, but Enter on a button is left alone', async () => {
    const s = fakeServer([created(), posted(qi('Q1', 'One'), qi('Q2', 'Two'), qi('Q3', 'Three'))]);
    mount(s);
    await findCard('Q2');
    expect(within(cardOf('Q2')).queryByRole('textbox')).toBeNull();
    cardOf('Q2').focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(document.activeElement).toBe(answerBox('Q2')));
    cardOf('Q3').focus();
    await userEvent.keyboard('e');
    await waitFor(() => expect(document.activeElement).toBe(answerBox('Q3')));
    const skip = within(cardOf('Q3')).getByRole('button', { name: 'Skip' });
    skip.focus();
    const keydown = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    skip.dispatchEvent(keydown);
    expect(keydown.defaultPrevented).toBe(false);
  });

  it('Escape leaves the text field and keeps the card focused', async () => {
    const s = abc();
    mount(s);
    const ta = await within(await findCard('Q1')).findByRole('textbox', { name: 'Your answer' });
    await userEvent.click(ta);
    await userEvent.keyboard('{Escape}');
    expect(document.activeElement).toBe(cardOf('Q1'));
  });

  it('ignores keys while an IME is composing', async () => {
    const s = abc();
    mount(s);
    const card = await findCard('Q1');
    card.focus();
    const e = new KeyboardEvent('keydown', { key: 's', isComposing: true, bubbles: true, cancelable: true });
    card.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
    expect(s.send).not.toHaveBeenCalled();
  });

  it('does not preventDefault for keys it does not handle', async () => {
    const s = abc();
    mount(s);
    const card = await findCard('Q1');
    card.focus();
    const e = new KeyboardEvent('keydown', { key: 'x', bubbles: true, cancelable: true });
    card.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
  });

  it('? toggles the shortcut list, which also closes with Escape; the header button toggles it too', async () => {
    const s = abc();
    mount(s);
    await findCard('Q1');
    (document.activeElement as HTMLElement | null)?.blur();
    await userEvent.keyboard('?');
    const dlg = screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
    expect(dlg.textContent).toContain('Ctrl+Enter');
    expect(dlg.textContent).toContain('Skip');
    await userEvent.keyboard('?');
    expect(screen.queryByRole('dialog')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Keyboard shortcuts' }));
    expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeTruthy();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('the shortcut list shows the Cmd symbol on macOS', async () => {
    setPlatform(true);
    mount(abc());
    await userEvent.click(await screen.findByRole('button', { name: 'Keyboard shortcuts' }));
    expect(screen.getByRole('dialog').textContent).toContain('⌘↵');
  });

  it('buttons carry a hidden hint and aria-keyshortcuts', async () => {
    const s = fakeServer([created(), posted(qi('Q1', 'One', { options: [{ id: 'a', label: 'A', recommended: true }] }))]);
    mount(s);
    const card = await findCard('Q1');
    const done = within(card).getByRole('button', { name: 'Done' });
    expect(done.getAttribute('aria-keyshortcuts')).toBe('Control+Enter');
    const kbd = done.querySelector('kbd');
    expect(kbd?.textContent).toBe('Ctrl+Enter');
    expect(kbd?.getAttribute('aria-hidden')).toBe('true');
    expect(within(card).getByRole('button', { name: 'Skip' }).querySelector('kbd')?.textContent).toBe('s');
    expect(within(card).getByRole('button', { name: 'Accept' }).getAttribute('aria-keyshortcuts')).toBe('a');
    expect(respondBtn().querySelector('kbd')?.getAttribute('aria-hidden')).toBe('true');
    expect(respondBtn().getAttribute('aria-keyshortcuts')).toBe('Control+Shift+Enter');
  });

  it('shows the Cmd hint and Meta shortcut on macOS', async () => {
    setPlatform(true);
    mount(fakeServer([created(), posted(qi('Q1', 'One'))]));
    const done = within(await findCard('Q1')).getByRole('button', { name: 'Done' });
    expect(done.querySelector('kbd')?.textContent).toBe('⌘↵');
    expect(done.getAttribute('aria-keyshortcuts')).toBe('Meta+Enter');
  });

  it('registers one document keydown listener and removes it on unmount', async () => {
    const add = vi.spyOn(document, 'addEventListener');
    const remove = vi.spyOn(document, 'removeEventListener');
    const r = mount(abc());
    await findCard('Q1');
    const added = add.mock.calls.filter((c) => c[0] === 'keydown');
    expect(added).toHaveLength(1);
    r.unmount();
    await waitFor(() => expect(remove.mock.calls.filter((c) => c[0] === 'keydown' && c[1] === added[0]?.[1])).toHaveLength(1));
  });

  it('a live update does not change the focused question or move focus', async () => {
    const s = abc();
    mount(s);
    await findCard('Q1');
    cardOf('Q2').focus();
    s.push(posted(qi('Q0', 'Zero')));
    s.push({ type: 'status_set', text: 'busy' });
    s.emit();
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('busy'));
    expect(document.activeElement).toBe(cardOf('Q2'));
  });

  it('shows "Agent is preparing questions" with no questions, but an agent status wins', async () => {
    const s = fakeServer([created()]);
    mount(s);
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Agent is preparing questions'));
    s.push({ type: 'status_set', text: 'Reading the code' });
    s.emit();
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Reading the code'));
    expect(screen.getByRole('status').textContent).not.toContain('preparing');
  });

  it('a held key does not repeat Done, Skip or Respond, but navigation repeats', async () => {
    const s = abc();
    mount(s);
    const card = await findCard('Q1');
    card.focus();
    const press = (init: KeyboardEventInit) => {
      const e = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, repeat: true, ...init });
      document.activeElement?.dispatchEvent(e);
      return e.defaultPrevented;
    };
    expect(press({ key: 's' })).toBe(false);
    expect(press({ key: 'Enter', ctrlKey: true })).toBe(false);
    expect(press({ key: 'Enter', ctrlKey: true, shiftKey: true })).toBe(false);
    expect(s.send).not.toHaveBeenCalled();
    expect(press({ key: 'j' })).toBe(true);
    expect(document.activeElement).toBe(cardOf('Q2'));
  });

  it('a number key with no such option does nothing and is not prevented', async () => {
    const s = fakeServer([created(), posted(qi('Q1', 'One', { options: [{ id: 'a', label: 'Alpha' }] }))]);
    mount(s);
    const card = await findCard('Q1');
    card.focus();
    const e = new KeyboardEvent('keydown', { key: '5', bubbles: true, cancelable: true });
    card.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
  });

  it('a card reached with j, k or Alt+ArrowDown is active and carries the focus-ring class', async () => {
    const s = abc();
    mount(s);
    await findCard('Q1');
    (document.activeElement as HTMLElement | null)?.blur();
    await userEvent.keyboard('j');
    await waitFor(() => expect(cardOf('Q1').classList.contains('is-kbd-focus')).toBe(true));
    await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}');
    await waitFor(() => expect(cardOf('Q2').classList.contains('is-kbd-focus')).toBe(true));
    expect(document.activeElement).toBe(cardOf('Q2'));
    expect(cardOf('Q1').classList.contains('is-kbd-focus')).toBe(false);
    await userEvent.keyboard('k');
    await waitFor(() => expect(cardOf('Q1').classList.contains('is-kbd-focus')).toBe(true));
    expect(document.activeElement).toBe(cardOf('Q1'));
  });
});
