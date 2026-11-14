# Rotisserie design

Date: 2026-11-10. Status: approved by the user on 2026-11-10. The keyboard map is provisional; the user will refine it after using the tool for a while.

Mockups: https://claude.ai/artifact/92RfaRsxVN836ukogQ4sDQ (private to the author). The mockup sources, the chosen logo and the palette are saved in this folder and described in `2026-11-10-rotisserie-visual-design.md`.

Items marked **(my call)** were decided by the agent writing this document, not by the user. Everything else was decided by the user during the grilling session.

## Intent

The `grill-me` family of skills (from `mattpocock-skills`) interviews the user in rounds of numbered questions in the terminal. A round can hold 20 to 30 questions, and answers spawn follow-ups (Q1a, Q1b). In a terminal it becomes hard to see which questions are still unanswered.

Rotisserie moves the question list into a live browser page. The agent posts questions, the user answers them at their own pace (possibly hours later), and the agent waits without spending tokens.

The name: a rotisserie turns the subject in front of steady heat, so every side gets examined. It keeps the fire metaphor of grill-me and stands for patient, all-round scrutiny.

## Goals

- Make a long, branching question list easy to track: what is answered, what is open, what is new.
- Let the user answer in any order and send answers in batches.
- Let the agent wait for hours at zero token cost.
- Keep every session on disk so it survives restarts and can be searched later by agents.
- Work on Linux, macOS and Windows (WSL at minimum), and in the default Claude Code sandbox with no extra setup.

## Non-goals for v1

- Remote or multi-user access with real authentication.
- Harnesses other than Claude Code. The core must stay portable to Codex and Copilot, the harnesses the upstream skills repo supports.
- Copying or rewriting the grilling rules. Rotisserie only changes how questions travel.
- Semantic or embedding search.
- A background daemon.

## Anti-goals

- The page must never move the user's focus, cursor, scroll position or typed text when the agent pushes updates.
- A question must never disappear or change without a visible reason.
- The agent must never burn tokens polling for answers.

## Parts

Rotisserie is a standalone Claude Code plugin with its own marketplace manifest. It contains:

1. **Skills.** `/rotisserie:grill` and `/rotisserie:grill-with-docs`.
2. **MCP server** (stdio). Tools for the agent. It also hosts the web server when it holds the port.
3. **Web UI.** A single-page app served by the web server.
4. **`wait` command.** A small CLI the agent runs as a background shell task.

Stack: Node.js and TypeScript. One bundled `dist/` is committed, so the plugin needs only `node` on the PATH, with no install step and no native dependencies. Frontend: Preact **(my call)**.

### Skills

`mattpocock-skills` is a required dependency. Nothing is copied from it.

- `/rotisserie:grill` invokes `mattpocock-skills:grilling` unchanged, then adds transport rules: post each round through the MCP tools instead of printing it, start the `wait` command in the background, and end the turn.
- `/rotisserie:grill-with-docs` does the same and also invokes `domain-modeling`.
- If the dependency is missing, the skill stops and shows the install command.
- The skill tells the agent to follow the `dataviz` skill, when available, for any chart or diagram in a summary.

Open check for the builder: whether Claude Code's `plugin.json` can declare a dependency on another plugin. No installed plugin on the author's machine does. If it cannot, the runtime check in the skill plus the README is the dependency mechanism.

### Storage

Files are the source of truth.

- Each session is an append-only event log: `.rotisserie/sessions/<id>.jsonl` in the project. One JSON event per line, written in a single append. Agents append questions; the web server appends the user's actions. Current state is derived by replaying the log. Nothing is overwritten, so revision history is kept and two processes cannot clobber each other.
- Every log starts with a header event carrying a format version. A host that meets a newer version shows "update Rotisserie to view this session" instead of rendering it.
- Storage is per project. The user chooses whether to commit `.rotisserie/` or ignore it.
- A registry in the user's home directory (`~/.rotisserie/`) lists projects with sessions and holds the shared URL token. **(my call)**
- Session IDs are short and readable, for example `rt-7f3a`. **(my call)**

### Shared web server

One web server on one port serves every project and every harness instance.

- The first MCP process to start binds the port and becomes the host. Other instances retry the bind about once a second, so one of them takes over within 2 seconds if the host exits. The browser reconnects by itself. Nothing is lost because state is on disk.
- The page is unavailable only while no harness is running.
- The web server reads and writes session files and pushes changes to the browser over Server-Sent Events. Agents never talk to it over the network.
- It binds to `127.0.0.1` by default. `ROTISSERIE_HOST` and `ROTISSERIE_PORT` override host and port. The default port is fixed, with fallback to the next free port. The exact number is the builder's choice.
- A secret token in the URL is always required. It is the only protection when the user binds to `0.0.0.0`.
- The web server lives in the MCP process because the harness starts that process outside the Bash sandbox, so binding a port and opening a browser are allowed there. **(my call, unverified; see First step)**
- Opening the browser: the MCP process tries to open the session URL and always returns it to the agent, which prints it. On WSL it opens through the Windows side. When an SSH session is detected, the agent also prints a ready-to-paste `ssh -L` command.

### Waiting

- After posting questions, the agent runs `rotisserie wait <session-id>` as a background shell task and ends its turn. No tokens are spent while it waits.
- The command polls the session log (about once a second) for a Respond event newer than the last one the agent acknowledged. It reads files only: no network, no port. That is what makes it safe in the default sandbox. **(my call, unverified; see First step)**
- When it finds one, it prints a short notice and exits. The harness then wakes the agent, which calls the MCP tool to fetch the batch.
- If a batch is already pending when the command starts, it exits at once.
- Fallback: if the user types anything in the terminal, the agent fetches pending updates.

### MCP tools

Names are indicative; the builder may adjust them.

| Tool | Purpose |
|---|---|
| `start_session` | Create a session (title, optional link to a parent session). Returns the ID and URL. |
| `post_questions` | Add questions or follow-ups (with a parent ID). |
| `get_updates` | Fetch the user's batches not yet acknowledged, and acknowledge them. Also lists the questions still waiting for the user. |
| `resolve_question` | Record the settled decision for a question the user responded to; "assumed by agent" with a reason only when they skipped it. |
| `retract_question` | Withdraw a question with a one-line reason. |
| `set_status` | Set the status-strip text ("thinking about 5 answers"). |
| `post_summary` | Push the final summary: sandboxed HTML plus a Markdown twin. |
| `add_note` | Append a timestamped Markdown note to a session. |
| `list_sessions`, `get_session` | Browse sessions in the current project. |
| `search_sessions` | Keyword or regular-expression search over questions, answers, decisions, notes and summaries. Returns matching questions with their final answer and session ID. |

## Question model

Questions form a tree. Follow-ups are children of the question they clarify and render nested under it.

A question carries: an ID (Q1, Q1a), a title, a body, the agent's recommended answer, and optionally a list of options. Each option has a label and an optional one-line consequence. The agent declares the question single-choice or multi-choice and may mark recommended options. The user can always write their own answer instead, and can add a free-text note to any choice.

User responses:

- **Answer**: an option, several options, or free text, plus an optional note. "Accept" takes the agent's recommendation in one click.
- **Skip** (the button label is just "Skip"): delegates the decision. The agent must dig as deep as it can (code, docs, past sessions) and make its best educated decision. That decision is marked "assumed by agent".
- **Invalid question**: with the user's explanation of why it is not relevant or valid. The agent must respond visibly: retract it, restate it as a corrected follow-up, or point to where it was already answered. It also rechecks sibling questions built on the same premise.
- **Decision rights, enforced by the server** (added after the first live trial). The agent decides a question itself only when the user skipped it, and then `resolve_question` requires `assumed: true` and a reason. For an answered question `assumed: true` is refused; for an Invalid one the agent retracts, re-asks or points to an existing decision, and may not assume. A question the user has not sent a response to cannot be resolved at all: sending part of a round does not delegate the rest. The agent may retract such a question only when another answer made it irrelevant, and `retract_question` refuses an empty reason. `get_updates` returns `waitingOn` (the unanswered ids) with a note saying the session is not finished.
- **Later**: parks the question locally. Nothing is sent.

States shown in the page: open, new, done (not sent), sent, settled, assumed by agent, invalid, retracted. Each state has an icon and a text label as well as a colour.

Rules:

- Each question has a **Done** button. Done folds the question closed with an animation: the card collapses smoothly into a one-line row that shows the question title and a short form of the answer. The same animation plays for Skip and Invalid. It is short (about 200 ms) and is replaced by an instant change when the system asks for reduced motion. **(duration and reduced-motion handling are my call)**
- After a question folds, focus moves to the next open question, which unfolds, with its first input focused. See Keyboard.
- A done answer stays freely editable until it is sent.
- After sending, **Reopen** attaches a revision that goes out in the next batch. History is not rewritten.
- The agent can retract a question. It is marked "retracted", disabled and greyed, and stays visible with the reason.
- The global **Respond** button sends all unsent updates as one batch. It is enabled as soon as there is at least one update of any kind.
- Drafts autosave as the user types.

## The page

See the mockups for layout. The look is **my call**: neutral grey surfaces, near-black primary actions, one ember-orange accent reserved for things that need attention, Space Grotesk headings, Inter body, monospace question IDs. The fonts are bundled with the plugin; the page loads nothing from any other host, so it works with no internet connection.

- **Logo**: a clockwise arrow circling a solid dot (the subject turning in front of the heat), chosen by the user from https://claude.ai/artifact/A3yBygYQ4VVm1yaH1WjFaX. Option P1 "Connected" is the logo; option P3 "Bold" is the favicon and any use at 16 px. Both are single-colour marks. The exact paths are in the plan.
- **Sidebar**: active sessions grouped by project, each with an open-question count and a mini progress bar. Below, a collapsed "Past sessions" block; when expanded, past sessions are also grouped by project and are read-only. In a narrow window the sidebar becomes a session switcher. The bare URL lands on this list. Each session has a direct URL.
- **Folding the sessions panel**: once a session is selected, the user can fold the sessions panel away to give the questions the full width, and bring it back at any time to switch sessions. A button in the header toggles it. The folded state is remembered in the browser. **(remembering is my call)**
- **Project filter**: the user can limit the sidebar to one project, hiding every other project's sessions to cut distraction. The choice is remembered in the browser, and opening a session's direct URL preselects its project. **(remembering and preselecting are my call)**
- **Header**: session title, ID, project path, and a status strip showing what the agent is doing.
- **Progress bar**: answered versus remaining, split into sent, done-not-sent and open. Follow-ups count, so the total can grow; the bar says so ("total grew from 21 to 23"). Retracted questions leave the total. **(counting rules are my call)**
- **Filters**: all, unanswered, new, assumed by agent.
- **Question list**: the tree, with answered and unanswered questions clearly different.
- **Respond bar**: pinned to the bottom, with a count of what will be sent.
- **Live updates**: new questions are inserted under their parent with a "new" badge and a counter. Nothing the user is looking at is reordered or scrolled, and focus and input are untouched.
- **Themes**: light and dark. The page follows the system setting on first load; a header toggle overrides it and is remembered in the browser. **(defaults are my call)**
- **Colour**: progress meters and state colours follow the `dataviz` skill and must pass its palette validator in both themes. The mockup colours are provisional and have not been validated.

## Keyboard

The user must be able to work through a whole session without the mouse.

Decided by the user: **Ctrl+Enter** (Cmd+Enter on macOS) means Done. The question folds and focus moves to the next one.

The rest of the map is **my call** and open to change:

| Key | Action |
|---|---|
| Ctrl/Cmd+Enter | Done: fold and move to the next open question |
| Ctrl/Cmd+Shift+Enter | Respond: send the batch |
| Alt+Down / Alt+Up | Next / previous question (works while typing) |
| J / K | Next / previous question |
| N | Jump to the next new question |
| 1 to 9 | Pick that option; again to deselect it |
| A | Accept the agent's recommendation |
| S, I, L | Skip, Invalid, Later |
| E or Enter | Unfold the focused question to edit it |
| Esc | Leave the text field, keeping the question focused |
| ? | Show the shortcut list |

Rules:

- Single-letter and number keys act only when focus is not in a text field, so typing an answer is never hijacked.
- "Next" follows the tree order as displayed: a question's follow-ups come before its next sibling. Retracted and already-answered questions are passed over by Done, but J/K stop on every question.
- After the last open question, focus lands on the Respond button.
- The focused question has a clearly visible focus ring, and buttons show their shortcut as a hint.
- A live update from the agent never changes which question is focused.

## When the harness is closed

Closing the harness stops the MCP process, and with it the web server (unless another harness instance takes over). An open page must keep working, and nothing the user enters may be lost.

- Every answer, selection, draft, Done, Skip, Invalid, Respond, Confirm and "Not yet" is written to the browser's local storage first, then sent to the server. Local storage is the safety net even when the server is up.
- While the server is unreachable, the page stays fully usable from the last state it loaded. Actions queue in local storage in order. A banner says the agent's session is closed and that answers are saved in this browser and will be sent when it is back. Respond stays available and reads "Will send when the agent is back".
- When the server returns (same harness session resumed, or any other instance hosting), the page reconnects by itself and replays the queue in order. Each queued action carries a unique id, and the server ignores an id it has already recorded, so a replay can never apply an answer twice.
- If the session changed while the page was offline (for example the agent retracted a question the user answered), the server rejects that one action. The page keeps the user's text visible, marks it "not sent", and says why. Nothing is silently dropped.
- The agent is not waiting after a restart, so the grill skill tells it to fetch pending updates whenever a session is resumed.

Limits **(my call)**: v1 keeps an already open tab working; it does not make the page loadable from scratch while no server is running (reloading the tab in that state shows the browser's connection error, but the saved answers are still in local storage and are sent once the page loads again). Local storage is tied to the page address, so the queue is only found again if the server comes back on the same host and port, which the fixed default port makes the normal case.

## Ending a session

1. When no questions remain, the agent pushes a summary.
2. The summary may be rich HTML with inline graphics such as SVG. It renders in a sandboxed frame with scripts and external requests blocked, because the agent writes it from material it does not control. The frame receives the theme colours. A Markdown twin is stored for search, export and other agents.
3. The page shows the summary, with decisions "assumed by agent" pulled out for review.
4. **Confirm shared understanding** ends the session and makes it read-only. **Not yet** requires a note, reopens the session and wakes the agent. Both wake the agent like any Respond.
5. Changing an assumed decision from the summary screen is a revision: it goes back to the agent with the next Respond, and the agent posts a fresh summary before the session can be confirmed. **(my call)**
6. The summary can be exported as Markdown. A confirmed session can spawn a linked follow-up session.

## Memory

- Agents can append notes to any session as background for themselves or other agents. Notes are timestamped Markdown and append-only.
- The agent writes a one-paragraph summary when a session closes.
- Agents can list, read and search past sessions in the current project through MCP.

## Portability

The MCP server is a standard stdio server and the skills are plain `SKILL.md` files. Only the plugin packaging and the background-wait mechanism are specific to Claude Code. A port to Codex or Copilot needs new packaging and that harness's equivalent of a background task.

## First step for the builder

Two design calls rest on assumptions about the Claude Code sandbox that have not been tested. Prove them with a throwaway spike before building anything else:

1. An MCP server started by a plugin can bind a local port and open a browser while Bash commands are sandboxed.
2. A background Bash task can run for hours, read files under the project's `.rotisserie/`, and wake the agent when it exits.

If either fails, stop and return to the user with alternatives.

## Left to the builder

- Exact event and tool schemas.
- Default port number.
- Frontend build tooling and test approach.
- The fold animation and other motion details.
- How the browser is opened on each platform.

## Spike result

Recorded 2026-11-11. The interactive spike (a throwaway plugin whose tool binds the port, writes a file and opens the browser from inside a real Claude Code session) has **not been run by the user yet**; `spike/` is kept, git-ignored, until it is. What is known instead:

- **MCP server outside the sandbox: documented.** The Claude Code sandboxing documentation says the sandbox applies to Bash tool commands, and that local MCP servers run with the user's full access. So the server may bind its port and open the browser. Not yet observed in a live session.
- **Project folder: documented.** `CLAUDE_PROJECT_DIR` is exported to plugin MCP server processes; the working directory is not documented. The server uses `CLAUDE_PROJECT_DIR` and falls back to the working directory.
- **Built server end to end: verified.** `tests/e2e/smoke.test.ts` starts the built `dist/mcp.js`, opens a session, runs the built `wait` command, answers over HTTP, and sees the wait exit with the "updates ready" line. A seeded session was also opened in Chrome and checked by eye in both themes.
- **Wake-up of the agent when a background command exits: observed, not documented.** It worked for every background task during the build of this project (minutes to tens of minutes). The documentation states no time limit for background commands in interactive sessions and 30 minutes by default in unattended ones. A wait lasting hours is untested; the fallback is typing anything in the terminal.
- **Sandboxed Bash cannot bind ports or write to `.git`** on macOS by default, which affects only development of this plugin (its server tests), not its use.
