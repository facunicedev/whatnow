# Changelog

## [Unreleased]

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
