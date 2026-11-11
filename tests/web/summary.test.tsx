import { readFileSync } from 'node:fs';
import path from 'node:path';
import { cleanup, render, screen, waitFor, within } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionView } from '../../web/src/SessionView';
import { buildSummaryDoc } from '../../web/src/Summary';
import type { EventBody } from '../../src/core/events';
import { created, fakeServer, manualTimers, MemStorage, qi } from './fixtures';

afterEach(() => {
  cleanup(); vi.restoreAllMocks();
  document.documentElement.removeAttribute('style');
  document.documentElement.removeAttribute('data-theme');
});

const CSP = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">`;
const posted = (...questions: ReturnType<typeof qi>[]): EventBody => ({ type: 'questions_posted', questions });
const HTML = '<h2>Plan</h2><script>alert(1)</script><svg width="10" height="10"></svg>';
const summaryEvents = (extra: EventBody[] = []): EventBody[] => [created(), posted(qi('Q1', 'One'), qi('Q2', 'Two')),
  { type: 'response_marked', qid: 'Q1', response: { kind: 'skip' } }, { type: 'batch_sent' },
  { type: 'question_resolved', qid: 'Q2', decision: 'Use a fixed port', assumed: true, reason: 'Predictable for SSH' },
  { type: 'summary_posted', html: HTML, markdown: '# Summary\n', abstract: 'All settled <b>mostly</b>.' }, ...extra];

function mount(s: ReturnType<typeof fakeServer>) {
  const t = manualTimers();
  return render(<SessionView pk="pk" id="rt-0001" api={s.api} storage={new MemStorage()} timers={t.timers} />);
}
const frame = () => screen.findByTitle('Summary from the agent') as Promise<HTMLIFrameElement>;
const sent = (s: ReturnType<typeof fakeServer>, kind: string) => s.send.mock.calls.filter(([a]) => a.kind === kind);

describe('buildSummaryDoc', () => {
  it('keeps the agent html verbatim in the body, CSP first in head, theme variables in a style block', () => {
    const html = '<script>x</script><svg></svg>';
    const doc = buildSummaryDoc(html, { '--rt-bg': '#fff', '--rt-text': 'rgb(1, 2, 3)' });
    expect(doc.startsWith('<!doctype html>')).toBe(true);
    expect(doc).toContain('<meta charset="utf-8">');
    expect(doc).toMatch(/<head>\s*<meta http-equiv="Content-Security-Policy"/);
    expect(doc.indexOf(CSP)).toBeGreaterThan(-1);
    expect(doc.indexOf(CSP)).toBeLessThan(doc.indexOf('<style>'));
    expect(doc).toContain('--rt-bg:#fff');
    expect(doc).toContain('--rt-text:rgb(1, 2, 3)');
    expect(doc).toMatch(/<body>\s*<script>x<\/script><svg><\/svg>\s*<\/body>/);
    expect(doc).toContain('svg{max-width:100%}');
  });

  it('drops values that are not plain colours so a variable cannot close the style element', () => {
    const doc = buildSummaryDoc('<p>a</p>', { '--rt-bg': '#fff</style><script>1</script>', '--rt-text': 'red;}body{x:y',
      '--rt-muted': 'url(http://x)', '--rt-border': 'hsl(10 20% 30%)', '--rt-accent': 'tomato' });
    expect(doc).not.toContain('--rt-bg');
    expect(doc).not.toContain('--rt-text:');
    expect(doc).not.toContain('--rt-muted');
    expect(doc).toContain('--rt-border:hsl(10 20% 30%)');
    expect(doc).toContain('--rt-accent:tomato');
    expect((doc.match(/<\/style>/g) ?? []).length).toBe(1);
  });
});

describe('Summary', () => {
  it('puts the summary in a locked-down iframe and shows the abstract as text', async () => {
    document.documentElement.style.setProperty('--rt-bg', '#123456');
    const s = fakeServer(summaryEvents());
    mount(s);
    const f = await frame();
    expect(f.getAttribute('sandbox')).toBe('');
    expect(f.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(f.hasAttribute('allow')).toBe(false);
    const doc = f.getAttribute('srcdoc') ?? '';
    expect(doc).toContain(CSP);
    expect(doc).toContain('--rt-bg:#123456');
    expect(doc).toContain(HTML);
    expect(screen.getByText('All settled <b>mostly</b>.')).toBeTruthy();
    expect(document.querySelector('main script, main svg[width="10"]')).toBeNull();
  });

  it('rebuilds the srcdoc when data-theme changes and stops observing on unmount', async () => {
    document.documentElement.style.setProperty('--rt-bg', '#111111');
    const s = fakeServer(summaryEvents());
    const { unmount } = mount(s);
    const f = await frame();
    expect(f.getAttribute('srcdoc')).toContain('--rt-bg:#111111');
    document.documentElement.style.setProperty('--rt-bg', '#eeeeee');
    document.documentElement.setAttribute('data-theme', 'light');
    await waitFor(() => expect(f.getAttribute('srcdoc')).toContain('--rt-bg:#eeeeee'));
    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
    unmount();
    await waitFor(() => expect(disconnect).toHaveBeenCalled());
  });

  it('gives the frame a fixed height and Expand switches it', async () => {
    const s = fakeServer(summaryEvents());
    mount(s);
    const f = await frame();
    expect(f.style.height).toBe('min(70vh, 720px)');
    const expand = screen.getByRole('button', { name: 'Expand' });
    await userEvent.click(expand);
    expect(f.style.height).toBe('90vh');
    expect(screen.getByRole('button', { name: 'Collapse' })).toBeTruthy();
  });

  it('lists assumed questions with decision and reason as text, hidden when there are none', async () => {
    const s = fakeServer(summaryEvents());
    const a = mount(s);
    expect(await screen.findByRole('heading', { name: /^Assumed by agent \(1\)/ })).toBeTruthy();
    const region = screen.getByRole('region', { name: 'Decisions assumed by the agent' });
    expect(within(region).getByText('Use a fixed port')).toBeTruthy();
    expect(within(region).getByText(/Predictable for SSH/)).toBeTruthy();
    a.unmount();
    const none = fakeServer([created(), posted(qi('Q1', 'One')),
      { type: 'summary_posted', html: '<p>x</p>', markdown: 'x', abstract: 'a' }]);
    mount(none);
    await frame();
    expect(screen.queryByRole('heading', { name: /Assumed by agent/ })).toBeNull();
  });

  it('Not yet with an empty note enqueues nothing, explains, and focuses the note', async () => {
    const s = fakeServer(summaryEvents());
    mount(s);
    await frame();
    await userEvent.click(screen.getByRole('button', { name: 'Not yet, keep grilling' }));
    const ta = screen.getByRole('textbox');
    expect(document.activeElement).toBe(ta);
    const msg = screen.getByText('Add a note so the agent knows what is missing.');
    expect(ta.getAttribute('aria-describedby')).toBe(msg.id);
    expect(sent(s, 'reopen')).toHaveLength(0);
  });

  it('Not yet with a note enqueues a reopen, and the question list comes back', async () => {
    const s = fakeServer(summaryEvents());
    mount(s);
    await frame();
    await userEvent.type(screen.getByRole('textbox'), 'We never covered tabs');
    await userEvent.click(screen.getByRole('button', { name: 'Not yet, keep grilling' }));
    await waitFor(() => expect(s.send).toHaveBeenCalledWith(expect.objectContaining({ kind: 'reopen', note: 'We never covered tabs' })));
    await waitFor(() => expect(screen.queryByTitle('Summary from the agent')).toBeNull());
    expect(document.querySelector('[data-qid="Q1"]')).toBeTruthy();
  });

  it('Confirm enqueues confirm and the session shows Closed without action buttons', async () => {
    const s = fakeServer(summaryEvents());
    mount(s);
    await frame();
    await userEvent.click(screen.getByRole('button', { name: 'Confirm shared understanding' }));
    await waitFor(() => expect(sent(s, 'confirm')).toHaveLength(1));
    await waitFor(() => expect(screen.getByText('Closed')).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'Confirm shared understanding' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Not yet, keep grilling' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Change' })).toBeNull();
    expect(screen.getByRole('button', { name: /Export Markdown/ })).toBeTruthy();
  });

  it('a confirmed session loaded from the server is read-only too', async () => {
    const s = fakeServer(summaryEvents([{ type: 'session_confirmed' }]));
    mount(s);
    await frame();
    expect(screen.getByText('Closed')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Confirm shared understanding' })).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('while offline Confirm stays usable and says it will be sent when the agent is back', async () => {
    const s = fakeServer(summaryEvents());
    mount(s);
    await frame();
    s.setDown(true);
    s.send.mockRejectedValue(new TypeError('Failed to fetch'));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm shared understanding' }));
    expect(await screen.findByText(/will be sent when the agent is back/)).toBeTruthy();
    const btn = screen.getByRole('button', { name: 'Confirm shared understanding' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it('Change shows the list with that card unfolded and focused; Back to summary returns', async () => {
    const s = fakeServer(summaryEvents());
    mount(s);
    await frame();
    expect(document.querySelector('[data-qid="Q2"]')?.closest('[hidden]')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Change' }));
    expect(screen.queryByTitle('Summary from the agent')).toBeNull();
    const card = document.querySelector('[data-qid="Q2"]') as HTMLElement;
    await waitFor(() => expect(card.classList.contains('is-expanded')).toBe(true));
    await waitFor(() => expect(card.contains(document.activeElement)).toBe(true));
    expect(screen.getByRole('button', { name: /Respond to agent/ })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Back to summary' }));
    expect(await frame()).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Respond to agent/ })).toBeNull();
  });

  it('does not show the summary while the phase is active again after a revision', async () => {
    const s = fakeServer(summaryEvents([{ type: 'session_reopened', note: 'more' }]));
    mount(s);
    await waitFor(() => expect(document.querySelector('[data-qid="Q1"]')).toBeTruthy());
    expect(screen.queryByTitle('Summary from the agent')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Confirm shared understanding' })).toBeNull();
  });

  it('Export Markdown downloads <id>-summary.md and revokes the object URL', async () => {
    const create = vi.fn(() => 'blob:x');
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    let name = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { name = this.download; });
    const s = fakeServer(summaryEvents());
    mount(s);
    await frame();
    await userEvent.click(screen.getByRole('button', { name: /Export Markdown/ }));
    expect(create).toHaveBeenCalledTimes(1);
    expect(((create.mock.calls[0] as unknown[])[0] as Blob).type).toContain('text/markdown');
    expect(name).toBe('rt-0001-summary.md');
    expect(revoke).toHaveBeenCalledWith('blob:x');
    expect(document.querySelector('a[download]')).toBeNull();
  });

  it('while a confirm is queued the Change buttons go and Not yet is disabled', async () => {
    const s = fakeServer(summaryEvents());
    mount(s);
    await frame();
    s.setDown(true);
    s.send.mockRejectedValue(new TypeError('Failed to fetch'));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm shared understanding' }));
    await screen.findByText(/will be sent when the agent is back/);
    expect(screen.queryByRole('button', { name: 'Change' })).toBeNull();
    expect((screen.getByRole('button', { name: 'Not yet, keep grilling' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('Back to summary is available in any phase once the list was opened from the summary', async () => {
    const s = fakeServer(summaryEvents());
    mount(s);
    await frame();
    await userEvent.click(screen.getByRole('button', { name: 'Change' }));
    s.push({ type: 'session_confirmed' });
    s.emit();
    await waitFor(() => expect(screen.queryByRole('button', { name: /Respond to agent/ })).toBeNull());
    await userEvent.click(screen.getByRole('button', { name: 'Back to summary' }));
    expect(await frame()).toBeTruthy();
  });

  it('shows a refused confirm inside the confirmation block and lets the user dismiss it', async () => {
    const s = fakeServer(summaryEvents());
    mount(s);
    await frame();
    s.send.mockResolvedValueOnce({ status: 409, body: { error: 'nope', message: 'The session is already closed.' } });
    await userEvent.click(screen.getByRole('button', { name: 'Confirm shared understanding' }));
    expect(await screen.findByText(/Not sent: The session is already closed\./)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText(/Not sent:/)).toBeNull();
  });

  it('the status strip follows the phase', async () => {
    const s = fakeServer([...summaryEvents(), { type: 'status_set', text: 'Custom' }]);
    mount(s);
    await frame();
    expect(screen.getByRole('status').textContent).toContain('Agent posted a summary and is waiting for your confirmation');
  });

  it('Expand uses aria-expanded', async () => {
    const s = fakeServer(summaryEvents());
    mount(s);
    await frame();
    const b = screen.getByRole('button', { name: 'Expand' });
    expect(b.getAttribute('aria-expanded')).toBe('false');
    expect(b.hasAttribute('aria-pressed')).toBe(false);
  });
});

describe('static assets', () => {
  const root = path.join(__dirname, '../..');
  it('hides [hidden] elements even where a display rule exists', () => {
    const theme = readFileSync(path.join(root, 'web/src/theme.css'), 'utf8');
    const session = readFileSync(path.join(root, 'web/src/session.css'), 'utf8');
    expect(theme).toMatch(/\[hidden\]\s*\{\s*display:\s*none\s*!important/);
    expect(session).toMatch(/\.rt-questions\[hidden\]\s*\{\s*display:\s*none/);
  });
  it('index.html references only root-absolute assets', () => {
    const html = readFileSync(path.join(root, 'web/index.html'), 'utf8');
    const urls = [...html.matchAll(/\b(?:src|href)="([^"]*)"/g)].map((m) => m[1] ?? '');
    expect(urls.length).toBeGreaterThan(2);
    for (const u of urls) expect(u.startsWith('/')).toBe(true);
  });
});
