# Changelog

## [Unreleased]

## [0.4.1]
- New skill `/whatnow:ajustes`: a picker for panel position, handoff limit and language (any language by typing it). It leaves its choices in `whatnow-ajustes.json` (in the Claude home folder); the plugin applies them on the next tool call or turn and empties the file. The `/whatnow side|band|limit|<lang>` commands keep working.

## [0.4.0]
- Handoff and progress are skills now (`/whatnow:traspaso`, `/whatnow:progreso`): the engine refuses `prompt.submit` inside a command hook, so `/whatnow traspaso` failed. The command only points to the skills. The plugin writes the open sessions to `.claude/whatnow-live.txt` for the handoff skill. The automatic handoff at the context limit is unchanged.

## [0.3.10]
- Panel after /clear: the progress file and usage figures are reloaded at the first tool call, instead of showing "no PROGRESS.md yet" until the end of the first turn.

## [0.3.9]
- Session bar: Haiku now also records the work already done in the session as ticked steps (not only what is missing), so the bar shows real progress instead of staying at 0%. A done step may not copy a project step.

## [0.3.8]
- Haiku ticks steps when the work is reported done (even if untested), writes small single-action steps, and no longer leaves the session bar stuck at 0%.

## [0.3.7]
- Side panel: the "Parallel sessions" section sits below the whole section of this session (main session and its subagents) and lists only the other open sessions, each with its name, working/waiting, one sentence, bar and what is left. The list of open sessions that repeated this one is gone.
- `claude -w` sessions now read and write the single `PROGRESS.md` of the main folder (in their own section) instead of one in their copy.
- At the handoff, before deleting the section of a closed session, the model reads it and moves into the project list what it left done or pending.
- A session that has just opened (no mark in its conversation yet) no longer sees itself as a parallel session.
- Haiku now writes only in its own section `## Haiku [mark]` of `PROGRESS.md`, and only about its session (task line, steps it thinks are done, new steps); the panel counts them in the session bar. The project part is updated only by the session's model at the handoff, which merges what Haiku left and deletes every Haiku section. `.claude/haiku-changes.md` is gone.

## [0.3.6]
- Every session writes its own section in `PROGRESS.md` (`## This session [mark]`, the mark is the one the mod leaves in the conversation) and reads only that one. Two sessions in the same folder no longer share a task list; Haiku creates the section if it is missing. Fixes "no list / Left (0)" after a handoff.
- At each handoff the session removes the sections of sessions that are no longer open (the mod gives it the list of open ones; if it cannot read them all, nothing is deleted).
- Open sessions and subagents get a short name and one sentence of what they are doing (from their task line, or their last message if there is none).

## [0.3.5]
- Open sessions are seen from each session's own point of view: it is "this one (main)" and every other session is "parallel". A session finds out which one it is by a mark it leaves in the conversation (Claude Code does not tell mods its session id). The progress of the other sessions is read from each one's own folder.
- Haiku sees the last four messages instead of only the last one, ticks what is done or superseded, and does not repeat tasks. Everything it ticks or adds is logged in `.claude/haiku-changes.md`; at `/whatnow progress` and at every handoff the session's own model confirms or undoes those changes and empties the log.

## [0.3.4]
- The panel lists every session open in the project (several in the same folder, and `claude -w` ones even without a `PROGRESS.md`), with working/waiting state. It reads Claude Code's own session registry in `~/.claude/sessions`.

## [0.3.3]
- After `/clear` the side pane no longer shows internal label names (`USAGE5H`…) or a second band above the prompt: the panel refills its language and position by itself.

## [0.3.2]
- Haiku also ticks leftover items that the rest of `PROGRESS.md` already shows as done.

## [0.3.1]
- Installable as a normal plugin (`marketplace.json`): active in every project, updated with `claude plugin update`.

## [0.3.0]
- Side pane redesigned: context, 5-hour usage and weekly usage in three columns; titles in capitals, rules between sections, sentences start with a capital.
- Usage windows (5 hours and week) with colours on every percentage.
- Main session and each parallel session (`claude -w`) with its one-sentence `Task:` line and what is left.
- Running subagents listed in the pane.
- `PROGRESS.md` is kept up to date after each turn by a small model call (ticks, new items, `Status:` and `Task:`).
- Usage figures are requested directly, so they show before the first turn ends.

## [0.2.0]
- Panel with context use, session progress, project progress and the two "Left" lists.
- Band above the prompt (one line) or side pane (`/whatnow side`).
- Automatic handoff when the context fills up (`/whatnow handoff`).
- Languages: auto, `es`, `en`, or your own `lang/<code>.json`.
