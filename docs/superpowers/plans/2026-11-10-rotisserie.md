# Rotisserie Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Claude Code plugin that moves grill-me question rounds into a live browser page and lets the agent wait for answers at zero token cost.

**Architecture:** Each session is an append-only JSONL event log in the project's `.rotisserie/` folder; state is a pure reduction of that log. A stdio MCP server gives the agent tools that append events, and the first MCP process to claim the port also hosts one shared web server that reads the logs, appends the user's actions, and pushes changes over SSE. The agent waits by running a file-polling `wait` command as a background shell task.

**Tech Stack:** Node.js ≥ 20, TypeScript, `@modelcontextprotocol/sdk` + `zod`, Node's built-in `http`, Preact, esbuild (one bundler for server and web), Vitest (+ jsdom and `@testing-library/preact` for the web).

**Spec:** `docs/superpowers/specs/2026-11-10-rotisserie-design.md`. Mockups: https://claude.ai/artifact/92RfaRsxVN836ukogQ4sDQ . The source of the three screens is in `docs/superpowers/specs/mockups/` (`Main.dc.html`, `Dark.dc.html`, `Summary.dc.html`): read the inline-styled markup for layout, spacing and colour values, and ignore the canvas wrapper around it. The mockups predate four decisions and do not show them: the sidebar fold button, the project filter, the offline banner, and bundled fonts. Where a mockup and this plan disagree, the plan wins. The palette, type, shape rules and logo are written down in `docs/superpowers/specs/2026-11-10-rotisserie-visual-design.md`, and the chosen logo and favicon are saved as `docs/superpowers/specs/logo/logo.svg` and `favicon.svg`.

## Global Constraints

- Runs on Linux, macOS, Windows and WSL. Use `node:path` for every path; never concatenate with `/`. No native dependencies. No shell-outs except to open the browser.
- The plugin runs from a committed `dist/` with only `node` on the PATH. Every runtime dependency is bundled by esbuild.
- Works in the default Claude Code sandbox: the `wait` command does file reads only, no network, no port.
- Files are the source of truth. Session logs are append-only: one JSON event per line, one `fs.appendFile` call per event. Never rewrite a log.
- `FORMAT_VERSION = 1`. A reader that meets a higher version refuses to render and says "update Rotisserie to view this session".
- Server binds `127.0.0.1` unless `ROTISSERIE_HOST` is set. Port is `ROTISSERIE_PORT` or `4783`. The token is required on every `/api/*` request except health; static files carry no data and need none.
- The page makes no request to any other host: fonts, scripts and styles are all served from `dist/web/`.
- A `.gitattributes` with `* text=auto eol=lf` keeps the committed `dist/` byte-identical across operating systems.
- `ROTISSERIE_HOME` overrides `~/.rotisserie` (tests always set it to a temp dir).
- Nothing is copied from `mattpocock-skills`.
- A live update must never move focus, caret, scroll position or typed text.
- Every question state shows an icon and a text label as well as a colour. The button label is "Skip", not "Skip, I don't know".
- Commit after every task with a conventional-commit message.

## Review Focus

1. **Corrupt or half-written log line** (crash mid-append, two writers): the session still loads; the bad line is skipped. Test in Task 2.
2. **Markup in user or agent text** (`<script>`, `<img onerror>` in a question body, answer or note; script or remote URL in summary HTML): text renders as text; the summary frame runs no script and makes no request. Tests in Tasks 9 and 11.
3. **Request without the token, or a cross-origin POST**: rejected with 401/403 and no event appended. Test in Task 6.
4. **Agent posts a follow-up while the user is typing**: the textarea keeps its text, caret and focus, and the scroll offset of the focused card does not change. Test in Task 9.
5. **Awkward project paths** (spaces, non-ASCII, Windows drive letters, two projects with the same folder name): each gets a distinct project key and its sessions load. Test in Task 2.

## File Structure

```
.claude-plugin/plugin.json        plugin manifest
.claude-plugin/marketplace.json   single-plugin marketplace
.mcp.json                         starts dist/mcp.js over stdio
skills/grill/SKILL.md             overlay on mattpocock-skills:grilling
skills/grill-with-docs/SKILL.md   same, plus domain-modeling
src/core/events.ts                event and input types, FORMAT_VERSION
src/core/reduce.ts                reduce(events) -> SessionState (pure)
src/core/log.ts                   appendEvent, readEvents
src/core/store.ts                 create/load/list sessions, drafts
src/core/registry.ts              ~/.rotisserie: token, projects, server info
src/core/search.ts                keyword/regex search
src/cli/wait.ts                   the wait loop
src/cli/main.ts                   CLI entry (dist/cli.js)
src/mcp/tools.ts                  tool handlers (no transport)
src/mcp/main.ts                   stdio entry (dist/mcp.js); starts host loop
src/server/http.ts                HTTP API, SSE, static files, auth
src/server/host.ts                port claim and takeover
src/server/open.ts                session URL, browser open, SSH/WSL hints
web/index.html, web/src/main.tsx  page entry
web/src/api.ts                    fetch + SSE client
web/src/outbox.ts                 local-storage action queue, offline overlay
web/assets/                       logo.svg, favicon.svg
web/src/theme.css                 colour tokens, fonts, light and dark
web/src/App.tsx                   shell and routing
web/src/Sidebar.tsx               sessions by project, filter, past sessions
web/src/SessionView.tsx           header, progress, filters, list, respond bar
web/src/QuestionCard.tsx          one question in every state
web/src/keyboard.ts               shortcut map and focus order
web/src/Summary.tsx               summary frame and confirmation
scripts/build.mjs                 esbuild for dist/mcp.js, dist/cli.js, dist/web/
tests/…                           mirrors src/ and web/src/
```

Task order: 0 → 1 → 2 → then 3, 4, 5, 6 can run in parallel → 7. Web tasks 8 → 8a → 9 → 10 and 11 depend only on the types from Task 1 and the HTTP contract in Task 6's Interfaces block, so they can run alongside the backend. Task 12 is last.

---

### Task 0: Sandbox spike (throwaway, needs the user for 5 minutes)

**Files:** Create `spike/.claude-plugin/plugin.json`, `spike/.mcp.json`, `spike/server.mjs`. Deleted at the end of the task.

- [ ] **Step 1:** Write `spike/server.mjs`: a stdio MCP server (SDK from a temporary `npm i` inside `spike/`) with one tool `spike_bind` that starts `http.createServer` on `127.0.0.1:4783`, writes `spike-ok.txt` into the current project's `.rotisserie/`, tries to open `http://127.0.0.1:4783/` in the browser, and returns the result of each of the three actions plus `process.cwd()` and `process.env.CLAUDE_PROJECT_DIR` (Task 5 needs to know how the server learns the project folder).
- [ ] **Step 2:** In the orchestrating session, run in the background, in the default sandbox: `node -e "const fs=require('fs');const t=setInterval(()=>{if(fs.existsSync('.rotisserie/spike-ok.txt')){console.log('woke');process.exit(0)}},1000)"`. Expected: it keeps running and costs nothing.
- [ ] **Step 3:** Ask the user to run `claude --plugin-dir ./spike` in this folder and tell that session "call spike_bind". Expected: the tool reports the port bound and the file written, a browser tab opens, and the background task from Step 2 exits and wakes the orchestrating session.
- [ ] **Step 4:** Record the outcome at the bottom of the spec under "Spike result". If binding, file writing or the wake-up fails, **stop and return to the user**. A failed browser open is acceptable (the URL is always printed). The spike proves the wake-up over minutes, not hours; a multi-hour wait stays an untested risk whose fallback is the user typing in the terminal. Record that too, along with which of `cwd` and `CLAUDE_PROJECT_DIR` pointed at the project.
- [ ] **Step 5:** Delete `spike/` and `.rotisserie/spike-ok.txt`. `git init`, add `.gitignore` (`node_modules/`) and `.gitattributes` (`* text=auto eol=lf`), commit the docs.

### Task 1: Project scaffold and the pure core

**Files:** Create `package.json`, `tsconfig.json`, `vitest.config.ts`, `scripts/build.mjs`, `src/core/events.ts`, `src/core/reduce.ts`. Test: `tests/core/reduce.test.ts`.

**Interfaces — Produces** (the contract every other task uses):

```ts
// src/core/events.ts
export const FORMAT_VERSION = 1;
export type OptionInput = { id: string; label: string; consequence?: string; recommended?: boolean };
export type QuestionInput = { id: string; parentId?: string; title: string; body: string;
  recommendation?: string; options?: OptionInput[]; multi?: boolean };
export type UserResponse =          // not "Response": that name is the browser's fetch type
  | { kind: 'answer'; optionIds: string[]; text?: string; note?: string }
  | { kind: 'skip' }
  | { kind: 'invalid'; reason: string };
export type EventBody =
  | { type: 'session_created'; v: number; id: string; title: string; parentSessionId?: string }
  | { type: 'questions_posted'; questions: QuestionInput[] }
  | { type: 'response_marked'; qid: string; response: UserResponse } // user pressed Done / Skip / Invalid
  | { type: 'response_cleared'; qid: string }
  | { type: 'batch_sent' }                                          // user pressed Respond
  | { type: 'updates_acked'; through: number }                      // agent read events [0, through)
  | { type: 'question_resolved'; qid: string; decision: string; assumed: boolean; reason?: string }
  | { type: 'question_retracted'; qid: string; reason: string }
  | { type: 'status_set'; text: string }
  | { type: 'summary_posted'; html: string; markdown: string; abstract: string }
  | { type: 'session_confirmed' }
  | { type: 'session_reopened'; note: string }
  | { type: 'note_added'; markdown: string };
export type Event = EventBody & { ts: string; actor: 'agent' | 'user'; cid?: string };  // cid: client action id, for replay dedup

// src/core/reduce.ts
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
export function reduce(events: Event[]): SessionState;
```

Rules the tests pin:

- `order` is depth-first: a question, then its children in posting order, then its next sibling.
- Status: `retracted` is final. Otherwise the later of the question's latest `question_resolved` and latest `response_marked` decides. If the resolution is later: `assumed` when `assumed: true`, else `settled`. If the response is later (or there is no resolution): `sent` when a `batch_sent` came after it, else `done`. Neither: `open`. A `response_cleared` removes an unsent response, returning the question to whatever it was before that response.
- A `response_marked` on a question that was already `sent`, `settled` or `assumed` sets `status: 'done'`, `isRevision: true`. This is how Reopen and the summary's "Change" work.
- The status says where a question is in the flow; what the user did is `response.kind`. The page's "Skipped" and "Invalid" labels come from `kind`, combined with `done` or `sent`.
- `isNew`: posted after the most recent `batch_sent`, and still `open`.
- `unsentCount`: questions with status `done`.
- `pendingWake`: a `batch_sent`, `session_confirmed` or `session_reopened` exists at an index ≥ the latest `updates_acked.through` (0 if none).
- `progress.total` excludes retracted; `sent` counts sent + settled + assumed; `totalAtLastBatch` is the total when the latest `batch_sent` happened.
- `phase`: `summary` after `summary_posted`, `confirmed` after `session_confirmed`, back to `active` after `session_reopened`, and also back to `active` after any `response_marked` or `questions_posted` that follows the summary (the summary is then stale; it stays stored until the agent posts a new one).
- Events naming an unknown `qid` are ignored.

- [ ] **Step 1:** Scaffold `package.json` (`"type": "module"`, scripts `build`, `test`, `typecheck`), strict `tsconfig.json`, `vitest.config.ts` (node environment by default, jsdom for `tests/web/**`), and `scripts/build.mjs` producing `dist/mcp.js`, `dist/cli.js` (platform node, bundle, format esm) and `dist/web/` (bundle `web/src/main.tsx`, copy `web/index.html`). Install dev dependencies.
- [ ] **Step 2: Write the failing tests** in `tests/core/reduce.test.ts`, using a helper `ev(body, actor='agent')` that stamps `ts`:

```ts
const base = [ev({type:'session_created',v:1,id:'rt-1',title:'T'}),
  ev({type:'questions_posted',questions:[{id:'Q1',title:'a',body:''},{id:'Q2',title:'b',body:''}]})];
test('orders follow-ups under their parent', () => {
  const s = reduce([...base, ev({type:'questions_posted',questions:[{id:'Q1a',parentId:'Q1',title:'c',body:''}]})]);
  expect(s.order).toEqual(['Q1','Q1a','Q2']); expect(s.questions.Q1.childIds).toEqual(['Q1a']); });
test('done then sent', () => {
  const marked = [...base, ev({type:'response_marked',qid:'Q1',response:{kind:'skip'}},'user')];
  expect(reduce(marked).questions.Q1.status).toBe('done'); expect(reduce(marked).unsentCount).toBe(1);
  const sent = reduce([...marked, ev({type:'batch_sent'},'user')]);
  expect(sent.questions.Q1.status).toBe('sent'); expect(sent.unsentCount).toBe(0); expect(sent.pendingWake).toBe(true); });
test('ack clears pendingWake', () => {
  const e = [...base, ev({type:'response_marked',qid:'Q1',response:{kind:'skip'}},'user'), ev({type:'batch_sent'},'user')];
  expect(reduce([...e, ev({type:'updates_acked',through:e.length})]).pendingWake).toBe(false); });
test('revision after send', () => { /* marked, sent, marked again -> status 'done', isRevision true */ });
test('revision of a resolved question', () => { /* resolved (assumed) then response_marked -> 'done', isRevision true, unsentCount 1;
  a later question_resolved -> 'settled' again */ });
test('clearing an unsent response', () => { /* open -> marked -> cleared -> 'open'; sent -> revised -> cleared -> 'sent' */ });
test('a revision after the summary returns the phase to active', () => {});
test('assumed, settled, retracted precedence and progress', () => { /* total excludes retracted; sent counts settled+assumed */ });
test('isNew only for questions posted after the latest batch', () => { /* Q3 posted after batch_sent -> isNew true; Q2 false */ });
test('phase transitions', () => { /* summary_posted -> 'summary'; confirmed -> 'confirmed'; reopened -> 'active', pendingWake true */ });
test('unknown qid is ignored', () => { /* response_marked for 'Q9' does not throw, changes nothing */ });
```

- [ ] **Step 3:** Run `npx vitest run tests/core/reduce.test.ts`. Expected: FAIL, `reduce` not found.
- [ ] **Step 4:** Implement `events.ts` and `reduce.ts` to the signatures and rules above.
- [ ] **Step 5:** Run the tests and `npm run typecheck`. Expected: PASS.
- [ ] **Step 6:** Commit: `feat: event model and state reducer`.

### Task 2: Log, store and registry

**Files:** Create `src/core/log.ts`, `src/core/store.ts`, `src/core/registry.ts`. Tests: `tests/core/log.test.ts`, `tests/core/store.test.ts`, `tests/core/registry.test.ts`.

**Interfaces — Consumes:** Task 1 types. **Produces:**

```ts
// log.ts
export function appendEvent(file: string, body: EventBody, actor: 'agent' | 'user', cid?: string): Promise<void>;
export function readEvents(file: string): Promise<Event[]>;       // skips lines that fail JSON.parse
// store.ts
export class SessionNotFound extends Error {}
export class UnsupportedVersion extends Error { constructor(public found: number) }
export type SessionSummary = { id: string; title: string; phase: SessionState['phase'];
  progress: Progress; updatedAt: string };
export function sessionFile(projectDir: string, id: string): string;  // <dir>/.rotisserie/sessions/<id>.jsonl
export function createSession(projectDir: string, o: { title: string; parentSessionId?: string }): Promise<string>;
export function loadSession(projectDir: string, id: string): Promise<SessionState>;
export function listSessions(projectDir: string): Promise<SessionSummary[]>;
export function append(projectDir: string, id: string, body: EventBody, actor: 'agent' | 'user', cid?: string): Promise<void>;
export function loadEvents(projectDir: string, id: string): Promise<Event[]>;   // raw log, for cid lookups and get_updates
export function readDrafts(projectDir: string, id: string): Promise<Record<string, unknown>>;
export function writeDraft(projectDir: string, id: string, qid: string, draft: unknown): Promise<void>;
// registry.ts
export function home(): string;                                   // ROTISSERIE_HOME ?? ~/.rotisserie
export function getToken(): Promise<string>;                      // creates config.json (mode 0600) on first call
export function registerProject(projectDir: string): Promise<string>;  // returns projectKey
export function listProjects(): Promise<{ key: string; dir: string; name: string }[]>;
export function readServerInfo(): Promise<{ host: string; port: number; pid: number } | null>;
export function writeServerInfo(i: { host: string; port: number; pid: number }): Promise<void>;
```

Decisions: session id is `rt-` + 4 random hex chars, regenerated on collision. `projectKey` is the first 8 hex chars of sha256 of the real path. Each project is its own file `projects/<key>.json` and every registry write is temp-file-then-rename, so concurrent MCP processes cannot corrupt it. Drafts live in `.rotisserie/drafts/<id>.json` (overwritten; only the host writes them). The token is 24 random bytes, base64url. `listProjects` leaves out a registered project whose folder no longer exists. `cid` is stored on the event when given.

- [ ] **Step 1: Write the failing tests** (each in a fresh temp dir, `ROTISSERIE_HOME` set to another):

```ts
test('append then read round-trips', async () => { /* 3 appends -> readEvents length 3, ts and actor set */ });
test('a corrupt line is skipped', async () => {
  await appendEvent(f, created, 'agent'); await fs.appendFile(f, '{"type":"quest'); await fs.appendFile(f, '\n');
  await appendEvent(f, posted, 'agent'); expect((await readEvents(f)).length).toBe(2); });
test('createSession writes a header and returns rt-xxxx', async () => {
  const id = await createSession(dir, {title:'T'}); expect(id).toMatch(/^rt-[0-9a-f]{4}$/);
  expect((await loadSession(dir, id)).title).toBe('T'); });
test('loadSession throws SessionNotFound / UnsupportedVersion', async () => { /* missing id; header with v: 2 */ });
test('listSessions returns every session with progress', async () => {});
test('project keys differ for same-named folders and survive awkward paths', async () => {
  const a = path.join(tmp, 'one', 'my app ü'), b = path.join(tmp, 'two', 'my app ü'); /* mkdir both */
  expect(await registerProject(a)).not.toBe(await registerProject(b));
  expect((await listProjects()).map(p => p.name)).toEqual(['my app ü', 'my app ü']); });
test('getToken is stable across calls', async () => {});
test('a cid passed to append is stored on the event', async () => {});
test('listProjects omits a project whose folder was deleted', async () => {});
```

- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement the three files.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: session log, store and registry`.

### Task 3: Search

**Files:** Create `src/core/search.ts`. Test: `tests/core/search.test.ts`.

**Interfaces — Produces:**

```ts
export type SearchHit = { sessionId: string; sessionTitle: string; kind: 'question' | 'note' | 'summary';
  qid?: string; title?: string; answer?: string; decision?: string; excerpt: string };
export function searchSessions(projectDir: string, o: { query: string; regex?: boolean; limit?: number }): Promise<SearchHit[]>;
```

Keyword mode: case-insensitive, every whitespace-separated word must appear in the item's combined text (title, body, answer text, note, decision). Regex mode: `new RegExp(query, 'i')`; an invalid pattern throws `Error('Invalid regular expression: …')`. `answer` is the option labels plus free text. Default `limit` 50.

- [ ] **Step 1: Failing tests:** keyword finds a question by a word in its answer and returns its decision; all words must match; regex `port\s+\d+` matches; an invalid regex rejects with the message above; notes and summary Markdown are searched; `limit` is honoured.
- [ ] **Step 2:** Run, FAIL. **Step 3:** Implement. **Step 4:** Run, PASS.
- [ ] **Step 5:** Commit: `feat: session search`.

### Task 4: The wait command

**Files:** Create `src/cli/wait.ts`, `src/cli/main.ts`. Test: `tests/cli/wait.test.ts`.

**Interfaces — Produces:**

```ts
export function waitForUpdates(projectDir: string, id: string,
  o?: { intervalMs?: number; signal?: AbortSignal }): Promise<'updates' | 'closed'>;
```

CLI: `node dist/cli.js wait <sessionId> [--dir <projectDir>] [--interval <ms>]`. `--dir` defaults to `process.cwd()`, interval to 1000. On `'updates'` print exactly `ROTISSERIE: updates ready for <id>. Call get_updates.` and exit 0. On `'closed'` (phase `confirmed` and nothing pending) print `ROTISSERIE: session <id> is closed.` and exit 0. Unknown session: message on stderr, exit 2. The loop reloads the session only when the log file's size has changed. No network calls anywhere in this file.

- [ ] **Step 1: Failing tests** (interval 10 ms): resolves `'updates'` immediately when a batch is already pending; stays pending until a `batch_sent` is appended, then resolves; does not resolve for agent-only events; resolves on `session_reopened`; resolves `'closed'` for a confirmed, acked session; rejects with `SessionNotFound` for a missing id.
- [ ] **Step 2:** Run, FAIL. **Step 3:** Implement. **Step 4:** Run, PASS.
- [ ] **Step 5:** Commit: `feat: wait command`.

### Task 5: MCP tools

**Files:** Create `src/mcp/tools.ts`, `src/mcp/main.ts`. Test: `tests/mcp/tools.test.ts`.

**Interfaces — Consumes:** Tasks 1–3, `sessionUrl` and `startHostLoop` from Task 7 (stub them until Task 7 lands). **Produces:** `createTools(projectDir: string): Record<string, { description: string; schema: ZodRawShape; handler(args): Promise<unknown> }>`.

| Tool | Arguments | Returns / effect |
|---|---|---|
| `start_session` | `title`, `parentSessionId?` | registers the project, creates the session; `{ sessionId, url, waitCommand }` |
| `post_questions` | `sessionId`, `questions: QuestionInput[]` | appends; error if an id already exists or a `parentId` is unknown |
| `get_updates` | `sessionId` | `{ responses: { qid, title, response, isRevision }[], confirmed: boolean, reopenNote?: string, openCount }`, then appends `updates_acked` with `through` = the number of events it read. `responses` holds each question whose current response was sent by a `batch_sent` at an index ≥ the previous ack; answers marked Done but not yet sent are never included |
| `resolve_question` | `sessionId`, `qid`, `decision`, `assumed?`, `reason?` | appends `question_resolved` |
| `retract_question` | `sessionId`, `qid`, `reason` | appends `question_retracted` |
| `set_status` | `sessionId`, `text` | appends `status_set` |
| `post_summary` | `sessionId`, `html`, `markdown`, `abstract` | error naming the offending ids while any question is `open`, `done` or `sent` (every question must be settled, assumed or retracted); else appends |
| `add_note` | `sessionId`, `markdown` | appends `note_added` |
| `list_sessions` | — | `SessionSummary[]` |
| `get_session` | `sessionId` | title, phase, notes, summary Markdown, and every question with its response and decision |
| `search_sessions` | `query`, `regex?`, `limit?` | `SearchHit[]` |

`waitCommand` is the exact string the agent should run in the background: `node "<abs path to dist/cli.js>" wait <sessionId> --dir "<projectDir>"`, with both paths written with forward slashes so the same string works in bash and in Windows shells. Tool descriptions must say when to call each tool; `get_updates` says "call after the wait command exits or when the user says they have responded". `main.ts` wires the tools to `McpServer` over `StdioServerTransport` with `projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd()` (swap the order if the Task 0 spike result says otherwise), then calls `startHostLoop()`. `start_session` awaits the host loop's `ready()` before building the URL. Nothing may write to stdout except the transport.

- [ ] **Step 1: Failing tests** against `createTools(tmpDir)` handlers: the full round trip (start, post, user events appended directly with `append`, `get_updates` returns them once and a second call returns none); duplicate question id rejected; unknown parent rejected; `post_summary` refused while a question is open and while one is sent but unresolved; an answer marked Done but not sent is absent from `get_updates`; `waitCommand` contains `--dir` and no backslash; `get_updates` after `session_reopened` returns `reopenNote`; `search_sessions` finds a posted question.
- [ ] **Step 2:** Run, FAIL. **Step 3:** Implement. **Step 4:** Run, PASS.
- [ ] **Step 5:** Commit: `feat: MCP tools`.

### Task 6: HTTP API, SSE and auth

**Files:** Create `src/server/http.ts`. Test: `tests/server/http.test.ts`.

**Interfaces — Consumes:** Tasks 1–2. **Produces:** `createApp(o: { webDir: string }): http.RequestListener` and this HTTP contract (all under the token rule below; `:pk` is the project key):

| Method and path | Body | Result |
|---|---|---|
| `GET /api/health` | — | `{ app: 'rotisserie', formatVersion: 1 }` (no token needed) |
| `GET /api/sessions` | — | `{ projects: { key, name, dir, sessions: SessionSummary[] }[] }` |
| `GET /api/sessions/:pk/:id` | — | `{ state: SessionState, drafts }`; 404 unknown; 409 `{ error: 'unsupported_version', found }` |
| `PUT /api/sessions/:pk/:id/drafts/:qid` | draft JSON | 204 |
| `PUT /api/sessions/:pk/:id/responses/:qid` | `UserResponse` | appends `response_marked`; 409 if the question is retracted or the session confirmed |
| `DELETE /api/sessions/:pk/:id/responses/:qid` | — | appends `response_cleared`; 409 if already sent |
| `POST /api/sessions/:pk/:id/respond` | — | appends `batch_sent`; 409 if `unsentCount` is 0 |
| `POST /api/sessions/:pk/:id/confirm` | — | appends `session_confirmed`; 409 unless phase is `summary` |
| `POST /api/sessions/:pk/:id/reopen` | `{ note }` | appends `session_reopened`; 400 if the note is empty |
| `GET /api/events` | — | SSE; `data: {"pk","id"}` whenever a session log changes, and `data: {"sessions":true}` when the session list changes |
| `GET /*` | — | static files from `webDir`; unknown paths serve `index.html` |

Replay dedup: every mutating request may carry an `x-rotisserie-cid` header (a client-generated UUID). The server passes it to `append` (Task 2), which stores it as `cid` on the event. If an event with that `cid` already exists in the session log, the request appends nothing and returns 200 `{ duplicate: true }`. A 409 response always has the body `{ error: <code>, message: <sentence for the user> }` with codes `retracted`, `confirmed`, `already_sent`, `nothing_unsent`, `not_in_summary`, `unsupported_version`.

Auth: a request carrying `?t=<token>` gets a `Set-Cookie: rt=<token>; HttpOnly; SameSite=Strict; Path=/`. Every `/api/*` route except health requires the cookie or an `x-rotisserie-token` header, else 401. Non-GET requests whose `Origin` header is present and does not match the request's `Host` get 403. Compare tokens with `crypto.timingSafeEqual`. Change detection: every 500 ms, list the session files of every registered project and compare names and sizes with the previous pass. A changed size emits `{pk,id}`; a new or missing file or project emits `{"sessions":true}`. Send an SSE comment line every 20 seconds as a keep-alive.

- [ ] **Step 1: Failing tests** (listen on port 0, real fetch): health is open; `/api/sessions` without a token is 401 and with the header is 200; a POST with a foreign `Origin` is 403 and appends nothing; the response → respond flow changes state as in Task 1; respond with nothing unsent is 409 with code `nothing_unsent`; the same PUT response sent twice with one `x-rotisserie-cid` appends exactly one event and the second returns `{ duplicate: true }`; reopen with an empty note is 400; a v2 log gives 409 `unsupported_version`; SSE emits `{pk,id}` within 1.5 s of an `append` made outside the server; an unknown path serves `index.html`.
- [ ] **Step 2:** Run, FAIL. **Step 3:** Implement. **Step 4:** Run, PASS.
- [ ] **Step 5:** Commit: `feat: web API with SSE and token auth`.

### Task 7: Host takeover and opening the browser

**Files:** Create `src/server/host.ts`, `src/server/open.ts`. Tests: `tests/server/host.test.ts`, `tests/server/open.test.ts`.

**Interfaces — Consumes:** `createApp` (Task 6), registry (Task 2). **Produces:**

```ts
export function startHostLoop(o?: { retryMs?: number }): { stop(): Promise<void>; isHost(): boolean;
  ready(): Promise<void> };   // resolves once this process is host, or is standby behind a live Rotisserie host
export function sessionUrl(pk: string, id: string): Promise<string>;   // http://<host>:<port>/s/<pk>/<id>?t=<token>
export function accessHints(env: NodeJS.ProcessEnv, port: number): string[];
export function openBrowser(url: string): Promise<boolean>;            // never throws
```

Behaviour: try to listen on `ROTISSERIE_HOST ?? '127.0.0.1'` and `ROTISSERIE_PORT ?? 4783`. On success, write server info to the registry and serve. On `EADDRINUSE`, GET `/api/health` on that port: if it answers as rotisserie, stay on standby and retry the bind on that same port every `retryMs` (default 1000, so takeover is within 2 seconds); if it is some other program, try the next port, up to 20 higher. A standby never moves to a different port than the host it found, so the page's address survives a takeover. `sessionUrl` reads the port from the registry's server info and uses `localhost` in the URL when the bind host is `127.0.0.1` or `0.0.0.0`. `accessHints`: when `SSH_CONNECTION` is set, return `ssh -L <port>:127.0.0.1:<port> <user>@<host>` built from `USER` and the server address in `SSH_CONNECTION`. `openBrowser`: `open` on macOS, `cmd /c start "" <url>` on Windows, on WSL (`WSL_DISTRO_NAME` set) `cmd.exe /c start "" <url>`, else `xdg-open`; spawn detached, ignore output, resolve `false` on any error. `start_session` (Task 5) calls `openBrowser` and includes the URL and hints in its result either way.

- [ ] **Step 1: Failing tests** (ephemeral ports via `ROTISSERIE_PORT`, `retryMs: 50`): the first loop becomes host and writes server info; a second loop is standby; after `stop()` on the first, the second is host within 500 ms and `/api/health` answers; a foreign server on the port makes the loop bind port+1; `sessionUrl` contains the registry port and the token; `accessHints` with `SSH_CONNECTION='10.0.0.5 50000 10.0.0.9 22'` and `USER='dev'` returns `['ssh -L 4783:127.0.0.1:4783 dev@10.0.0.9']`, and returns `[]` without it.
- [ ] **Step 2:** Run, FAIL. **Step 3:** Implement; replace the Task 5 stubs. **Step 4:** Run the whole suite, PASS.
- [ ] **Step 5:** Commit: `feat: shared host with takeover, browser open and access hints`.

### Task 8: Web shell, themes and sidebar

**Files:** Create `web/index.html`, `web/src/main.tsx`, `web/src/api.ts`, `web/src/theme.css`, `web/src/App.tsx`, `web/src/Sidebar.tsx`. Tests: `tests/web/sidebar.test.tsx`, `tests/web/theme.test.ts`.

**Interfaces — Consumes:** Task 6 HTTP contract, Task 1 types (import types only). **Produces:** `api` (`listSessions()`, `getSession(pk,id)`, `health()`, `subscribe(cb)`, and `send(pk, id, action)`, which maps each `Action` kind from Task 8a to its Task 6 request with the `x-rotisserie-cid` header; until Task 8a lands, type its argument as `unknown`), `<App/>` with routes `/` and `/s/:pk/:id`, and the CSS custom properties in `theme.css` that every later component uses.

Decisions: follow the light mockup (`Main.dc.html`) for layout and the dark mockup for the dark values. All colours are CSS variables on `:root`, redefined under `@media (prefers-color-scheme: dark)` guarded by `:root:not([data-theme="light"])` and again under `:root[data-theme="dark"]`. The header toggle sets `data-theme` and stores it in `localStorage` key `rt-theme` (wrapped in try/catch). Fonts: Space Grotesk (headings, 600), Inter (body, 400/500/600) and JetBrains Mono (ids, 400/500), as in the mockups, bundled locally: add the `@fontsource/space-grotesk`, `@fontsource/inter` and `@fontsource/jetbrains-mono` dev dependencies, have `scripts/build.mjs` copy only the Latin `woff2` files for those weights into `dist/web/fonts/`, and declare them with `@font-face` (`font-display: swap`) in `theme.css` with system-font fallbacks. Never load a font or anything else from another host. Sidebar: active sessions grouped by project with an open count and a mini meter; a collapsed "Past sessions (n)" block that, when expanded, is also grouped by project; a project filter (select: "All projects" plus each project) stored in `localStorage` key `rt-project`, preselected to the session's project when the page opens on `/s/:pk/:id`. A header button (`aria-label` "Hide sessions panel" / "Show sessions panel", `aria-expanded` set) folds the sidebar away and brings it back; the state is stored in `localStorage` key `rt-sidebar` (`"open"` or `"folded"`), the panel is always shown on `/` where there is no session, and while folded the header shows the current session's title so the user knows where they are. Below 800 px the sidebar becomes a session switcher in the top bar. The sidebar refetches on `{"sessions":true}` SSE messages.

Logo and favicon (user's choice; copy the paths exactly, or copy the two files from `docs/superpowers/specs/logo/`, which hold the same paths with the accent colour hard-coded). Both use `viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"`:

```html
<!-- web/assets/logo.svg, also inlined in the sidebar header: stroke-width="4" -->
<path d="M42 24a18 18 0 1 1-18-18c5 0 9.9 2 13.5 5.5L42 16"/><path d="M42 6v10H32"/>
<circle cx="24" cy="24" r="5" fill="currentColor" stroke="none"/>
<!-- web/assets/favicon.svg, linked from index.html as rel="icon": stroke-width="5" -->
<path d="M41 24a17 17 0 1 1-17-17c4.7 0 9.3 1.9 12.7 5.2L41 16.5"/><path d="M41 6.5v10H31"/>
<circle cx="24" cy="24" r="6" fill="currentColor" stroke="none"/>
```

The inlined logo takes the accent colour through `color`. A standalone SVG file has no page to inherit from, so `favicon.svg` hard-codes the light-theme accent in place of `currentColor`. `scripts/build.mjs` copies `web/assets/` to `dist/web/assets/`.

- [ ] **Step 1:** Invoke the `dataviz` skill and run its `scripts/validate_palette.js` on the state colours (sent, done-not-sent, assumed, invalid, open) for `--mode light` against the light surface and `--mode dark` against the dark surface, starting from the mockup values. Adjust until both pass; record the final values and the validator output in a comment at the top of `theme.css`.
- [ ] **Step 2: Failing tests:** sessions render under their project heading; confirmed sessions appear only inside "Past sessions", grouped by project, after it is expanded; choosing a project in the filter hides other projects' sessions and writes `rt-project`; opening `/s/pkB/…` preselects project B; the fold button hides the sidebar, writes `rt-sidebar`, and a second press brings it back; a folded sidebar is still shown on `/`; the theme toggle sets `data-theme="dark"` on `<html>` and persists; `theme.test.ts` asserts every variable defined for light is also defined in both dark blocks.
- [ ] **Step 3:** Run, FAIL. **Step 4:** Implement. **Step 5:** Run, PASS; `npm run build` produces `dist/web/index.html`.
- [ ] **Step 6:** Commit: `feat: web shell, themes and session sidebar`.

### Task 8a: Offline outbox

**Files:** Create `web/src/outbox.ts`; modify `web/src/api.ts`. Test: `tests/web/outbox.test.ts`.

**Interfaces — Consumes:** `api` (Task 8), Task 6 contract (`x-rotisserie-cid`, 409 codes), Task 1 types. **Produces:**

```ts
export type Action = { cid: string; at: string } & (
  | { kind: 'mark'; qid: string; response: UserResponse }
  | { kind: 'clear'; qid: string }
  | { kind: 'draft'; qid: string; draft: unknown }
  | { kind: 'respond' } | { kind: 'confirm' } | { kind: 'reopen'; note: string });
export type Rejected = { action: Action; code: string; message: string };
export function createOutbox(pk: string, id: string, deps: { send(a: Action): Promise<{ status: number; body: any }>; storage: Storage }): {  // send rejects on a network error
  enqueue(a: Omit<Action, 'cid' | 'at'>): void;      // writes to storage synchronously, then tries to flush
  flush(): Promise<void>;                             // in order; stops at the first network failure
  pending(): Action[]; rejected(): Rejected[]; dismissRejected(cid: string): void;
  online(): boolean; subscribe(cb: () => void): () => void };
export function applyPending(state: SessionState, pending: Action[]): SessionState;  // pure overlay
export type Cached = { state: SessionState; drafts: Record<string, unknown> };
export function loadCached(pk: string, id: string, storage: Storage): Cached | null;
export function saveCached(pk: string, id: string, c: Cached, storage: Storage): void;
```

Decisions: storage keys `rt-outbox-<pk>-<id>` (pending), `rt-rejected-<pk>-<id>`, `rt-state-<pk>-<id>` (last state and drafts from the server, with each `draft` action also applied to the cached drafts at enqueue time so a half-typed answer survives a reload). Every user action in Tasks 9 to 11 goes through `enqueue`, never straight to `api`; `api` keeps only the reads, the SSE subscription, and a `send(action)` that maps an `Action` to its Task 6 request. `flush` sends one action at a time with its `cid` in `x-rotisserie-cid`: a 2xx (including `duplicate: true`) removes it; a 409 or 404 moves it to rejected with the server's code and message and continues; a network error or 5xx sets `online() === false`, keeps the action, and stops. Consecutive `draft` actions for the same `qid` collapse to the latest. While offline, retry `GET /api/health` every 2 seconds, and on success flush and refetch. `applyPending` gives the view what it would look like once the queue lands: `mark` sets `status: 'done'` and the response, `clear` returns the question to `open`, `respond` turns every `done` question to `sent` and sets `unsentCount` to 0, `confirm` sets `phase: 'confirmed'`, `reopen` sets `phase: 'active'`; `progress` is recomputed to match. All storage access is wrapped in try/catch; if storage is unavailable the outbox works in memory and `SessionView` shows a one-line warning that answers are not being saved in this browser.

- [ ] **Step 1: Failing tests** (fake `send`, in-memory `Storage`): `enqueue` writes to storage before `send` resolves; three actions flush in order; a rejected `send` (network error) leaves all three pending, sets `online()` false, and a later `flush` delivers them in the original order with the same `cid`s; a new outbox created over the same storage (a page reload) still has the pending actions; a 409 `retracted` moves that action to `rejected()` and the next action is still sent; two `draft` actions for one `qid` leave one pending; `applyPending` with `mark` then `respond` yields status `sent` and `unsentCount` 0; storage that throws on `setItem` does not throw out of `enqueue`.
- [ ] **Step 2:** Run, FAIL. **Step 3:** Implement. **Step 4:** Run, PASS.
- [ ] **Step 5:** Commit: `feat: offline outbox backed by local storage`.

### Task 9: Session view and question cards

**Files:** Create `web/src/SessionView.tsx`, `web/src/QuestionCard.tsx`. Tests: `tests/web/session.test.tsx`, `tests/web/question.test.tsx`.

**Interfaces — Consumes:** `api` reads and theme tokens (Task 8), `createOutbox`, `applyPending`, `loadCached`, `saveCached` (Task 8a), Task 1 types. `SessionView` creates one outbox per session with `send = a => api.send(pk, id, a)` and `storage = localStorage`; tests inject a fake `send` and an in-memory storage. **Produces:** `<SessionView pk id/>`; `<QuestionCard question draft expanded onDone onSkip onInvalid onLater onEdit/>`; each card's root element has `data-qid` and `tabIndex={-1}`.

Decisions:

- Header: title, id, project dir, agent status strip (`agentStatus`, or "Agent is waiting for you" when `pendingWake` is false and questions are open, or "Agent is working through your N updates" when `pendingWake` is true).
- Progress meter: three segments (sent, done-not-sent, open) with 2 px gaps, the text "X of Y answered", and "total grew from A to B" when `total > totalAtLastBatch`. Legend with labels.
- Filters: All, Unanswered, New, Assumed by agent, each with a count.
- Card, expanded: id, title, body, recommendation with an "Accept" button (fills the answer with the recommendation text, or selects the recommended options), options as radios (`multi: false`) or checkboxes, a "Write my own answer" textarea, an optional note input, and the buttons Skip, Invalid question, Later, Done. Invalid asks for a reason (chips: wrong premise, already answered, out of scope, unclear) and an optional note before it folds.
- State labels: `open` "Open"; `done` "Done, not sent" (or "Skipped, not sent" / "Invalid, not sent" by `response.kind`); `sent` "Sent" (or "Skipped" / "Invalid"); `settled` "Settled"; `assumed` "Assumed by agent"; `retracted` "Retracted". A revision adds "revised".
- Card, folded: one row with state icon, id, title, a one-line form of the answer or decision, a state label, and Edit (state `done`) or Reopen (states `sent`, `settled`, `assumed`). Retracted: greyed, struck through, reason shown, no controls.
- Children render indented under their parent with a "New" badge while `isNew`.
- Fold animation: collapse height over 200 ms; none under `prefers-reduced-motion: reduce`.
- Drafts: enqueue a `draft` action 500 ms after the last keystroke; show "Draft saved".
- Later: kept in `localStorage` key `rt-later-<pk>-<id>`; the card folds with a "Later" label and stays counted as open.
- Respond bar: sticky bottom; "N updates ready to send" and a "Respond to agent" button, disabled when `unsentCount` is 0.
- Live updates: on an SSE message for this session, refetch and reconcile by `qid` with Preact keys. Text being edited lives in component state seeded once from the draft, so a refetch never overwrites it. After reconciling, if the focused card's `getBoundingClientRect().top` changed, adjust `window.scrollBy` by the difference.
- Offline: the view renders `applyPending(serverState ?? loadCached(…).state, outbox.pending())`, and calls `saveCached` after every successful fetch. While `outbox.online()` is false, show a banner: "The agent's session is closed. Your answers are saved in this browser and will be sent when it is back." The Respond button stays enabled and reads "Will send when the agent is back"; once queued, the bar says "Queued: N updates". Each `outbox.rejected()` entry shows on its card as "Not sent: <message>" with the user's text still visible and a Dismiss button.
- All question and answer text is rendered as text nodes. Never `dangerouslySetInnerHTML` outside Task 11's frame.

- [ ] **Step 1: Failing tests:**

```tsx
test('every state shows its label', () => { /* the eight labels from the State labels rule, incl. 'Invalid, not sent' for done + kind invalid */ });
test('Done marks the response and folds the card', async () => { /* type, click Done -> fake send received {kind:'mark',qid,response:{kind:'answer',optionIds:[],text}}, textarea gone */ });
test('single-choice uses radios, multi uses checkboxes', () => {});
test('Accept selects the recommended option', async () => {});
test('Skip sends {kind:"skip"}; Invalid requires a reason', async () => {});
test('Respond is disabled with nothing unsent and enabled with one', () => {});
test('progress text and growth note', () => { /* total 23, totalAtLastBatch 21 -> 'total grew from 21 to 23' */ });
test('a live update keeps focus, text and caret', async () => {
  /* focus Q4 textarea, type 'abc', set selectionStart=1; deliver SSE with a new child Q1a;
     expect activeElement to be the same textarea, value 'abc', selectionStart 1, and Q1a rendered after Q1 */ });
test('markup in titles, bodies and answers renders as text', () => {
  /* title '<img src=x onerror=alert(1)>' -> no <img> in the DOM, text present */ });
test('retracted question has no buttons', () => {});
test('offline: Done still folds the card, the banner shows, Respond queues', async () => {
  /* send rejects with a network error; type, Done -> card folded with 'Done, not sent'; banner text present;
     click Respond -> bar shows 'Queued: 1 updates'; then send succeeds + flush -> banner gone, status 'Sent' */ });
test('a rejected action stays visible on its card', () => { /* rejected {code:'retracted'} -> 'Not sent:' + message + the typed text */ });
```

- [ ] **Step 2:** Run, FAIL. **Step 3:** Implement. **Step 4:** Run, PASS.
- [ ] **Step 5:** Commit: `feat: session view and question cards`.

### Task 10: Keyboard

**Files:** Create `web/src/keyboard.ts`; modify `web/src/SessionView.tsx`, `web/src/QuestionCard.tsx`. Test: `tests/web/keyboard.test.tsx`.

**Interfaces — Consumes:** `data-qid` roots and card callbacks (Task 9). **Produces:** `nextOpen(order: string[], questions: Record<string, Question>, from: string): string | null` and `useSessionKeys(handlers)`.

The map (copy exactly; `Mod` is Ctrl, or Cmd on macOS):

| Key | Action |
|---|---|
| Mod+Enter | Done; fold; focus the next open question, unfolded, first input focused |
| Mod+Shift+Enter | Respond |
| Alt+ArrowDown / Alt+ArrowUp | next / previous question (works while typing) |
| j / k | next / previous question |
| n | next new question |
| 1–9 | pick or toggle that option |
| a | Accept |
| s, i, l | Skip, Invalid, Later |
| e or Enter | unfold the focused question |
| Escape | blur the text field, keep the card focused |
| ? | toggle the shortcut list |

Rules: keys without Mod or Alt are ignored while the event target is an input, textarea or select. `nextOpen` walks `order` forward from `from` and returns the first question with status `open` (wrapping is not done); when it returns `null`, focus the Respond button. j/k stop on every question, including answered and retracted ones. Buttons show their shortcut as a hint (`Done` shows "Ctrl+Enter", or "⌘↵" on macOS). The focused card has a visible focus ring. A live update never changes the focused question.

- [ ] **Step 1: Failing tests:** `nextOpen(['Q1','Q1a','Q2'], …, 'Q1')` returns `'Q1a'` when it is open and `'Q2'` when Q1a is retracted, and `null` after the last; Mod+Enter in a textarea marks Done and moves focus into the next open card's first input; after the last open question focus is on Respond; `s` typed inside a textarea inserts a character and does not skip; `s` on a focused card skips; `2` selects the second option; Alt+ArrowDown works from inside a textarea; `?` shows the list.
- [ ] **Step 2:** Run, FAIL. **Step 3:** Implement. **Step 4:** Run, PASS.
- [ ] **Step 5:** Commit: `feat: keyboard navigation`.

### Task 11: Summary and confirmation

**Files:** Create `web/src/Summary.tsx`; modify `web/src/SessionView.tsx`. Test: `tests/web/summary.test.tsx`.

**Interfaces — Consumes:** the session's outbox from `SessionView` (`confirm`, `reopen` and `mark` actions), `SessionState.summary`. **Produces:** `<Summary state outbox/>`, shown instead of the question list when `phase` is `summary` or `confirmed`, and `buildSummaryDoc(html: string, themeVars: Record<string,string>): string`.

Decisions: follow the `Summary.dc.html` mockup. The agent's HTML goes into `<iframe sandbox="" srcdoc=…>` (empty sandbox attribute: no scripts, no same-origin, no forms). `buildSummaryDoc` wraps it in a document whose head has `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">` and a `<style>` block defining the theme variables (`--rt-bg`, `--rt-text`, `--rt-muted`, `--rt-border`, `--rt-accent`, plus the state colours) and a base font. Rebuild `srcdoc` when the theme changes. A frame sandboxed this way cannot report its content height to the page, so give it a fixed height of `min(70vh, 720px)` with its own scrolling, and an "Expand" toggle that switches it to `90vh`. Below the frame: "Assumed by agent (n)" listing each assumed question with its decision, reason and a "Change" button. "Change" shows the question list again with that question unfolded; marking a new answer there is a revision, which (Task 1 rules) returns the phase to `active`, so the user sends it with Respond and the agent posts a fresh summary. Also below the frame: a required note textarea for "Not yet, keep grilling"; "Confirm shared understanding"; "Export Markdown" (downloads `summary.markdown` as `<id>-summary.md`). When `phase` is `confirmed`, everything is read-only and a "Closed" label replaces the buttons.

- [ ] **Step 1: Failing tests:** the iframe has `sandbox=""` and its `srcdoc` contains the CSP meta and the theme variables; `buildSummaryDoc('<script>x</script><svg></svg>', …)` keeps the input verbatim inside the body (the sandbox and CSP are the defence, not string filtering) and the CSP string matches exactly; assumed questions are listed with their reasons; "Not yet" with an empty note enqueues nothing, with a note it enqueues `{kind:'reopen',note}`; Confirm enqueues `{kind:'confirm'}`; "Change" on an assumed question shows that question unfolded in the list; the frame has the fixed height and Expand changes it; a confirmed session shows no action buttons.
- [ ] **Step 2:** Run, FAIL. **Step 3:** Implement. **Step 4:** Run, PASS.
- [ ] **Step 5:** Commit: `feat: summary and confirmation`.

### Task 12: Plugin packaging, skills and release checks

**Files:** Create `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `.mcp.json`, `skills/grill/SKILL.md`, `skills/grill-with-docs/SKILL.md`, `README.md`, `LICENSE` (MIT), `.github/workflows/ci.yml`, `tests/e2e/smoke.test.ts`; commit `dist/`.

- [ ] **Step 1:** Check the current Claude Code plugin documentation (use the `claude-code-guide` agent) for: the `plugin.json` fields, the plugin-level `.mcp.json` format with `${CLAUDE_PLUGIN_ROOT}`, and whether a plugin can declare a dependency on another plugin. Write the manifests accordingly: plugin name `rotisserie`, MCP server name `rotisserie`, command `node`, args `["${CLAUDE_PLUGIN_ROOT}/dist/mcp.js"]`. If dependencies can be declared, declare `mattpocock-skills`; either way keep the runtime check in the skills.
- [ ] **Step 2:** Write `skills/grill/SKILL.md` (`disable-model-invocation: true`, description "Grill me in the browser: a relentless interview with the questions managed in a live page."). Body, in this order: (1) call the Skill tool with `mattpocock-skills:grilling`; if it is not available, stop and tell the user to install the `mattpocock-skills` plugin from `mattpocock/skills`; (2) transport rules that replace printing rounds: call `start_session` once and show the user the URL and any access hints; post each round's frontier with `post_questions`, giving every question a recommendation, options where the choices are enumerable, and `parentId` for follow-ups numbered Q1a, Q1b; then run the returned `waitCommand` as a background shell command and end the turn without polling; (3) on wake, or when the user types anything, call `get_updates`, then for each response either `resolve_question`, or post follow-ups; (4) a skip means: investigate as deeply as possible (code, docs, `search_sessions`), decide, and `resolve_question` with `assumed: true` and the reason; (5) an invalid mark must be answered visibly with `retract_question`, a corrected follow-up, or a resolve that points to the earlier answer, and sibling questions built on the same premise must be rechecked; (6) retract questions that later answers make moot, always with a reason; (7) use `set_status` before long work; (8) when no questions remain, `post_summary` with HTML (inline SVG allowed, no scripts, no remote resources, colours from the `--rt-*` variables, following the `dataviz` skill for any chart), a Markdown twin and a one-paragraph abstract, then wait again; act only after `get_updates` reports `confirmed: true`; if instead it returns a `reopenNote` or revised answers, keep grilling and post a new summary afterwards; (9) whenever a conversation is resumed or restarted with a Rotisserie session still open (find it with `list_sessions`), call `get_updates` first, because the user may have answered while the harness was closed, then start the wait command again; (10) `add_note` for background worth keeping, and `search_sessions` before asking something that may already be decided.
- [ ] **Step 3:** Write `skills/grill-with-docs/SKILL.md`: the same, and also call the Skill tool with `mattpocock-skills:domain-modeling`.
- [ ] **Step 4:** Write `tests/e2e/smoke.test.ts`: build, spawn `dist/mcp.js`, drive it with the SDK's stdio client (`start_session`, `post_questions`), spawn `dist/cli.js wait`, fetch the session over HTTP with the token, PUT a response, POST respond; expect the wait process to exit 0 with the "updates ready" line and `get_updates` to return the response.
- [ ] **Step 5:** Write `ci.yml`: matrix `ubuntu-latest`, `macos-latest`, `windows-latest` on Node 20 and 22; run `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, and, on the Ubuntu and Node 22 job only, fail if `git diff --exit-code dist/` shows the committed bundle is stale.
- [ ] **Step 6:** Write `README.md`: what it is, the dependency and both install commands, usage, the environment variables, SSH and WSL notes, where sessions are stored and the commit-or-ignore choice, the keyboard map, and the Codex/Copilot portability note from the spec.
- [ ] **Step 7:** Run `npm test && npm run build`. Expected: all green, `dist/` updated. Commit: `feat: plugin packaging, skills and CI`.
- [ ] **Step 8:** Ask the user to run `claude --plugin-dir .` in a scratch project and invoke `/rotisserie:grill` on a small topic. Confirm with them: the page opens, a follow-up appears under its parent while they type elsewhere, Respond wakes the agent, and the summary confirms. Fix what fails before calling the work done.
