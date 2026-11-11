import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import type { UserResponse } from '../core/events';
import type { ZodRawShape } from 'zod';
import type { Event, QuestionInput } from '../core/events';
import { reduce } from '../core/reduce';
import { registerProject } from '../core/registry';
import { searchSessions } from '../core/search';
import { append, createSession, listSessions, loadEvents, loadSession, SessionNotFound } from '../core/store';
import { accessHints as defaultHints, currentPort, openBrowser as defaultOpen, sessionUrl as defaultUrl } from '../server/open';

export type ToolDef = { description: string; schema: ZodRawShape; handler(args: any): Promise<unknown> };
export type ToolDeps = {
  sessionUrl: (pk: string, id: string) => Promise<string>;
  accessHints: (env: NodeJS.ProcessEnv, port: number) => string[];
  openBrowser: (url: string) => Promise<boolean>;
  ready: () => Promise<void>;
  port: () => Promise<number>;
  cliPath: string;
};

export function defaultCliPath(): string {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), 'cli.js');
}

const fwd = (p: string) => p.replace(/\\/g, '/');

const option = z.object({ id: z.string(), label: z.string(), consequence: z.string().optional(),
  recommended: z.boolean().optional() });
const question = z.object({
  id: z.string().describe('Case-sensitive and new within the session, e.g. "Q1", "Q2"; a follow-up adds a letter to its parent\'s id, e.g. "Q1a", "Q1b"'),
  parentId: z.string().optional().describe('Id of an existing question this one follows up on'),
  title: z.string(), body: z.string().describe('Markdown'),
  recommendation: z.string().optional(), options: z.array(option).optional(),
  multi: z.boolean().optional().describe('Allow choosing several options') });

export function createTools(projectDir: string, deps: Partial<ToolDeps> = {}): Record<string, ToolDef> {
  const d: ToolDeps = {
    sessionUrl: defaultUrl, accessHints: defaultHints, openBrowser: defaultOpen,
    ready: async () => {}, port: currentPort, cliPath: defaultCliPath(), ...deps };

  const load = async (id: string) => {
    try { return await loadEvents(projectDir, id); }
    catch (e) { if (e instanceof SessionNotFound) throw new Error(`Unknown session ${id}`); throw e; }
  };
  const knownQuestion = async (sessionId: string, qid: string) => {
    const state = reduce(await load(sessionId));
    if (!state.questions[qid]) throw new Error(`Unknown question ${qid} in session ${sessionId}`);
  };

  const tools: Record<string, ToolDef> = {
    start_session: {
      description: 'Call once when you begin a question round (for example a grill-me interview) to open a session and a live page where the user answers. Returns the page url, and the waitCommand you must then run in the background; it exits when the user presses Respond.',
      schema: { title: z.string(), parentSessionId: z.string().optional().describe('Session this one continues') },
      async handler(a: { title: string; parentSessionId?: string }) {
        const pk = await registerProject(projectDir);
        const sessionId = await createSession(projectDir, a);
        await d.ready();
        const url = await d.sessionUrl(pk, sessionId);
        const port = await d.port();
        const browserOpened = await d.openBrowser(url);
        return { sessionId, url,
          waitCommand: `node "${fwd(d.cliPath)}" wait ${sessionId} --dir "${fwd(projectDir)}"`,
          hints: d.accessHints(process.env, port), browserOpened };
      },
    },
    post_questions: {
      description: 'Call to add a batch of questions to the session page. Ids must be new; parentId must name an existing question or one earlier in the same batch. After posting, run the wait command in the background.',
      schema: { sessionId: z.string(), questions: z.array(question).min(1) },
      async handler(a: { sessionId: string; questions: QuestionInput[] }) {
        const state = reduce(await load(a.sessionId));
        const seen = new Set(Object.keys(state.questions));
        for (const x of a.questions) {
          if (seen.has(x.id)) throw new Error(`Question ${x.id} already exists (duplicate id)`);
          if (x.parentId !== undefined && !seen.has(x.parentId)) throw new Error(`Question ${x.id} has unknown parentId ${x.parentId}`);
          seen.add(x.id);
        }
        await append(projectDir, a.sessionId, { type: 'questions_posted', questions: a.questions }, 'agent');
        return { posted: a.questions.map((x) => x.id) };
      },
    },
    get_updates: {
      description: 'Call after the wait command exits or when the user says they have responded. Returns the responses the user has sent since your last call, whether the user confirmed the session, any reopen note, and waitingOn: the questions the user has not answered yet, which stay theirs to answer. Answers the user marked Done but has not sent are never included.',
      schema: { sessionId: z.string() },
      async handler(a: { sessionId: string }) {
        const events = await load(a.sessionId);
        const state = reduce(events);
        let prevAck = 0, reopenNote: string | undefined;
        events.forEach((e) => { if (e.type === 'updates_acked') prevAck = e.through; });
        events.forEach((e, i) => { if (e.type === 'session_reopened' && i >= prevAck) reopenNote = e.note; });
        const lastMark = markIndexes(events);
        const batches = events.flatMap((e, i) => (e.type === 'batch_sent' ? [i] : []));
        const responses: { qid: string; title: string; response: unknown; isRevision: boolean }[] = [];
        for (const qid of state.order) {
          const qn = state.questions[qid]!;
          const mi = lastMark.get(qid);
          if (qn.status !== 'sent' || mi === undefined || !qn.response) continue;
          const bi = batches.find((b) => b > mi);
          if (bi === undefined || bi < prevAck) continue;
          responses.push({ qid, title: qn.title, response: qn.response,
            isRevision: reduce(events.slice(0, mi + 1)).questions[qid]?.isRevision ?? false });
        }
        await append(projectDir, a.sessionId, { type: 'updates_acked', through: events.length }, 'agent');
        const waitingOn = state.order.filter((id) => ['open', 'done'].includes(state.questions[id]!.status));
        return { responses, confirmed: state.phase === 'confirmed',
          ...(reopenNote !== undefined ? { reopenNote } : {}),
          openCount: waitingOn.length, waitingOn,
          ...(waitingOn.length ? { note: `The user has not answered ${waitingOn.join(', ')} yet. The session is not finished: do not resolve or assume these. Handle the responses above, then run the wait command again. Retract one only if an answer made it irrelevant.` } : {}) };
      },
    },
    resolve_question: {
      description: 'Call when a question the user has responded to is decided. From their answer: assumed=false, the decision in your words. When they skipped it: assumed=true with a reason; this is the only case where you decide yourself. Refused for a question the user has not sent a response to (it stays open until they answer), and assumed=true is refused unless the user skipped.',
      schema: { sessionId: z.string(), qid: z.string(), decision: z.string(),
        assumed: z.boolean().optional(), reason: z.string().optional() },
      async handler(a: { sessionId: string; qid: string; decision: string; assumed?: boolean; reason?: string }) {
        await knownQuestion(a.sessionId, a.qid);
        // Sending part of a round is not delegating the rest: only the user's own Skip hands a decision over.
        // A question counts as answered once any response to it was sent, so an unsent revision does not block.
        const events = await load(a.sessionId);
        let pending: UserResponse | undefined, sent: UserResponse | undefined;
        for (const e of events) {
          if (e.type === 'response_marked' && e.qid === a.qid) pending = e.response;
          else if (e.type === 'response_cleared' && e.qid === a.qid) pending = undefined;
          else if (e.type === 'batch_sent' && pending) sent = pending;
        }
        if (!sent) throw new Error(`Cannot resolve ${a.qid}: the user has not sent an answer to it yet. Leave it open and run the wait command again; do not decide it for them. Only if another answer made it irrelevant, call retract_question with a short reason.`);
        // The agent decides a question itself only when the user skipped it, and then it must say so and why.
        const assumed = a.assumed ?? false;
        if (sent.kind === 'skip') {
          if (!assumed || !a.reason?.trim()) throw new Error(`The user skipped ${a.qid}, so this decision is yours: call resolve_question with assumed=true and a reason, so they can review it.`);
        } else if (assumed) {
          throw new Error(sent.kind === 'invalid'
            ? `Cannot assume ${a.qid}: the user called the question invalid, they did not skip it. Retract it with a short reason, or post a corrected follow-up question. Decide a question yourself only when the user skipped it.`
            : `Cannot assume ${a.qid}: the user answered it. Resolve it with assumed=false and the decision their answer gives; if the answer is unclear, post a follow-up question. Decide a question yourself only when the user skipped it.`);
        }
        await append(projectDir, a.sessionId, { type: 'question_resolved', qid: a.qid, decision: a.decision,
          assumed: a.assumed ?? false, ...(a.reason !== undefined ? { reason: a.reason } : {}) }, 'agent');
        return { ok: true };
      },
    },
    retract_question: {
      description: 'Call when a posted question no longer needs an answer (answered elsewhere, or made moot by another answer). Give the reason. Not a way to close questions the user simply has not reached yet.',
      schema: { sessionId: z.string(), qid: z.string(), reason: z.string().describe('One short sentence the user will read') },
      async handler(a: { sessionId: string; qid: string; reason: string }) {
        await knownQuestion(a.sessionId, a.qid);
        if (!a.reason.trim()) throw new Error(`Cannot retract ${a.qid} without a reason: say in a short sentence why it no longer needs an answer.`);
        await append(projectDir, a.sessionId, { type: 'question_retracted', qid: a.qid, reason: a.reason }, 'agent');
        return { ok: true };
      },
    },
    set_status: {
      description: 'Call to show the user a short line about what you are doing now (for example "reading the repo", "drafting the summary").',
      schema: { sessionId: z.string(), text: z.string() },
      async handler(a: { sessionId: string; text: string }) {
        await load(a.sessionId);
        await append(projectDir, a.sessionId, { type: 'status_set', text: a.text }, 'agent');
        return { ok: true };
      },
    },
    post_summary: {
      description: 'Call when every question is settled, assumed or retracted, to present the final summary for the user to confirm. Refused while any question is still open, done or sent.',
      schema: { sessionId: z.string(), html: z.string(), markdown: z.string(), abstract: z.string() },
      async handler(a: { sessionId: string; html: string; markdown: string; abstract: string }) {
        const state = reduce(await load(a.sessionId));
        const bad = state.order.filter((id) => ['open', 'done', 'sent'].includes(state.questions[id]!.status));
        if (bad.length) {
          const waiting = bad.filter((id) => state.questions[id]!.status !== 'sent');
          const sent = bad.filter((id) => state.questions[id]!.status === 'sent');
          throw new Error('Cannot post the summary yet.'
            + (waiting.length ? ` The user has not answered ${waiting.join(', ')}: run the wait command and wait for them (retract one only if it is no longer relevant).` : '')
            + (sent.length ? ` Answered but not resolved: ${sent.join(', ')}; call resolve_question for each.` : ''));
        }
        await append(projectDir, a.sessionId, { type: 'summary_posted', html: a.html, markdown: a.markdown, abstract: a.abstract }, 'agent');
        return { ok: true };
      },
    },
    add_note: {
      description: 'Call to attach a Markdown note to the session record (context, caveats, follow-ups) that is not a question.',
      schema: { sessionId: z.string(), markdown: z.string() },
      async handler(a: { sessionId: string; markdown: string }) {
        await load(a.sessionId);
        await append(projectDir, a.sessionId, { type: 'note_added', markdown: a.markdown }, 'agent');
        return { ok: true };
      },
    },
    list_sessions: {
      description: 'Call to list the sessions of this project, newest first, with phase and progress.',
      schema: {},
      handler: () => listSessions(projectDir),
    },
    get_session: {
      description: 'Call to read a whole session: title, phase, notes, summary Markdown, and every question with its response and decision.',
      schema: { sessionId: z.string() },
      async handler(a: { sessionId: string }) {
        await load(a.sessionId);
        const s = await loadSession(projectDir, a.sessionId);
        return { id: s.id, title: s.title, phase: s.phase, notes: s.notes,
          summary: s.summary?.markdown, questions: s.order.map((id) => s.questions[id]) };
      },
    },
    search_sessions: {
      description: 'Call to search past sessions of this project (questions, answers, decisions, notes, summaries) for earlier decisions before asking something again.',
      schema: { query: z.string(), regex: z.boolean().optional(), limit: z.number().int().positive().optional() },
      handler: (a: { query: string; regex?: boolean; limit?: number }) => searchSessions(projectDir, a),
    },
  };
  return tools;
}

// Event index of each question's current (latest, uncleared-or-sent) response mark.
function markIndexes(events: Event[]): Map<string, number> {
  const marks = new Map<string, number[]>();
  let lastBatch = -1;
  events.forEach((e, i) => {
    if (e.type === 'response_marked') marks.set(e.qid, [...(marks.get(e.qid) ?? []), i]);
    else if (e.type === 'response_cleared') {
      const m = marks.get(e.qid);
      if (m?.length && !(lastBatch > m[m.length - 1]!)) m.pop();
    } else if (e.type === 'batch_sent') lastBatch = i;
  });
  const out = new Map<string, number>();
  for (const [qid, m] of marks) if (m.length) out.set(qid, m[m.length - 1]!);
  return out;
}
