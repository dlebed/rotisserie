import { act, cleanup, render, screen, within } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QuestionCard } from '../../web/src/QuestionCard';
import type { Question } from '../../src/core/reduce';
import { question } from './fixtures';

afterEach(cleanup);

function handlers() {
  return { onDone: vi.fn(), onSkip: vi.fn(), onInvalid: vi.fn(), onLater: vi.fn(), onEdit: vi.fn(), onDraft: vi.fn(), onDismiss: vi.fn() };
}

function card(q: Question, props: Partial<Parameters<typeof QuestionCard>[0]> = {}) {
  const h = handlers();
  const r = render(<QuestionCard question={q} expanded={false} {...h} {...props} />);
  return { ...h, ...r, root: r.container.querySelector(`[data-qid="${q.id}"]`) as HTMLElement };
}

const options = [
  { id: 'a', label: 'Stop and show the install command', consequence: 'Nothing runs until it is installed.', recommended: true },
  { id: 'b', label: 'Fall back to a built-in copy' },
];

describe('QuestionCard', () => {
  it('every state shows its label', () => {
    const answer = { kind: 'answer' as const, optionIds: [], text: 'Per project' };
    const cases: [Partial<Question>, string][] = [
      [{ status: 'open' }, 'Open'],
      [{ status: 'done', response: answer }, 'Done, not sent'],
      [{ status: 'done', response: { kind: 'skip' } }, 'Skipped, not sent'],
      [{ status: 'done', response: { kind: 'invalid', reason: 'unclear' } }, 'Invalid, not sent'],
      [{ status: 'sent', response: answer }, 'Sent'],
      [{ status: 'sent', response: { kind: 'skip' } }, 'Skipped'],
      [{ status: 'sent', response: { kind: 'invalid', reason: 'unclear' } }, 'Invalid'],
      [{ status: 'settled', response: answer, decision: 'Per project' }, 'Settled'],
      [{ status: 'assumed', response: { kind: 'skip' }, decision: 'Port 4783' }, 'Assumed by agent'],
      [{ status: 'retracted', reason: 'Q23 settled on no daemon.' }, 'Retracted'],
      [{ status: 'done', response: answer, isRevision: true }, 'Done, not sent, revised'],
    ];
    for (const [over, label] of cases) {
      const { root, unmount } = card(question(over));
      expect(within(root).getByText(label, { selector: '.rt-state-label' })).toBeTruthy();
      expect(root.querySelector('svg[aria-hidden="true"]')).toBeTruthy();
      unmount();
    }
  });

  it('a parked question shows Later and a new one shows New', () => {
    const { root } = card(question({ isNew: true }), { later: true });
    expect(within(root).getByText('Later', { selector: '.rt-state-label' })).toBeTruthy();
    expect(within(root).getByText('New')).toBeTruthy();
  });

  it('has a data-qid root that can take focus', () => {
    const { root } = card(question());
    expect(root.getAttribute('tabindex')).toBe('-1');
  });

  it('Done sends the answer from options, text and note', async () => {
    const { onDone } = card(question({ options }), { expanded: true });
    await userEvent.click(screen.getByRole('radio', { name: /Fall back/ }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Write my own answer' }), 'only offline');
    await userEvent.type(screen.getByRole('textbox', { name: 'Add a note (optional)' }), 'v1');
    await userEvent.click(screen.getByRole('button', { name: /^Done/ }));
    expect(onDone).toHaveBeenCalledWith('Q1', { kind: 'answer', optionIds: ['b'], text: 'only offline', note: 'v1' });
  });

  it('Done with nothing chosen asks for an answer instead of sending', async () => {
    const { onDone } = card(question(), { expanded: true });
    await userEvent.click(screen.getByRole('button', { name: /^Done/ }));
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByText('Choose an option or write an answer first.')).toBeTruthy();
  });

  it('single-choice uses radios, multi uses checkboxes', () => {
    const { unmount } = card(question({ options }), { expanded: true });
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.getByText('Pick one')).toBeTruthy();
    unmount();
    card(question({ options, multi: true }), { expanded: true });
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.getByText('Pick any')).toBeTruthy();
  });

  it('Accept selects the recommended option', async () => {
    const { onDone } = card(question({ options, recommendation: 'Stop and show the command.' }), { expanded: true });
    const rec = screen.getByRole<HTMLInputElement>('radio', { name: /Stop and show/ });
    expect(rec.checked).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Accept' }));
    expect(rec.checked).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: /^Done/ }));
    expect(onDone).toHaveBeenCalledWith('Q1', { kind: 'answer', optionIds: ['a'] });
  });

  it('Accept fills the answer with the recommendation text when there are no options', async () => {
    card(question({ recommendation: 'Per project, in .rotisserie/sessions.' }), { expanded: true });
    await userEvent.click(screen.getByRole('button', { name: 'Accept' }));
    expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Your answer' }).value)
      .toBe('Per project, in .rotisserie/sessions.');
  });

  it('Skip sends {kind:"skip"}; Invalid requires a reason', async () => {
    const { onSkip, onInvalid } = card(question(), { expanded: true });
    await userEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(onSkip).toHaveBeenCalledWith('Q1');

    await userEvent.click(screen.getByRole('button', { name: 'Invalid question' }));
    expect(onInvalid).not.toHaveBeenCalled();
    const mark = screen.getByRole<HTMLButtonElement>('button', { name: 'Mark invalid' });
    expect(mark.disabled).toBe(true);
    for (const chip of ['Wrong premise', 'Already answered', 'Out of scope', 'Unclear']) {
      expect(screen.getByRole('button', { name: chip })).toBeTruthy();
    }
    await userEvent.click(screen.getByRole('button', { name: 'Wrong premise' }));
    expect(screen.getByRole('button', { name: 'Wrong premise' }).getAttribute('aria-pressed')).toBe('true');
    await userEvent.type(screen.getByRole('textbox', { name: 'Explain (optional)' }), 'the server is local');
    await userEvent.click(mark);
    expect(onInvalid).toHaveBeenCalledWith('Q1', 'wrong premise: the server is local');
  });

  it('Later parks the question', async () => {
    const { onLater } = card(question(), { expanded: true });
    await userEvent.click(screen.getByRole('button', { name: 'Later' }));
    expect(onLater).toHaveBeenCalledWith('Q1');
  });

  it('folded: Edit for done, Reopen for sent, settled and assumed, a button to unfold an open one', async () => {
    const answer = { kind: 'answer' as const, optionIds: [], text: 'Per project' };
    let c = card(question({ status: 'done', response: answer }));
    expect(within(c.root).getByText('Per project')).toBeTruthy();
    await userEvent.click(within(c.root).getByRole('button', { name: 'Edit' }));
    expect(c.onEdit).toHaveBeenCalledWith('Q1');
    c.unmount();
    for (const status of ['sent', 'settled', 'assumed'] as const) {
      c = card(question({ status, response: answer, decision: 'Agent picked per project' }));
      expect(within(c.root).getByRole('button', { name: 'Reopen' })).toBeTruthy();
      c.unmount();
    }
    c = card(question({ status: 'assumed', response: { kind: 'skip' }, decision: 'Port 4783 with fallback', reason: 'Nothing else listens there' }));
    expect(within(c.root).getByText('Port 4783 with fallback')).toBeTruthy();
    expect(within(c.root).getByText(/Nothing else listens there/)).toBeTruthy();   // the agent's reason is reviewable while folded
    c.unmount();
    c = card(question({ options }));
    const unfold = within(c.root).getByRole('button', { name: /Where should sessions be stored/ });
    expect(unfold.getAttribute('aria-expanded')).toBe('false');
    expect(within(c.root).getByText('2 options')).toBeTruthy();
    await userEvent.click(unfold);
    expect(c.onEdit).toHaveBeenCalledWith('Q1');
  });

  it('reopening for editing seeds the form from the current response', () => {
    const q = question({ status: 'sent', response: { kind: 'answer', optionIds: ['b'], text: 'mine', note: 'n1' }, options });
    const h = handlers();
    const { rerender } = render(<QuestionCard question={q} expanded={false} {...h} />);
    rerender(<QuestionCard question={q} expanded {...h} />);
    expect(screen.getByRole<HTMLInputElement>('radio', { name: /Fall back/ }).checked).toBe(true);
    expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Write my own answer' }).value).toBe('mine');
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Add a note (optional)' }).value).toBe('n1');
  });

  it('an open question is seeded once from its draft', () => {
    const q = question();
    const h = handlers();
    const { rerender } = render(<QuestionCard question={q} expanded draft={{ optionIds: [], text: 'from draft', note: '' }} {...h} />);
    const ta = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Your answer' });
    expect(ta.value).toBe('from draft');
    rerender(<QuestionCard question={{ ...q }} expanded draft={{ optionIds: [], text: 'newer server copy', note: '' }} {...h} />);
    expect(ta.value).toBe('from draft');
  });

  it('markup in titles, bodies and answers renders as text', () => {
    const evil = '<img src=x onerror=alert(1)>';
    const { root, unmount } = card(question({ title: evil, body: evil, recommendation: evil }), { expanded: true });
    expect(root.querySelector('img')).toBeNull();
    expect(within(root).getAllByText(evil).length).toBeGreaterThanOrEqual(3);
    unmount();
    const folded = card(question({ title: evil, status: 'sent', response: { kind: 'answer', optionIds: [], text: evil } }));
    expect(folded.root.querySelector('img')).toBeNull();
    expect(within(folded.root).getAllByText(evil)).toHaveLength(2);
  });

  it('retracted question has no buttons', () => {
    const { root } = card(question({ status: 'retracted', reason: 'Q23 settled on no daemon.', options }), { expanded: true });
    expect(within(root).queryAllByRole('button')).toHaveLength(0);
    expect(within(root).queryAllByRole('textbox')).toHaveLength(0);
    expect(within(root).getByText(/Q23 settled on no daemon\./)).toBeTruthy();
    expect(root.querySelector('.rt-row-title.is-struck')).toBeTruthy();
  });

  it('folds over 200 ms, and at once under reduced motion', () => {
    vi.useFakeTimers();
    const w = window as { matchMedia?: unknown };
    try {
      for (const reduce of [false, true]) {
        w.matchMedia = vi.fn(() => ({ matches: reduce }));
        const h = handlers();
        const q = question();
        const { rerender, container, unmount } = render(<QuestionCard question={q} expanded {...h} />);
        rerender(<QuestionCard question={q} expanded={false} {...h} />);
        const fold = container.querySelector('.rt-card-fold');
        if (reduce) {
          expect(fold).toBeNull();
        } else {
          expect(fold?.classList.contains('is-closing')).toBe(true);
          expect(fold?.hasAttribute('inert')).toBe(true);
          act(() => { vi.advanceTimersByTime(199); });
          expect(container.querySelector('.rt-card-fold')).toBeTruthy();
          act(() => { vi.advanceTimersByTime(1); });
          expect(container.querySelector('.rt-card-fold')).toBeNull();
        }
        expect(container.querySelector('.rt-row')).toBeTruthy();
        unmount();
      }
    } finally {
      vi.useRealTimers();
      delete w.matchMedia;
    }
  });

  it('keeps unsent typed text visible when the question is retracted while typing', async () => {
    const h = handlers();
    const q = question();
    const { rerender, container } = render(<QuestionCard question={q} expanded {...h} />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Your answer' }), 'half\nwritten');
    rerender(<QuestionCard question={{ ...q, status: 'retracted', reason: 'Merged into Q2.' }} expanded {...h} />);
    const root = container.querySelector('[data-qid="Q1"]') as HTMLElement;
    expect(within(root).getByText('Your unsent text:')).toBeTruthy();
    expect(root.querySelector('.rt-unsent-text')?.textContent).toBe('half\nwritten');
    expect(within(root).queryAllByRole('textbox')).toHaveLength(0);
    expect(within(root).queryAllByRole('button')).toHaveLength(0);
  });

  it('shows no unsent text for a retracted question whose answer was already sent', () => {
    const { root } = card(question({ status: 'retracted', reason: 'gone',
      response: { kind: 'answer', optionIds: [], text: 'sent earlier' } }));
    expect(within(root).queryByText('Your unsent text:')).toBeNull();
  });

  it('a read-only card unfolds to a record of the answer with no way to change it', async () => {
    const q = question({ status: 'settled', options, recommendation: 'Stop and show it', decision: 'Stop with the install command',
      response: { kind: 'answer', optionIds: ['b'], text: 'but log it', note: 'v1 only' } });
    let c = card(q, { readOnly: true });
    const buttons = within(c.root).getAllByRole('button');
    expect(buttons).toHaveLength(1);                                  // the row itself; no Reopen
    await userEvent.click(buttons[0]!);
    expect(c.onEdit).toHaveBeenCalledWith('Q1');
    c.unmount();
    const onClose = vi.fn();
    c = card(q, { readOnly: true, expanded: true, onClose });
    expect(within(c.root).getByText('Your answer')).toBeTruthy();
    const chosen = within(c.root).getByText('Fall back to a built-in copy').closest('li') as HTMLElement;
    expect(within(chosen).getByText('Chosen')).toBeTruthy();
    expect(within(c.root).getAllByText('Chosen')).toHaveLength(1);
    expect(within(c.root).getByText('but log it')).toBeTruthy();
    expect(within(c.root).getByText(/v1 only/)).toBeTruthy();
    expect(within(c.root).getByText('Stop with the install command')).toBeTruthy();
    expect(within(c.root).queryByRole('textbox')).toBeNull();
    expect(within(c.root).queryByRole('radio')).toBeNull();
    expect(within(c.root).getAllByRole('button').map((b) => b.textContent)).toEqual(['Close']);
    await userEvent.click(within(c.root).getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledWith('Q1');
    c.unmount();
    c = card(question({ status: 'assumed', response: { kind: 'skip' }, decision: 'Port 4783', reason: 'Free' }), { readOnly: true, expanded: true });
    expect(within(c.root).getByText('You skipped. The agent decided.')).toBeTruthy();
    c.unmount();
    c = card(question({ status: 'retracted', reason: 'No longer needed' }), { readOnly: true, expanded: true });
    expect(within(c.root).getByText('No answer was sent.')).toBeTruthy();
    expect(within(c.root).getByText('No longer needed')).toBeTruthy();
  });

  it('a reopened answer folds back unchanged: Close and an unedited Done record nothing', async () => {
    const response = { kind: 'answer' as const, optionIds: ['a'], text: 'and log it' };
    for (const status of ['done', 'sent', 'settled'] as const) {
      const onClose = vi.fn();
      const c = card(question({ status, options, response }), { expanded: true, onClose });
      await userEvent.click(within(c.root).getByRole('button', { name: 'Close, no changes' }));
      await userEvent.click(within(c.root).getByRole('button', { name: /^Done/ }));
      expect(onClose).toHaveBeenCalledTimes(2);
      expect(c.onDone).not.toHaveBeenCalled();
      c.unmount();
    }
    expect(card(question(), { expanded: true }).queryByRole('button', { name: /Close/ })).toBeNull();   // an open question has nothing to keep
  });

  it('an edited reopened answer is a revision on Done, and Discard changes drops the edit', async () => {
    const response = { kind: 'answer' as const, optionIds: [], text: 'Per project' };
    const onClose = vi.fn();
    const c = card(question({ status: 'settled', response, decision: 'Per project' }), { expanded: true, onClose });
    await userEvent.type(within(c.root).getByRole('textbox', { name: 'Your answer' }), ' only');
    await userEvent.click(within(c.root).getByRole('button', { name: 'Discard changes' }));
    expect(onClose).toHaveBeenCalledWith('Q1');
    expect(c.onDone).not.toHaveBeenCalled();
    await userEvent.type(within(c.root).getByRole('textbox', { name: 'Your answer' }), '!');
    await userEvent.click(within(c.root).getByRole('button', { name: /^Done/ }));
    expect(c.onDone).toHaveBeenCalledWith('Q1', expect.objectContaining({ kind: 'answer' }));
  });

  it('Skip on a question the agent already decided after a skip records nothing', async () => {
    const onClose = vi.fn();
    const c = card(question({ status: 'assumed', response: { kind: 'skip' }, decision: 'Port 4783' }), { expanded: true, onClose });
    await userEvent.click(within(c.root).getByRole('button', { name: /^Skip/ }));
    expect(onClose).toHaveBeenCalledWith('Q1');
    expect(c.onSkip).not.toHaveBeenCalled();
  });

  it('a rejected action shows its message, the text it carried and a Dismiss button', async () => {
    const rejected = [{ code: 'retracted', message: 'The agent withdrew this question.',
      action: { cid: 'c1', at: '2026-11-10T10:00:00Z', kind: 'mark' as const, qid: 'Q1',
        response: { kind: 'answer' as const, optionIds: [], text: 'my long answer' } } }];
    const { root, onDismiss } = card(question({ status: 'retracted', reason: 'gone' }), { rejected });
    expect(within(root).getByText('Not sent: The agent withdrew this question.')).toBeTruthy();
    expect(within(root).getByText('my long answer')).toBeTruthy();
    await userEvent.click(within(root).getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledWith('c1');
  });
});
