import type { Event, QuestionInput, UserResponse } from './events';

export type QuestionStatus = 'open' | 'done' | 'sent' | 'settled' | 'assumed' | 'retracted';
export type Question = QuestionInput & { status: QuestionStatus; isNew: boolean; isRevision: boolean;
  response?: UserResponse; decision?: string; reason?: string; childIds: string[] };
export type Progress = { total: number; sent: number; done: number; open: number;
  newCount: number; totalAtLastBatch: number | null };
export type SessionState = { v: number; id: string; title: string; parentSessionId?: string;
  phase: 'active' | 'summary' | 'confirmed'; questions: Record<string, Question>; order: string[];
  agentStatus?: string; summary?: { html: string; markdown: string; abstract: string };
  notes: { ts: string; markdown: string }[]; unsentCount: number; pendingWake: boolean;
  eventCount: number; progress: Progress };

type Mark = { response: UserResponse; idx: number; revision: boolean; sentIdx?: number };
type Track = {
  input: QuestionInput; postedIdx: number; children: string[];
  marks: Mark[]; resolution?: { decision: string; assumed: boolean; reason?: string; idx: number };
  retracted?: { reason: string };
};

export function reduce(events: Event[]): SessionState {
  let v = 0, id = '', title = '';
  let parentSessionId: string | undefined;
  let phase: SessionState['phase'] = 'active';
  let agentStatus: string | undefined;
  let summary: SessionState['summary'];
  const notes: SessionState['notes'] = [];
  const tracks = new Map<string, Track>();
  const roots: string[] = [];
  let lastBatchIdx = -1;
  let lastWakeIdx = -1;
  let ackThrough = 0;
  let totalAtLastBatch: number | null = null;

  const statusOf = (t: Track): QuestionStatus => {
    if (t.retracted) return 'retracted';
    const mark = t.marks[t.marks.length - 1];
    // An unsent response is done whatever a resolution says: the agent has not seen it, so no
    // resolution can answer it, and the user's correction must never be dropped silently.
    if (mark && mark.sentIdx === undefined) return 'done';
    const res = t.resolution;
    if (res && (!mark || res.idx > mark.sentIdx!)) return res.assumed ? 'assumed' : 'settled';
    return mark ? 'sent' : 'open';
  };
  const liveTotal = () => [...tracks.values()].filter((t) => !t.retracted).length;

  events.forEach((e, idx) => {
    switch (e.type) {
      case 'session_created':
        v = e.v; id = e.id; title = e.title; parentSessionId = e.parentSessionId;
        break;
      case 'questions_posted': {
        agentStatus = undefined;   // the agent now waits for the user
        for (const q of e.questions) {
          if (tracks.has(q.id)) continue;
          tracks.set(q.id, { input: q, postedIdx: idx, children: [], marks: [] });
          const parent = q.parentId === undefined ? undefined : tracks.get(q.parentId);
          if (parent) parent.children.push(q.id); else roots.push(q.id);
        }
        if (phase === 'summary') phase = 'active';
        break;
      }
      case 'response_marked': {
        const t = tracks.get(e.qid);
        if (!t || t.retracted) break;
        const prior = statusOf(t);
        const top = t.marks[t.marks.length - 1];
        // Editing an unsent revision again keeps it a revision.
        t.marks.push({ response: e.response, idx, revision: prior === 'sent' || prior === 'settled'
          || prior === 'assumed' || (prior === 'done' && !!top?.revision) });
        if (phase === 'summary') phase = 'active';
        break;
      }
      case 'response_cleared': {
        const t = tracks.get(e.qid);
        const top = t?.marks[t.marks.length - 1];
        if (t && top && top.sentIdx === undefined) t.marks.pop();
        break;
      }
      case 'batch_sent':
        lastBatchIdx = idx; lastWakeIdx = idx; totalAtLastBatch = liveTotal();
        for (const t of tracks.values()) {
          const top = t.marks[t.marks.length - 1];
          if (top && top.sentIdx === undefined) top.sentIdx = idx;
        }
        break;
      case 'updates_acked':
        ackThrough = e.through;
        break;
      case 'question_resolved': {
        const t = tracks.get(e.qid);
        if (t && !t.retracted) t.resolution = { decision: e.decision, assumed: e.assumed, reason: e.reason, idx };
        break;
      }
      case 'question_retracted': {
        const t = tracks.get(e.qid);
        if (t) t.retracted = { reason: e.reason };
        break;
      }
      case 'status_set':
        agentStatus = e.text;
        break;
      case 'summary_posted':
        agentStatus = undefined;
        summary = { html: e.html, markdown: e.markdown, abstract: e.abstract };
        phase = 'summary';
        break;
      case 'session_confirmed':
        phase = 'confirmed'; lastWakeIdx = idx;
        break;
      case 'session_reopened':
        phase = 'active'; lastWakeIdx = idx;
        break;
      case 'note_added':
        notes.push({ ts: e.ts, markdown: e.markdown });
        break;
    }
  });

  const questions: Record<string, Question> = {};
  const progress: Progress = { total: 0, sent: 0, done: 0, open: 0, newCount: 0, totalAtLastBatch };
  for (const [qid, t] of tracks) {
    const status = statusOf(t);
    const mark = t.marks[t.marks.length - 1];
    const q: Question = { ...t.input, status, childIds: [...t.children],
      isNew: status === 'open' && t.postedIdx > lastBatchIdx,
      isRevision: status === 'done' && !!mark?.revision };
    if (mark) q.response = mark.response;
    if (t.resolution && (status === 'settled' || status === 'assumed')) {
      q.decision = t.resolution.decision;
      if (t.resolution.reason !== undefined) q.reason = t.resolution.reason;
    }
    if (t.retracted) q.reason = t.retracted.reason;
    questions[qid] = q;
    if (status === 'retracted') continue;
    progress.total += 1;
    if (status === 'sent' || status === 'settled' || status === 'assumed') progress.sent += 1;
    else if (status === 'done') progress.done += 1;
    else progress.open += 1;
    if (q.isNew) progress.newCount += 1;
  }

  const order: string[] = [];
  const walk = (qid: string) => { order.push(qid); for (const c of tracks.get(qid)!.children) walk(c); };
  roots.forEach(walk);

  const state: SessionState = { v, id, title, phase, questions, order, notes,
    unsentCount: progress.done, pendingWake: lastWakeIdx >= ackThrough && lastWakeIdx >= 0,
    eventCount: events.length, progress };
  if (parentSessionId !== undefined) state.parentSessionId = parentSessionId;
  if (agentStatus !== undefined) state.agentStatus = agentStatus;
  if (summary) state.summary = summary;
  return state;
}
