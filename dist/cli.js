import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);

// src/cli/main.ts
import path2 from "node:path";

// src/core/store.ts
import path from "node:path";

// src/core/events.ts
var FORMAT_VERSION = 1;

// src/core/reduce.ts
function reduce(events) {
  let v = 0, id = "", title = "";
  let parentSessionId;
  let phase = "active";
  let agentStatus;
  let summary;
  const notes = [];
  const tracks = /* @__PURE__ */ new Map();
  const roots = [];
  let lastBatchIdx = -1;
  let lastWakeIdx = -1;
  let ackThrough = 0;
  let totalAtLastBatch = null;
  const statusOf = (t) => {
    if (t.retracted) return "retracted";
    const mark = t.marks[t.marks.length - 1];
    if (mark && mark.sentIdx === void 0) return "done";
    const res = t.resolution;
    if (res && (!mark || res.idx > mark.sentIdx)) return res.assumed ? "assumed" : "settled";
    return mark ? "sent" : "open";
  };
  const liveTotal = () => [...tracks.values()].filter((t) => !t.retracted).length;
  events.forEach((e, idx) => {
    switch (e.type) {
      case "session_created":
        v = e.v;
        id = e.id;
        title = e.title;
        parentSessionId = e.parentSessionId;
        break;
      case "questions_posted": {
        agentStatus = void 0;
        for (const q of e.questions) {
          if (tracks.has(q.id)) continue;
          tracks.set(q.id, { input: q, postedIdx: idx, children: [], marks: [] });
          const parent = q.parentId === void 0 ? void 0 : tracks.get(q.parentId);
          if (parent) parent.children.push(q.id);
          else roots.push(q.id);
        }
        if (phase === "summary") phase = "active";
        break;
      }
      case "response_marked": {
        const t = tracks.get(e.qid);
        if (!t || t.retracted) break;
        const prior = statusOf(t);
        const top = t.marks[t.marks.length - 1];
        t.marks.push({ response: e.response, idx, revision: prior === "sent" || prior === "settled" || prior === "assumed" || prior === "done" && !!top?.revision });
        if (phase === "summary") phase = "active";
        break;
      }
      case "response_cleared": {
        const t = tracks.get(e.qid);
        const top = t?.marks[t.marks.length - 1];
        if (t && top && top.sentIdx === void 0) t.marks.pop();
        break;
      }
      case "batch_sent":
        lastBatchIdx = idx;
        lastWakeIdx = idx;
        totalAtLastBatch = liveTotal();
        for (const t of tracks.values()) {
          const top = t.marks[t.marks.length - 1];
          if (top && top.sentIdx === void 0) top.sentIdx = idx;
        }
        break;
      case "updates_acked":
        ackThrough = e.through;
        break;
      case "question_resolved": {
        const t = tracks.get(e.qid);
        if (t && !t.retracted) t.resolution = { decision: e.decision, assumed: e.assumed, reason: e.reason, idx };
        break;
      }
      case "question_retracted": {
        const t = tracks.get(e.qid);
        if (t) t.retracted = { reason: e.reason };
        break;
      }
      case "status_set":
        agentStatus = e.text;
        break;
      case "summary_posted":
        agentStatus = void 0;
        summary = { html: e.html, markdown: e.markdown, abstract: e.abstract };
        phase = "summary";
        break;
      case "session_confirmed":
        phase = "confirmed";
        lastWakeIdx = idx;
        break;
      case "session_reopened":
        phase = "active";
        lastWakeIdx = idx;
        break;
      case "note_added":
        notes.push({ ts: e.ts, markdown: e.markdown });
        break;
    }
  });
  const questions = {};
  const progress = { total: 0, sent: 0, done: 0, open: 0, newCount: 0, totalAtLastBatch };
  for (const [qid, t] of tracks) {
    const status = statusOf(t);
    const mark = t.marks[t.marks.length - 1];
    const q = {
      ...t.input,
      status,
      childIds: [...t.children],
      isNew: status === "open" && t.postedIdx > lastBatchIdx,
      isRevision: status === "done" && !!mark?.revision
    };
    if (mark) q.response = mark.response;
    if (t.resolution && (status === "settled" || status === "assumed")) {
      q.decision = t.resolution.decision;
      if (t.resolution.reason !== void 0) q.reason = t.resolution.reason;
    }
    if (t.retracted) q.reason = t.retracted.reason;
    questions[qid] = q;
    if (status === "retracted") continue;
    progress.total += 1;
    if (status === "sent" || status === "settled" || status === "assumed") progress.sent += 1;
    else if (status === "done") progress.done += 1;
    else progress.open += 1;
    if (q.isNew) progress.newCount += 1;
  }
  const order = [];
  const walk = (qid) => {
    order.push(qid);
    for (const c of tracks.get(qid).children) walk(c);
  };
  roots.forEach(walk);
  const state = {
    v,
    id,
    title,
    phase,
    questions,
    order,
    notes,
    unsentCount: progress.done,
    pendingWake: lastWakeIdx >= ackThrough && lastWakeIdx >= 0,
    eventCount: events.length,
    progress
  };
  if (parentSessionId !== void 0) state.parentSessionId = parentSessionId;
  if (agentStatus !== void 0) state.agentStatus = agentStatus;
  if (summary) state.summary = summary;
  return state;
}

// src/core/log.ts
import { promises as fs } from "node:fs";
async function readEvents(file) {
  const text = await fs.readFile(file, "utf8");
  const out = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line));
    } catch {
    }
  }
  return out;
}

// src/core/store.ts
var SessionNotFound = class extends Error {
};
var UnsupportedVersion = class extends Error {
  constructor(found) {
    super(`Session format v${found} is newer than supported; update Rotisserie to view this session`);
    this.found = found;
  }
  found;
};
var sessionsDir = (projectDir) => path.join(projectDir, ".rotisserie", "sessions");
var SESSION_ID = /^rt-[0-9a-f]{4}$/;
function checkId(id) {
  if (!SESSION_ID.test(id)) throw new SessionNotFound(id);
}
function sessionFile(projectDir, id) {
  checkId(id);
  return path.join(sessionsDir(projectDir), `${id}.jsonl`);
}
async function loadEvents(projectDir, id) {
  let events;
  try {
    events = await readEvents(sessionFile(projectDir, id));
  } catch (e) {
    if (e.code === "ENOENT") throw new SessionNotFound(id);
    throw e;
  }
  const head = events[0];
  if (!head || head.type !== "session_created") throw new SessionNotFound(id);
  if (head.v > FORMAT_VERSION) throw new UnsupportedVersion(head.v);
  return events;
}
async function loadSession(projectDir, id) {
  return reduce(await loadEvents(projectDir, id));
}

// src/cli/wait.ts
import { promises as fs2 } from "node:fs";
var abortError = (signal) => signal.reason instanceof Error ? signal.reason : Object.assign(new Error("aborted"), { name: "AbortError" });
function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError(signal));
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError(signal));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
async function logSize(file) {
  try {
    return (await fs2.stat(file)).size;
  } catch {
    return -1;
  }
}
async function waitForUpdates(projectDir, id, o = {}) {
  const interval = o.intervalMs ?? 1e3;
  const file = sessionFile(projectDir, id);
  for (; ; ) {
    if (o.signal?.aborted) throw abortError(o.signal);
    const size = await logSize(file);
    const s = await loadSession(projectDir, id);
    if (s.pendingWake) return "updates";
    if (s.phase === "confirmed") return "closed";
    while (await logSize(file) === size) await sleep(interval, o.signal);
  }
}

// src/cli/main.ts
function flag(args, name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : void 0;
}
async function main(argv) {
  const [cmd, id, ...rest] = argv;
  if (cmd !== "wait" || !id || id.startsWith("--")) {
    process.stderr.write("usage: rotisserie wait <sessionId> [--dir <projectDir>] [--interval <ms>]\n");
    return 2;
  }
  const dir = path2.resolve(flag(rest, "--dir") ?? process.cwd());
  const raw = flag(rest, "--interval");
  const intervalMs = raw === void 0 ? 1e3 : Number(raw);
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    process.stderr.write(`invalid --interval: ${raw}
`);
    return 2;
  }
  try {
    const result = await waitForUpdates(dir, id, { intervalMs });
    process.stdout.write(result === "updates" ? `ROTISSERIE: updates ready for ${id}. Call get_updates.
` : `ROTISSERIE: session ${id} is closed.
`);
    return 0;
  } catch (e) {
    if (e instanceof SessionNotFound) {
      process.stderr.write(`ROTISSERIE: session ${id} not found in ${dir}
`);
      return 2;
    }
    process.stderr.write(`ROTISSERIE: ${e.message}
`);
    return 1;
  }
}
process.exitCode = await main(process.argv.slice(2));
