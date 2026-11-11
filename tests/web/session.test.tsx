import { cleanup, render, screen, waitFor, within } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionView } from '../../web/src/SessionView';
import type { EventBody } from '../../src/core/events';
import type { Api } from '../../web/src/api';
import { created, fakeServer, manualTimers, MemStorage, qi } from './fixtures';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const OFFLINE = "The agent's session is closed. Your answers are saved in this browser and will be sent when it is back.";
const posted = (...questions: ReturnType<typeof qi>[]): EventBody => ({ type: 'questions_posted', questions });
const answer = (text: string) => ({ kind: 'answer' as const, optionIds: [], text });

function mount(s: ReturnType<typeof fakeServer>, extra: Record<string, unknown> = {}) {
  const storage = (extra.storage as Storage | undefined) ?? new MemStorage();
  const t = manualTimers();
  const r = render(<SessionView pk="pk" id="rt-0001" api={s.api} storage={storage} timers={t.timers}
    dir="~/devel/ai/rotisserie" {...extra} />);
  return { storage, ...t, ...r };
}
const cardOf = (qid: string) => document.querySelector(`[data-qid="${qid}"]`) as HTMLElement;
const findCard = (qid: string) => waitFor(() => {
  const el = cardOf(qid);
  if (!el) throw new Error(`no card ${qid}`);
  return el;
});
const label = (qid: string) => cardOf(qid).querySelector('.rt-state-label')?.textContent;

describe('SessionView', () => {
  it('shows the header: title, id, project dir and agent status', async () => {
    const s = fakeServer([created(), posted(qi('Q1', 'One'))]);
    mount(s);
    expect(await screen.findByRole('heading', { level: 1, name: 'Plugin design' })).toBeTruthy();
    expect(screen.getByText('rt-0001')).toBeTruthy();
    expect(screen.getByText('~/devel/ai/rotisserie')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Agent is waiting for you');
  });

  it('says the agent is working while a batch is unread, and prefers the agent status text', async () => {
    const s = fakeServer([created(), posted(qi('Q1', 'One'), qi('Q2', 'Two'), qi('Q3', 'Three')),
      { type: 'response_marked', qid: 'Q1', response: answer('a') },
      { type: 'response_marked', qid: 'Q2', response: { kind: 'skip' } }, { type: 'batch_sent' }]);
    mount(s);
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Agent is working through your 2 updates'));
    s.push({ type: 'status_set', text: 'Thinking about 2 answers' });
    s.emit();
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Thinking about 2 answers'));
  });

  it('Done marks the response and folds the card', async () => {
    const s = fakeServer([created(), posted(qi('Q1', 'One'), qi('Q2', 'Two'))]);
    mount(s);
    const ta = await within(await findCard('Q1')).findByRole('textbox', { name: 'Your answer' });
    await userEvent.type(ta, 'hello');
    await userEvent.click(within(cardOf('Q1')).getByRole('button', { name: /^Done/ }));
    await waitFor(() => expect(s.send).toHaveBeenCalledWith(expect.objectContaining(
      { kind: 'mark', qid: 'Q1', response: { kind: 'answer', optionIds: [], text: 'hello' } })));
    expect(within(cardOf('Q1')).queryByRole('textbox')).toBeNull();
    await waitFor(() => expect(label('Q1')).toBe('Done, not sent'));
    expect(within(cardOf('Q1')).getByText('hello')).toBeTruthy();
    // the next open question unfolds and takes focus
    const next = within(cardOf('Q2')).getByRole('textbox', { name: 'Your answer' });
    expect(document.activeElement).toBe(next);
  });

  it('does not say the agent is waiting when nothing is open and nothing is pending', async () => {
    const s = fakeServer([created(), posted(qi('Q1', 'One')),
      { type: 'response_marked', qid: 'Q1', response: answer('a') }, { type: 'batch_sent' },
      { type: 'updates_acked', through: 4 }]);
    mount(s);
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('All questions answered'));
  });

  it('after the last open question, Done focuses Respond; Later with nothing to send focuses the folded card', async () => {
    const s = fakeServer([created(), posted(qi('Q1', 'One'), qi('Q2', 'Two'))]);
    mount(s);
    await userEvent.click(await within(await findCard('Q1')).findByRole('button', { name: 'Later' }));
    await userEvent.click(within(cardOf('Q2')).getByRole('button', { name: 'Later' }));
    expect(screen.getByRole<HTMLButtonElement>('button', { name: /Respond to agent/ }).disabled).toBe(true);
    expect(document.activeElement).toBe(cardOf('Q2'));
    await userEvent.click(within(cardOf('Q2')).getByRole('button', { name: /Two/ }));
    await userEvent.click(within(cardOf('Q2')).getByRole('button', { name: 'Skip' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /Respond to agent/ }));
  });

  it('Edit unfolds a done answer seeded from it', async () => {
    const s = fakeServer([created(), posted(qi('Q1', 'One')), { type: 'response_marked', qid: 'Q1', response: answer('first') }]);
    mount(s);
    await userEvent.click(await within(await findCard('Q1')).findByRole('button', { name: 'Edit' }));
    expect(within(cardOf('Q1')).getByRole<HTMLTextAreaElement>('textbox', { name: 'Your answer' }).value).toBe('first');
  });

  it('Respond is disabled with nothing unsent and enabled with one', async () => {
    const s = fakeServer([created(), posted(qi('Q1', 'One'), qi('Q2', 'Two'))]);
    mount(s);
    const respond = await screen.findByRole<HTMLButtonElement>('button', { name: /Respond to agent/ });
    expect(respond.disabled).toBe(true);
    s.push({ type: 'response_marked', qid: 'Q2', response: { kind: 'skip' } });
    s.emit();
    await waitFor(() => expect(respond.disabled).toBe(false));
    expect(screen.getByText('1 update ready to send')).toBeTruthy();
    await userEvent.click(respond);
    await waitFor(() => expect(s.send).toHaveBeenCalledWith(expect.objectContaining({ kind: 'respond' })));
    await waitFor(() => expect(label('Q2')).toBe('Skipped'));
    expect(respond.disabled).toBe(true);
  });

  it('progress text and growth note', async () => {
    const first = Array.from({ length: 21 }, (_, i) => qi(`Q${i + 1}`, `Question ${i + 1}`));
    const marks: EventBody[] = first.slice(0, 14).map((q) => ({ type: 'response_marked', qid: q.id, response: { kind: 'skip' } }));
    const s = fakeServer([created(), posted(...first), ...marks, { type: 'batch_sent' },
      posted(qi('Q22', 'Twenty-two'), qi('Q23', 'Twenty-three'))]);
    mount(s);
    expect(await screen.findByText('14 of 23')).toBeTruthy();
    expect(screen.getByText(/total grew from 21 to 23/)).toBeTruthy();
    const meter = screen.getByRole('img', { name: '14 sent, 0 done and not yet sent, 9 open' });
    expect(meter.querySelectorAll('.rt-meter-seg')).toHaveLength(2);     // no zero-width segment
    const legend = screen.getByTestId('progress-legend');
    expect(legend.textContent).toContain('Sent 14');
    expect(legend.textContent).toContain('Done, not sent 0');
    expect(legend.textContent).toContain('Open 9');
  });

  it('filters by Unanswered, New and Assumed by agent, each with a count', async () => {
    const s = fakeServer([created(), posted(qi('Q1', 'One'), qi('Q2', 'Two'), qi('Q3', 'Three')),
      { type: 'response_marked', qid: 'Q2', response: answer('x') },
      { type: 'response_marked', qid: 'Q3', response: { kind: 'skip' } }, { type: 'batch_sent' },
      { type: 'question_resolved', qid: 'Q3', decision: 'Port 4783', assumed: true, reason: 'common default' },
      posted(qi('Q4', 'Four'))]);
    mount(s);
    const group = await screen.findByRole('group', { name: 'Filter questions' });
    expect(within(group).getByRole('button', { name: 'All 4' }).getAttribute('aria-pressed')).toBe('true');
    await userEvent.click(within(group).getByRole('button', { name: 'Unanswered 2' }));
    expect([cardOf('Q1').hidden, cardOf('Q2').hidden, cardOf('Q3').hidden, cardOf('Q4').hidden]).toEqual([false, true, true, false]);
    await userEvent.click(within(group).getByRole('button', { name: 'New 1' }));
    expect([cardOf('Q1').hidden, cardOf('Q4').hidden]).toEqual([true, false]);
    await userEvent.click(within(group).getByRole('button', { name: 'Assumed by agent 1' }));
    expect([cardOf('Q3').hidden, cardOf('Q4').hidden]).toEqual([false, true]);
  });

  it('a live update keeps focus, text and caret', async () => {
    const s = fakeServer([created(), posted(qi('Q1', 'One'), qi('Q4', 'Four')), { type: 'batch_sent' },
      { type: 'updates_acked', through: 3 }]);
    mount(s);
    await userEvent.click(await within(await findCard('Q4')).findByRole('button', { name: /Four/ }));
    const ta = within(cardOf('Q4')).getByRole<HTMLTextAreaElement>('textbox', { name: 'Your answer' });
    await userEvent.click(ta);
    await userEvent.type(ta, 'abc');
    ta.setSelectionRange(1, 1);
    const q4Root = cardOf('Q4');

    s.push(posted(qi('Q1a', 'Follow-up', { parentId: 'Q1' })));
    s.push({ type: 'status_set', text: 'Digging into Q1' });
    s.emit();
    await findCard('Q1a');

    expect(cardOf('Q4')).toBe(q4Root);
    expect(within(cardOf('Q4')).getByRole('textbox', { name: 'Your answer' })).toBe(ta);   // same DOM node: not remounted
    expect(document.activeElement).toBe(ta);
    expect(ta.value).toBe('abc');
    expect(ta.selectionStart).toBe(1);
    const order = [...document.querySelectorAll('[data-qid]')].map((e) => e.getAttribute('data-qid'));
    expect(order).toEqual(['Q1', 'Q1a', 'Q4']);
    expect(within(cardOf('Q1a')).getByText('New')).toBeTruthy();
    expect(cardOf('Q1a').closest('.rt-children')).toBeTruthy();
  });

  it('keeps the focused card where it was on screen when content above it grows', async () => {
    const s = fakeServer([created(), posted(qi('Q1', 'One'), qi('Q4', 'Four'))]);
    mount(s);
    await userEvent.click(await within(await findCard('Q4')).findByRole('button', { name: /Four/ }));
    within(cardOf('Q4')).getByRole('textbox', { name: 'Your answer' }).focus();
    const rect = (top: number) => ({ top, bottom: top, left: 0, right: 0, width: 0, height: 0, x: 0, y: top, toJSON() {} }) as DOMRect;
    vi.spyOn(cardOf('Q4'), 'getBoundingClientRect').mockReturnValueOnce(rect(300)).mockReturnValue(rect(420));
    const scrollBy = vi.fn();
    window.scrollBy = scrollBy as unknown as typeof window.scrollBy;
    s.push(posted(qi('Q1a', 'Follow-up', { parentId: 'Q1' })));
    s.emit();
    await findCard('Q1a');
    expect(scrollBy).toHaveBeenCalledWith(0, 120);
  });

  it('keeps the focused card in place when a failed refetch shows the offline banner, and when it goes', async () => {
    const s = fakeServer([created(), posted(qi('Q1', 'One'), qi('Q4', 'Four'))]);
    mount(s);
    await userEvent.click(await within(await findCard('Q4')).findByRole('button', { name: /Four/ }));
    within(cardOf('Q4')).getByRole('textbox', { name: 'Your answer' }).focus();
    const rect = (top: number) => ({ top, bottom: top, left: 0, right: 0, width: 0, height: 0, x: 0, y: top, toJSON() {} }) as DOMRect;
    const scrollBy = vi.fn();
    window.scrollBy = scrollBy as unknown as typeof window.scrollBy;
    const box = vi.spyOn(cardOf('Q4'), 'getBoundingClientRect').mockReturnValueOnce(rect(300)).mockReturnValue(rect(360));
    s.setDown(true);
    s.emit();
    expect(await screen.findByText(OFFLINE)).toBeTruthy();
    await waitFor(() => expect(scrollBy).toHaveBeenCalledWith(0, 60));
    box.mockReset().mockReturnValueOnce(rect(360)).mockReturnValue(rect(300));
    s.setDown(false);
    s.emit();
    await waitFor(() => expect(screen.queryByText(OFFLINE)).toBeNull());
    await waitFor(() => expect(scrollBy).toHaveBeenCalledWith(0, -60));
  });

  it('autosaves a draft 500 ms after the last keystroke and seeds from the saved draft', async () => {
    const s = fakeServer([created(), posted(qi('Q1', 'One'))]);
    const { unmount, storage } = mount(s);
    const ta = await within(await findCard('Q1')).findByRole('textbox', { name: 'Your answer' });
    await userEvent.type(ta, 'half a thought');
    expect(s.send).not.toHaveBeenCalled();
    await waitFor(() => expect(s.send).toHaveBeenCalledWith(expect.objectContaining(
      { kind: 'draft', qid: 'Q1', draft: { optionIds: [], text: 'half a thought', note: '' } })));
    expect(s.send).toHaveBeenCalledTimes(1);
    expect(within(cardOf('Q1')).getByText('Draft saved')).toBeTruthy();
    unmount();
    mount(s, { storage });
    const again = await within(await findCard('Q1')).findByRole<HTMLTextAreaElement>('textbox', { name: 'Your answer' });
    expect(again.value).toBe('half a thought');
  });

  it('Later parks the question in localStorage and keeps it counted as open', async () => {
    const s = fakeServer([created(), posted(qi('Q1', 'One'), qi('Q2', 'Two'))]);
    const { storage, unmount } = mount(s);
    await userEvent.click(await within(await findCard('Q1')).findByRole('button', { name: 'Later' }));
    expect(label('Q1')).toBe('Later');
    expect(JSON.parse(storage.getItem('rt-later-pk-rt-0001')!)).toEqual(['Q1']);
    expect(screen.getByText('0 of 2')).toBeTruthy();
    expect(within(cardOf('Q2')).getByRole('textbox', { name: 'Your answer' })).toBeTruthy();
    unmount();
    mount(s, { storage });
    await waitFor(() => expect(label('Q1')).toBe('Later'));
  });

  it('offline: Done still folds the card, the banner shows, Respond queues', async () => {
    const s = fakeServer([created(), posted(qi('Q1', 'One'))]);
    const { tick } = mount(s);
    const ta = await within(await findCard('Q1')).findByRole('textbox', { name: 'Your answer' });
    s.setDown(true);
    await userEvent.type(ta, 'hello');
    await userEvent.click(within(cardOf('Q1')).getByRole('button', { name: /^Done/ }));
    expect(await screen.findByText(OFFLINE)).toBeTruthy();
    expect(within(cardOf('Q1')).queryByRole('textbox')).toBeNull();
    expect(label('Q1')).toBe('Done, not sent');

    await userEvent.click(screen.getByRole('button', { name: /Will send when the agent is back/ }));
    expect(await screen.findByText('Queued: 1 update')).toBeTruthy();

    s.setDown(false);
    tick();
    await waitFor(() => expect(screen.queryByText(OFFLINE)).toBeNull());
    await waitFor(() => expect(label('Q1')).toBe('Sent'));
    expect(s.events.map((e) => e.type).slice(-2)).toEqual(['response_marked', 'batch_sent']);
    expect(screen.queryByText(/Queued:/)).toBeNull();
  });

  it('a rejected action stays visible on its card', async () => {
    const s = fakeServer([created(), posted(qi('Q1', 'One'))]);
    mount(s);
    const ta = await within(await findCard('Q1')).findByRole('textbox', { name: 'Your answer' });
    await userEvent.type(ta, 'my careful answer');
    s.push({ type: 'question_retracted', qid: 'Q1', reason: 'No longer relevant.' });   // the page has not heard yet
    await userEvent.click(within(cardOf('Q1')).getByRole('button', { name: /^Done/ }));
    expect(await within(cardOf('Q1')).findByText(
      'Not sent: The agent withdrew this question, so it can no longer be answered.')).toBeTruthy();
    expect(within(cardOf('Q1')).getByText('my careful answer')).toBeTruthy();
    s.emit();
    await waitFor(() => expect(label('Q1')).toBe('Retracted'));
    expect(within(cardOf('Q1')).getByText('my careful answer')).toBeTruthy();
    await userEvent.click(within(cardOf('Q1')).getByRole('button', { name: 'Dismiss' }));
    expect(within(cardOf('Q1')).queryByText(/Not sent:/)).toBeNull();
  });

  it('shows the lost-access banner instead of the offline banner after a 401', async () => {
    const s = fakeServer([created(), posted(qi('Q1', 'One'))]);
    s.send.mockImplementation(async () => ({ status: 401, body: { error: 'unauthorized' } }));
    mount(s);
    await userEvent.click(await within(await findCard('Q1')).findByRole('button', { name: 'Skip' }));
    expect(await screen.findByText('This page lost its access. Open the link from your terminal again.')).toBeTruthy();
    expect(screen.queryByText(OFFLINE)).toBeNull();
  });

  it('warns when answers cannot be saved in this browser', async () => {
    const s = fakeServer([created(), posted(qi('Q1', 'One'))]);
    const broken = new MemStorage();
    broken.setItem = () => { throw new Error('QuotaExceededError'); };
    mount(s, { storage: broken });
    await userEvent.click(await within(await findCard('Q1')).findByRole('button', { name: 'Skip' }));
    expect(await screen.findByText(/not being saved in this browser/)).toBeTruthy();
  });

  it('renders from the cached state while the server cannot be reached', async () => {
    const s = fakeServer([created(), posted(qi('Q1', 'Cached one'))]);
    const { storage, unmount } = mount(s);
    await findCard('Q1');
    unmount();
    s.setDown(true);
    mount(s, { storage });
    expect(await screen.findByText('Cached one')).toBeTruthy();
    expect(screen.getByText(OFFLINE)).toBeTruthy();
  });

  it('says when the session is missing or needs a newer Rotisserie', async () => {
    const s = fakeServer([created()]);
    s.raw.getSession.mockRejectedValueOnce(Object.assign(new Error('not found'), { status: 404 }));
    const a = mount(s);
    expect(await screen.findByText('This session was not found.')).toBeTruthy();
    a.unmount();
    s.raw.getSession.mockRejectedValueOnce(Object.assign(new Error('too new'), { status: 409 }));
    mount(s);
    expect(await screen.findByText('Update Rotisserie to view this session.')).toBeTruthy();
  });

  it('a confirmed session shows the summary instead of the list and is read-only', async () => {
    const s = fakeServer([created(), posted(qi('Q1', 'One'), qi('Q2', 'Two')),
      { type: 'response_marked', qid: 'Q1', response: answer('a') }, { type: 'batch_sent' },
      { type: 'summary_posted', html: '<p>x</p>', markdown: 'x', abstract: 'All settled.' },
      { type: 'session_confirmed' }]);
    mount(s);
    const summary = await screen.findByRole('region', { name: 'Summary' });
    expect(summary.compareDocumentPosition(cardOf('Q1')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(cardOf('Q1')).queryAllByRole('button')).toHaveLength(0);
    expect(within(cardOf('Q2')).queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /Respond to agent/ })).toBeNull();
    expect(within(cardOf('Q2')).queryByRole('textbox')).toBeNull();
  });

  it('loads the new session when pk/id change without a remount', async () => {
    const a = fakeServer([created('Session A'), posted(qi('Q1', 'One'))]);
    const b = fakeServer([created('Session B'), posted(qi('Q1', 'Uno'))]);
    const api = { ...a.raw, getSession: vi.fn((_pk: string, id: string) => (id === 'rt-0002' ? b.raw.getSession() : a.raw.getSession())) };
    const storage = new MemStorage();
    const { rerender } = render(<SessionView pk="pk" id="rt-0001" api={api as unknown as Api} storage={storage} />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Session A' })).toBeTruthy();
    rerender(<SessionView pk="pk" id="rt-0002" api={api as unknown as Api} storage={storage} />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Session B' })).toBeTruthy();
    expect(screen.getByText('Uno')).toBeTruthy();
    expect(storage.getItem('rt-state-pk-rt-0002')).toContain('Session B');
  });

  it('markup in the session title renders as text', async () => {
    const s = fakeServer([created('<img src=x onerror=alert(1)>'), posted(qi('Q1', '<b>bold</b>'))]);
    mount(s);
    expect(await screen.findByRole('heading', { level: 1, name: '<img src=x onerror=alert(1)>' })).toBeTruthy();
    expect(document.querySelector('img, b')).toBeNull();
  });
});
