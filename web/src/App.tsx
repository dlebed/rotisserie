import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { api as defaultApi } from './api';
import type { Api, ProjectInfo } from './api';
import { parseRoute } from './nav';
import { AUTH_LOST, SessionView } from './SessionView';
import { Logo, Sidebar } from './Sidebar';
import { readStore, writeStore } from './storage';

type Theme = 'light' | 'dark';

function systemTheme(): Theme {
  try { return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch { return 'light'; }
}

export function applyStoredTheme(): void {
  const t = readStore('rt-theme');
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
}

const LIST_FAILED = 'Could not load sessions. Retrying…';

function Home({ hasSessions, error }: { hasSessions: boolean; error: string | null }) {
  return (
    <main class="rt-content" data-testid="home">
      <h1 class="rt-h1">Rotisserie</h1>
      <p class="rt-muted">{error ?? (hasSessions ? 'Choose a session from the list.' : 'No sessions yet. Start one from Claude Code.')}</p>
    </main>
  );
}

export function App({ api = defaultApi }: { api?: Api }) {
  const [path, setPath] = useState(window.location.pathname);
  const route = parseRoute(path);
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [filter, setFilter] = useState(() => (route.name === 'session' ? route.pk : readStore('rt-project') ?? ''));
  const [folded, setFolded] = useState(() => readStore('rt-sidebar') === 'folded');
  const [switcher, setSwitcher] = useState(false);
  const [theme, setTheme] = useState<Theme | null>(() => {
    const t = readStore('rt-theme');
    return t === 'light' || t === 'dark' ? t : null;
  });

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const latest = useRef(0);
  const load = useCallback(() => {
    const n = ++latest.current;
    api.listSessions().then((r) => {
      if (n === latest.current) { setProjects(r.projects); setListError(null); }
    }, (e: unknown) => {
      if (n === latest.current) setListError((e as { status?: unknown } | null)?.status === 401 ? AUTH_LOST : LIST_FAILED);
    });
  }, [api]);
  useEffect(() => {
    load();
    // Per-session events move the open counts and meters too; coalesce bursts into one trailing fetch.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = api.subscribe(() => {
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => { timer = undefined; load(); }, 300);
    });
    return () => { if (timer !== undefined) clearTimeout(timer); unsubscribe(); };
  }, [api, load]);

  // "Retrying…" has to be true: without this, a failed load waited for the next server event.
  useEffect(() => {
    if (listError !== LIST_FAILED) return;
    const t = setTimeout(load, 3000);
    return () => clearTimeout(t);
  }, [listError, load]);

  const routePk = route.name === 'session' ? route.pk : null;
  useEffect(() => {
    if (routePk !== null) setFilter((f) => (f === '' || f === routePk ? f : routePk));
  }, [routePk]);

  useEffect(() => {
    if (theme) document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const navigate = (to: string) => {
    window.history.pushState(null, '', to);
    setPath(to);
    setSwitcher(false);
  };
  const toggleFold = () => {
    const next = !folded;
    setFolded(next);
    writeStore('rt-sidebar', next ? 'folded' : 'open');
  };
  const chooseFilter = (key: string) => { setFilter(key); writeStore('rt-project', key); };
  const toggleTheme = () => {
    const next: Theme = (theme ?? systemTheme()) === 'dark' ? 'light' : 'dark';
    setTheme(next);
    writeStore('rt-theme', next);
  };

  const sidebarVisible = route.name === 'home' || !folded;
  const effectiveFilter = projects.length === 0 || projects.some((p) => p.key === filter) ? filter : '';
  const project = route.name === 'session' ? projects.find((p) => p.key === route.pk) : undefined;
  const summary = route.name === 'session' ? project?.sessions.find((s) => s.id === route.id) : undefined;
  const title = route.name === 'session' ? summary?.title ?? route.id : '';
  const nextTheme = (theme ?? systemTheme()) === 'dark' ? 'light' : 'dark';

  return (
    <div class="rt-app">
      <div class={`rt-topbar${sidebarVisible ? '' : ' is-folded'}`}>
        <button type="button" class="rt-icon-btn rt-fold" aria-expanded={sidebarVisible} disabled={route.name === 'home'}
          aria-label={sidebarVisible ? 'Hide sessions panel' : 'Show sessions panel'} onClick={toggleFold}>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" />
          </svg>
        </button>
        <span class="rt-topbar-brand"><Logo /><span class="rt-wordmark">Rotisserie</span></span>
        {route.name === 'session' && !sidebarVisible && (
          <span class="rt-topbar-title" data-testid="folded-title">{title}</span>
        )}
        {route.name === 'session' && (
          <button type="button" class="rt-switcher" aria-expanded={switcher} onClick={() => setSwitcher(!switcher)}>
            <span class="rt-muted">{project ? `${project.name} / ` : ''}</span>{title}
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6" /></svg>
          </button>
        )}
        <button type="button" class="rt-icon-btn rt-theme-toggle" aria-label={`Switch to ${nextTheme} theme`}
          onClick={toggleTheme}>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            {nextTheme === 'dark'
              ? <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
              : <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>}
          </svg>
        </button>
      </div>
      <div class="rt-body">
        {(sidebarVisible || switcher) && (
          <Sidebar projects={projects} filter={effectiveFilter} onFilter={chooseFilter} onNavigate={navigate}
            active={route.name === 'session' ? { pk: route.pk, id: route.id } : null}
            shown={switcher || route.name === 'home'} error={listError} />
        )}
        {route.name === 'session'
          ? <SessionView key={`${route.pk}/${route.id}`} pk={route.pk} id={route.id} api={api} dir={project?.dir} />
          : <Home hasSessions={projects.some((p) => p.sessions.length > 0)} error={listError} />}
      </div>
    </div>
  );
}
