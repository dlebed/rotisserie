---
name: grill
description: "Grill me in the browser: a relentless interview with the questions managed in a live page. This skill should be used when the user runs /rotisserie:grill or asks to \"grill me in the browser\", \"run a grill-me interview on a web page\" or \"use Rotisserie\" to stress-test a plan or design."
disable-model-invocation: true
---

# Grill, in the browser

This skill runs a grill-me interview, but the questions go to a live web page instead of the terminal. The user answers there at their own pace, possibly hours later, and the agent waits without spending tokens. The interview rules themselves come from the `mattpocock-skills:grilling` skill. This skill only replaces how rounds are delivered and how answers come back.

The tools named below (`start_session`, `post_questions`, `get_updates`, and so on) come from the `rotisserie` MCP server of this plugin. The tool list shows them as `mcp__plugin_rotisserie_rotisserie__<name>`; this text uses the short names.

## 1. Load the interview rules first

Call the Skill tool with `mattpocock-skills:grilling` and follow it for everything about the interview itself: the design tree, frontiers, recommended answers, and when the interview is done. Where it says to print a round or to wait for the user's answers, the transport rules below take over.

If that skill is not available, stop. Do not improvise an interview. Tell the user to install the dependency with `/plugin install mattpocock-skills@claude-plugins-official` (it is published from `mattpocock/skills`) and to run this skill again. The real rules are needed, and a half-remembered copy would drift from them.

## 2. Open one session and post each round to it

1. First call `list_sessions`. If a session on the same topic is still open, continue it (section 5) instead of opening a duplicate, unless the user asked for a new one; two open sessions on one topic leave the user unsure which page to answer. Otherwise call `start_session` once, with a short title for the topic. It returns `sessionId`, `url`, `waitCommand` and `hints`. Reuse that `sessionId` for the whole interview, because one session is one page and one record.
2. Show the user the `url` and every line in `hints` (for an SSH session these include a ready-to-paste `ssh -L` command). The browser may not have opened, and the user cannot answer without the link.
3. Post each round's whole frontier with `post_questions`, in one call. Number the questions with ids `Q1`, `Q2`, and so on. Give a follow-up the id of its parent plus a letter (`Q1a`, `Q1b`) and set `parentId` to the parent's id, so the page nests it under that parent. Ids are case-sensitive (`q1` and `Q1` are two different questions) and must be new within the session: never reuse an id, not even a retracted one, or `post_questions` refuses the batch.
4. Give every question a `recommendation`, because the user can then accept it with one click. Where the choices can be listed, also give `options`, with a one-line `consequence` each and `recommended: true` on the recommended one. Set `multi: true` only when several options can be chosen together. Word the question so that accepting the recommendation is the natural "yes".
5. While a session is open, never ask the user a question in the terminal. Questions asked there are invisible to the page, are not tracked, and split the interview in two places. To get an answer, post a question.

## 3. Wait without spending tokens

1. After posting, run the exact `waitCommand` that `start_session` returned, using the Bash tool with `run_in_background: true`. It reads files only and sleeps between checks, so it costs nothing while the user thinks.
2. Then end the turn with one short line, such as "The questions are open at the link above; answer there and press Respond." Do not summarise the questions in the terminal.
3. Never poll, never sleep in a loop, and never run the wait command again in the foreground or repeatedly while it is still running. Polling burns tokens, and a second wait process does nothing useful. Start it again only after it has exited and `get_updates` has been called (section 4).
4. The wait command prints one of two lines when it exits:
   - `ROTISSERIE: updates ready for <id>. Call get_updates.` means the user pressed Respond or sent a confirmation. Call `get_updates`.
   - `ROTISSERIE: session <id> is closed.` means the session was confirmed and is finished. Do not start another wait. Call `get_updates`, and once it reports `confirmed: true`, carry on with whatever the confirmed summary says (section 6).
5. If the user types anything in the terminal during the wait, treat it as a cue to call `get_updates` too. It may be a nudge, or a sign they answered and the wake-up was missed. Answer what they typed, but fetch the updates first.

## 4. Handle what comes back

Call `get_updates` with the `sessionId`. It returns:

- `responses`: what the user has sent since the last call. Answers they marked Done but did not send are never included.
- `waitingOn`: the ids the user has not answered yet, including ones they set aside with Later. When it is not empty, a `note` repeats the rule below.
- `confirmed`, and sometimes a `reopenNote` (section 6).

### Who decides what

The server enforces these rules and refuses a call that breaks them, with a message that says what to do instead. Follow them from the start rather than discovering them by refusal.

| The user's response | What the agent may do |
|---|---|
| Answer | Record the decision their answer gives: `resolve_question` with `assumed` left false. If the answer is unclear or opens something new, post a follow-up. Never mark it assumed. |
| Skip | Decide it: `resolve_question` with `assumed: true` and a `reason`. Both are required. This is the only case where the agent decides. |
| Invalid | Do not decide it, even if their note says "you choose". Retract it with a reason, or post a corrected question, or point to where they already decided it. |
| Nothing sent yet (in `waitingOn`) | Wait. `resolve_question` is refused. Retract it only if another answer made it irrelevant. |

**A partial round is not a finished interview.** The user may send 5 answers out of 10 and come back for the rest hours later. The other 5 are still theirs: never resolve or assume them, and never post the summary around them. Handle what was sent, post any follow-ups, and wait again.

### Each response, by kind

1. **Answer.** If it settles the question, call `resolve_question` with the decision restated in plain words, so the page shows what was understood. If the answer opens new decisions, post follow-ups with `post_questions` (ids like `Q1a`, `parentId` set). A response with `isRevision: true` changes an earlier answer or replaces an assumed decision: re-resolve the question from what the user now said (not assumed), and recheck anything decided on top of the old one.
2. **Skip.** The user is delegating the decision. Investigate as deeply as possible before deciding: read the code and docs, and call `search_sessions` for earlier decisions. Then call `resolve_question` with `assumed: true`, the decision, and a `reason` that shows what was found. The page shows the decision and the reason in full, marked as assumed by the agent, and lists it again beside the summary for the user to review. A thin guess would waste that trust.
3. **Invalid.** The user is saying the question is wrong or not relevant, and gives a reason. That is not a Skip. Answer visibly, never silently, in one of three ways: call `retract_question` with a short reason; or retract it and post a corrected follow-up under it (the user can Skip that one to delegate the choice); or, if the user already decided it elsewhere, call `resolve_question` (not assumed) pointing to that decision. Then recheck the sibling questions that were built on the same premise, since they may be wrong for the same reason.
4. **Retracting.** If a later answer makes a still-open question moot, call `retract_question`. The reason is one short sentence the user will read on the page, and an empty one is refused. Retract only when the question no longer needs an answer, never to clear questions the user has simply not reached. A question must never vanish without a visible explanation.

### Around the responses

- Before long work (reading a big codebase, drafting the summary), call `set_status` with a short line such as "reading the repo". The page shows it in the status strip, so the user knows the agent has not stalled.
- After handling the responses, if questions remain open or new ones were posted, start the wait command again (section 3). Use the same `waitCommand` as before.
- Use `add_note` for background that is worth keeping but is not a question (a finding, a caveat, a follow-up for later). Notes stay in the session record for future agents.
- Before asking something that may already have been decided in an earlier session, call `search_sessions`. Asking again wastes the user's time.

## 5. Resuming

Whenever the conversation is resumed or restarted and a Rotisserie session may still be open (find it with `list_sessions`; use `get_session` to read one), call `get_updates` on it first, before anything else. The user may have answered while the harness was closed, and no wait command is running to report it. Then start the wait command again if the session is still open.

## 6. Finish with a summary the user confirms

1. When the frontier is empty, make sure every question is settled, assumed or retracted. `post_summary` refuses while any question is still open, done or sent, and its message names which are waiting for the user and which are yet to be resolved. If the user has not answered some, wait for them; do not decide those to get to the summary.
2. Call `post_summary` with three parts:
   - `html`: the summary as an HTML fragment. Inline SVG is allowed. No scripts and no remote resources (no external images, fonts, stylesheets or links to load), because the page renders it in a locked-down frame and the content is untrusted. Take every colour from the page's CSS variables, so the summary follows light and dark themes: `--rt-bg`, `--rt-text`, `--rt-muted`, `--rt-border`, `--rt-accent`, `--rt-sent`, `--rt-done`, `--rt-assumed`, `--rt-invalid`. Do not hard-code colours. The frame has a fixed height and scrolls, so lead with the decisions (a table of question and decision works well) and mark the assumed ones.
   - `markdown`: the same content as Markdown, the twin that is stored for search and export.
   - `abstract`: one paragraph that says what was decided.
3. Keep any chart honest. Use the `dataviz` skill if it is available. Either way: one axis, label values and series directly on the chart rather than in a legend, and never let colour alone carry meaning (add text or shapes), because some readers cannot tell the colours apart. Skip the chart if a table says it better.
4. Then wait again with the wait command, as in section 3.
5. Act on the interview only after `get_updates` reports `confirmed: true`. Until then the user has not agreed that they were understood. If `get_updates` instead returns a `reopenNote` or revised answers, the user said "not yet" or changed an assumed decision: keep grilling, handle the revisions, and post a new summary afterwards.
