import type { SessionState } from './reduce';
import { listSessions, loadSession } from './store';

export type SearchHit = { sessionId: string; sessionTitle: string; kind: 'question' | 'note' | 'summary';
  qid?: string; title?: string; answer?: string; decision?: string; excerpt: string };

const EXCERPT_RADIUS = 60;

function answerText(q: SessionState['questions'][string]): string {
  const r = q.response;
  if (!r || r.kind !== 'answer') return '';
  const labels = r.optionIds.map((id) => q.options?.find((o) => o.id === id)?.label ?? id);
  return [...labels, ...(r.text ? [r.text] : [])].join(' ');
}

function makeMatcher(query: string, regex: boolean | undefined): (text: string) => number {
  if (regex) {
    let re: RegExp;
    try { re = new RegExp(query, 'i'); }
    catch (e) { throw new Error(`Invalid regular expression: ${(e as Error).message}`); }
    return (text) => text.search(re);
  }
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return (text) => {
    const lower = text.toLowerCase();
    if (!words.every((w) => lower.includes(w))) return -1;
    return words.length ? lower.indexOf(words[0]!) : 0;
  };
}

function excerptAround(text: string, at: number): string {
  const flat = text.replace(/\s+/g, ' ');
  const start = Math.max(0, Math.min(at, flat.length) - EXCERPT_RADIUS);
  const end = Math.min(flat.length, start + EXCERPT_RADIUS * 2);
  return `${start > 0 ? '…' : ''}${flat.slice(start, end).trim()}${end < flat.length ? '…' : ''}`;
}

export async function searchSessions(projectDir: string,
  o: { query: string; regex?: boolean; limit?: number }): Promise<SearchHit[]> {
  const match = makeMatcher(o.query, o.regex);
  const limit = o.limit ?? 50;
  const hits: SearchHit[] = [];
  if (limit <= 0) return hits;
  for (const summary of await listSessions(projectDir)) {
    const s = await loadSession(projectDir, summary.id);
    const base = { sessionId: s.id, sessionTitle: s.title };
    const add = (hit: Omit<SearchHit, 'sessionId' | 'sessionTitle'>): boolean => {
      hits.push({ ...base, ...hit });
      return hits.length >= limit;
    };
    for (const qid of s.order) {
      const q = s.questions[qid]!;
      const answer = answerText(q);
      const note = q.response?.kind === 'answer' ? q.response.note ?? '' : '';
      const text = [q.title, q.body, answer, note, q.decision ?? ''].filter(Boolean).join('\n');
      const at = match(text);
      if (at < 0) continue;
      if (add({ kind: 'question', qid, title: q.title, ...(answer ? { answer } : {}),
        ...(q.decision !== undefined ? { decision: q.decision } : {}), excerpt: excerptAround(text, at) })) return hits;
    }
    for (const n of s.notes) {
      const at = match(n.markdown);
      if (at >= 0 && add({ kind: 'note', excerpt: excerptAround(n.markdown, at) })) return hits;
    }
    if (s.summary) {
      const at = match(s.summary.markdown);
      if (at >= 0 && add({ kind: 'summary', excerpt: excerptAround(s.summary.markdown, at) })) return hits;
    }
  }
  return hits;
}
