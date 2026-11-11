import { cleanup, render, screen, waitFor, within } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../web/src/App';
import { ApiError } from '../../web/src/api';
import type { Api, ProjectInfo } from '../../web/src/api';
import { stripToken } from '../../web/src/nav';
import { reduce } from '../../src/core/reduce';

const prog = { total: 10, sent: 4, done: 2, open: 4, newCount: 0, totalAtLastBatch: null };
const sess = (id: string, title: string, phase: 'active' | 'confirmed' = 'active') =>
  ({ id, title, phase, progress: prog, updatedAt: '2026-11-10T10:00:00Z' });
const projects: ProjectInfo[] = [
  { key: 'pkA', name: 'alpha', dir: '/a', sessions: [sess('rt-0001', 'Plugin design'), sess('rt-0002', 'Old alpha thing', 'confirmed')] },
  { key: 'pkB', name: 'beta', dir: '/b', sessions: [sess('rt-0003', 'Invoice retries'), sess('rt-0004', 'Old beta thing', 'confirmed')] },
];

function fakeApi() {
  const listeners = new Set<(e: any) => void>();
  const titleOf = (id: string) => projects.flatMap((p) => p.sessions).find((s) => s.id === id)?.title ?? id;
  const api = {
    listSessions: vi.fn(async () => ({ projects })),
    getSession: vi.fn(async (_pk: string, id: string) => ({ drafts: {}, state: reduce([
      { type: 'session_created', v: 1, id, title: titleOf(id), ts: '2026-11-10T10:00:00Z', actor: 'agent' }]) })),
    health: vi.fn(async () => ({ app: 'rotisserie', formatVersion: 1 })),
    send: vi.fn(async () => ({ status: 200, body: {} })),
    subscribe: vi.fn((f: (e: any) => void) => { listeners.add(f); return () => { listeners.delete(f); }; }),
  };
  return { api: api as unknown as Api, raw: api, emit: (e: unknown) => { for (const f of [...listeners]) f(e); } };
}

async function mount(url = '/', setup: (raw: ReturnType<typeof fakeApi>['raw']) => void = () => {}) {
  window.history.replaceState(null, '', url);
  const f = fakeApi();
  setup(f.raw);
  render(<App api={f.api} />);
  await screen.findByRole('navigation', { name: 'Sessions' }).catch(() => {});
  await waitFor(() => expect(f.raw.listSessions).toHaveBeenCalled());
  return f;
}

beforeEach(() => { window.localStorage.clear(); document.documentElement.removeAttribute('data-theme'); });
afterEach(cleanup);

describe('sidebar', () => {
  it('groups active sessions under their project', async () => {
    await mount();
    const alpha = await screen.findByRole('region', { name: 'alpha' });
    expect(within(alpha).getByText('Plugin design')).toBeTruthy();
    expect(within(alpha).getAllByText('4 open').length).toBe(1);
    const beta = screen.getByRole('region', { name: 'beta' });
    expect(within(beta).getByText('Invoice retries')).toBeTruthy();
    expect(screen.queryByText('Old alpha thing')).toBeNull();
  });

  it('shows confirmed sessions only inside Past sessions, grouped by project', async () => {
    await mount();
    const toggle = await screen.findByRole('button', { name: /Past sessions \(2\)/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    await userEvent.click(toggle);
    const alpha = screen.getByRole('region', { name: 'alpha, past sessions' });
    expect(within(alpha).getByText('Old alpha thing')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'beta, past sessions' })).toBeTruthy();
    expect(screen.getByText('Old beta thing')).toBeTruthy();
  });

  it('filters by project and remembers the choice', async () => {
    await mount();
    await screen.findByText('Plugin design');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Filter by project' }), 'pkB');
    expect(screen.queryByText('Plugin design')).toBeNull();
    expect(screen.getByText('Invoice retries')).toBeTruthy();
    expect(window.localStorage.getItem('rt-project')).toBe('pkB');
  });

  it('preselects the project of the session in the URL', async () => {
    await mount('/s/pkB/rt-0003');
    const select = await screen.findByRole<HTMLSelectElement>('combobox', { name: 'Filter by project' });
    expect(select.value).toBe('pkB');
    expect(screen.queryByText('Plugin design')).toBeNull();
    expect(await screen.findByRole('heading', { level: 1, name: 'Invoice retries' })).toBeTruthy();
    expect(screen.getByText('/b')).toBeTruthy();       // the project folder from the session list
  });

  it('folds and unfolds on a session route and stores the state', async () => {
    await mount('/s/pkA/rt-0001');
    await screen.findByRole('region', { name: 'alpha' });
    await userEvent.click(screen.getByRole('button', { name: 'Hide sessions panel' }));
    expect(screen.queryByRole('navigation', { name: 'Sessions' })).toBeNull();
    expect(window.localStorage.getItem('rt-sidebar')).toBe('folded');
    expect(screen.getByTestId('folded-title').textContent).toBe('Plugin design');
    const show = screen.getByRole('button', { name: 'Show sessions panel' });
    expect(show.getAttribute('aria-expanded')).toBe('false');
    await userEvent.click(show);
    expect(screen.getByRole('navigation', { name: 'Sessions' })).toBeTruthy();
    expect(window.localStorage.getItem('rt-sidebar')).toBe('open');
  });

  it('shows a folded sidebar on the home route', async () => {
    window.localStorage.setItem('rt-sidebar', 'folded');
    await mount('/');
    expect(screen.getByRole('navigation', { name: 'Sessions' })).toBeTruthy();
  });

  it('navigates without reloading when a session is clicked', async () => {
    await mount('/');
    await userEvent.click(await screen.findByText('Invoice retries'));
    expect(window.location.pathname).toBe('/s/pkB/rt-0003');
    expect(await screen.findByRole('heading', { level: 1, name: 'Invoice retries' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Respond to agent/ })).toBeTruthy();
  });

  it('coalesces a burst of server events into one refetch', async () => {
    const f = await mount();
    await screen.findByText('Plugin design');
    vi.useFakeTimers();
    try {
      const before = f.raw.listSessions.mock.calls.length;
      f.emit({ sessions: true });
      f.emit({ pk: 'pkA', id: 'rt-0001' });
      f.emit({ pk: 'pkA', id: 'rt-0001' });
      vi.advanceTimersByTime(299);
      expect(f.raw.listSessions.mock.calls.length).toBe(before);
      vi.advanceTimersByTime(2);
      expect(f.raw.listSessions.mock.calls.length).toBe(before + 1);
    } finally { vi.useRealTimers(); }
  });

  it('re-syncs the filter when navigating to a session of another project', async () => {
    await mount('/s/pkA/rt-0001');
    await screen.findByRole('region', { name: 'alpha' });
    window.history.pushState(null, '', '/s/pkB/rt-0003');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await waitFor(() => expect((screen.getByRole('combobox', { name: 'Filter by project' }) as HTMLSelectElement).value).toBe('pkB'));
    expect(screen.getByRole('region', { name: 'beta' })).toBeTruthy();
  });

  it('says the page lost its access, not "No sessions yet", when the session list answers 401', async () => {
    await mount('/', (raw) => raw.listSessions.mockRejectedValue(new ApiError(401, 'Unauthorized', 'unauthorized')));
    const home = await screen.findByTestId('home');
    await waitFor(() => expect(within(home).getByText('This page lost its access. Open the link from your terminal again.')).toBeTruthy());
    expect(screen.queryByText(/No sessions yet/)).toBeNull();
    expect(within(screen.getByRole('navigation', { name: 'Sessions' })).getByRole('alert').textContent)
      .toBe('This page lost its access. Open the link from your terminal again.');
    expect(screen.queryByText('No active sessions.')).toBeNull();
  });

  it('says it is retrying when the session list fails otherwise, and clears that once a refetch works', async () => {
    const f = await mount('/', (raw) => raw.listSessions.mockRejectedValueOnce(new TypeError('Failed to fetch')));
    const home = await screen.findByTestId('home');
    await waitFor(() => expect(within(home).getByText('Could not load sessions. Retrying…')).toBeTruthy());
    expect(screen.queryByText(/No sessions yet/)).toBeNull();
    f.emit({ sessions: true });                                  // the SSE-driven refetch
    expect(await screen.findByText('Plugin design')).toBeTruthy();
    expect(screen.queryByText('Could not load sessions. Retrying…')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('disables the fold button on the home route', async () => {
    await mount('/');
    expect((screen.getByRole('button', { name: 'Hide sessions panel' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('navigation', { name: 'Sessions' })).toBeTruthy();
  });
});

describe('theme toggle', () => {
  it('sets data-theme on <html> and persists it', async () => {
    await mount();
    await userEvent.click(screen.getByRole('button', { name: 'Switch to dark theme' }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(window.localStorage.getItem('rt-theme')).toBe('dark');
    await userEvent.click(screen.getByRole('button', { name: 'Switch to light theme' }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('still works when storage throws', async () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    await mount();
    await userEvent.click(screen.getByRole('button', { name: 'Switch to dark theme' }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    spy.mockRestore();
  });
});

describe('stripToken', () => {
  it('removes ?t= from the address bar and keeps other parameters', () => {
    window.history.replaceState(null, '', '/s/pkA/rt-0001?t=secret&x=1');
    stripToken();
    expect(window.location.pathname + window.location.search).toBe('/s/pkA/rt-0001?x=1');
  });
});
