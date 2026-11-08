---
name: traspaso
description: Write the session handoff (.claude/HANDOFF.md) and update PROGRESS.md so another session with no memory can continue. Use when the user asks for a handoff / traspaso, or says they will /clear or switch task.
---

Write the handoff so another session with no memory can continue.

1. Your session mark is the `(whatnow-xxxxxxxx)` text whatnow left in the conversation context. The list of marks of the sessions open right now is in `.claude/whatnow-live.txt` (comma separated; if the file is missing or empty, treat the list as empty).
2. Write `.claude/HANDOFF.md` (in the current folder): goal, what we were doing and why, decisions made (and which ones the person made), files touched with their full path, what is left and the concrete next step.
3. Update `PROGRESS.md` (the one in the main project folder; from a `.claude/worktrees/<name>` copy, the parent project's). Read it again right before writing, other sessions may have edited it.
   - Keep your section `## This session [your mark]` (call it by the heading already used in the file, e.g. `## Esta sesión [mark]`): leave it with the next task and no steps done. Do not touch the sections of other sessions that are still open.
   - Sections of that kind whose mark is NOT in the live list belong to closed sessions (if the list is empty, touch none): read them, move into the project list what they left done or pending and still matters, then delete them.
   - Haiku, a small model, writes after every turn only in its own `## Haiku [mark]` section, about the session only; it can be wrong. The project list is yours: with what you really know and what Haiku left pending, update the project list and your section (tick what is really done, add what is worth it, decide what is the project's and what only the session's, discard what is false or you cannot tell). Then delete every `## Haiku [mark]` section, yours included.
   - Merge repeated tasks and remove what no longer applies.
4. Write all of it in the language of PROGRESS.md. Then tell the person they can /clear (or open another session) and the new one will read the handoff by itself.
