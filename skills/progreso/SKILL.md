---
name: progreso
description: Update PROGRESS.md now with the real state of the project and of this session (feeds the whatnow panel). Use when the user asks to update the progress file, or the panel shows stale or missing progress.
---

Update `PROGRESS.md` right now (the one in the main project folder; from a `.claude/worktrees/<name>` copy, the parent project's). Create it if missing. Read it again right before writing, other sessions may have edited it.

Format: `# <goal in one line>`, `Estado: <one sentence>` (use the labels already in the file), the project task list (`- [x]` / `- [ ]`), and your own section `## This session [mark]` (use the heading already in the file, e.g. `## Esta sesión [mark]`) with a `Tarea:` line of one sentence and its steps. Your mark is the `(whatnow-xxxxxxxx)` text whatnow left in the conversation context. Do not touch other sessions' sections.

Haiku, a small model, writes after every turn only in its own `## Haiku [mark]` section, about the session only; it can be wrong. The project list is yours: with what you really know and what Haiku left pending, update the project list and your section (tick what is really done, add what is worth it, decide what is the project's and what only the session's, discard what is false or you cannot tell). Then delete every `## Haiku [mark]` section, yours included. Merge repeated tasks and remove what no longer applies.

Write it in the language of the file. Finish with one line saying what you changed.
