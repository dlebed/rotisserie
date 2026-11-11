import { useState } from 'preact/hooks';
import type { ProjectInfo } from './api';
import { sessionPath } from './nav';

export function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg class="rt-logo" aria-hidden="true" width={size} height={size} viewBox="0 0 48 48" fill="none"
      stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
      <path d="M42 24a18 18 0 1 1-18-18c5 0 9.9 2 13.5 5.5L42 16" /><path d="M42 6v10H32" />
      <circle cx="24" cy="24" r="5" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * What to call each project: its folder name, plus the parent folder when two projects share a name
 * (two checkouts of one repo), so the picker never shows two identical entries.
 */
export function projectLabels(projects: ProjectInfo[]): Map<string, string> {
  const count = new Map<string, number>();
  for (const p of projects) count.set(p.name, (count.get(p.name) ?? 0) + 1);
  return new Map(projects.map((p) => {
    const parent = p.dir.split(/[\\/]/).filter(Boolean).at(-2);
    return [p.key, (count.get(p.name) ?? 0) > 1 && parent ? `${p.name} (${parent})` : p.name];
  }));
}

type Props = {
  projects: ProjectInfo[];
  active: { pk: string; id: string } | null;
  filter: string;                       // project key, or '' for all
  onFilter(key: string): void;
  onNavigate(path: string): void;
  shown: boolean;                       // narrow windows: the switcher panel is open
  error?: string | null;                // the session list could not be loaded
};

function SessionLink({ p, s, active, onNavigate }: {
  p: ProjectInfo; s: ProjectInfo['sessions'][number]; active: boolean; onNavigate(path: string): void;
}) {
  const href = sessionPath(p.key, s.id);
  const { sent, done, open, total } = s.progress;
  return (
    <a class={`rt-session${active ? ' is-active' : ''}`} href={href} aria-current={active ? 'page' : undefined}
      onClick={(e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        onNavigate(href);
      }}>
      <span class="rt-session-row">
        <span class="rt-session-title">{s.title}</span>
        <span class="rt-session-open">{open} open</span>
      </span>
      <span class="rt-meter" aria-hidden="true">
        <span style={{ flex: sent + done }} class="rt-meter-fill" />
        <span style={{ flex: Math.max(open, total === 0 ? 1 : 0) }} class="rt-meter-rest" />
      </span>
    </a>
  );
}

function Groups({ projects, active, onNavigate, labels, labelSuffix = '' }: {
  projects: { project: ProjectInfo; sessions: ProjectInfo['sessions'] }[]; labels: Map<string, string>;
  active: Props['active']; onNavigate(path: string): void; labelSuffix?: string;
}) {
  return (
    <>
      {projects.map(({ project, sessions }) => (
        <section class="rt-group" key={project.key} aria-label={(labels.get(project.key) ?? project.name) + labelSuffix}>
          <h2 class="rt-group-name" title={project.dir}>{labels.get(project.key) ?? project.name}</h2>
          {sessions.map((s) => (
            <SessionLink key={s.id} p={project} s={s} onNavigate={onNavigate}
              active={active?.pk === project.key && active.id === s.id} />
          ))}
        </section>
      ))}
    </>
  );
}

export function Sidebar({ projects, active, filter, onFilter, onNavigate, shown, error }: Props) {
  const [pastOpen, setPastOpen] = useState(false);
  const visible = projects.filter((p) => filter === '' || p.key === filter);
  const byPhase = (past: boolean) => visible
    .map((project) => ({
      project,
      sessions: project.sessions
        .filter((s) => (s.phase === 'confirmed') === past)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    }))
    .filter((g) => g.sessions.length > 0);
  const current = byPhase(false);
  const past = byPhase(true);
  const pastCount = past.reduce((n, g) => n + g.sessions.length, 0);

  const labels = projectLabels(projects);
  return (
    <nav class={`rt-sidebar${shown ? ' is-shown' : ''}`} aria-label="Sessions">
      <div class="rt-brand"><Logo /><span class="rt-wordmark">Rotisserie</span></div>

      <label class="rt-filter">
        <span class="rt-filter-label">Project</span>
        <select aria-label="Filter by project" value={filter} onChange={(e) => onFilter(e.currentTarget.value)}>
          <option value="">All projects</option>
          {projects.map((p) => <option key={p.key} value={p.key}>{labels.get(p.key) ?? p.name}</option>)}
        </select>
      </label>

      {error && <p class="rt-empty" role="alert">{error}</p>}
      <Groups labels={labels} projects={current} active={active} onNavigate={onNavigate} />
      {current.length === 0 && !error && <p class="rt-empty">No active sessions.</p>}

      <div class="rt-past">
        <button type="button" class="rt-past-toggle" aria-expanded={pastOpen} onClick={() => setPastOpen(!pastOpen)}>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
            style={{ transform: pastOpen ? 'rotate(90deg)' : 'none' }}><path d="M9 6l6 6-6 6" /></svg>
          Past sessions ({pastCount})
        </button>
        {pastOpen && <Groups labels={labels} projects={past} active={active} onNavigate={onNavigate} labelSuffix=", past sessions" />}
      </div>
    </nav>
  );
}
