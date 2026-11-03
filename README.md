# whatnow

[![Lic| `/whatnow en`, `/whatnow es`, `/whatnow auto` | change language (any `lang/<code>.json` works as `/whatnow <code>`) |se: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**A panel for Claude Code that answers "where am I?"** It shows how full the context is, how far along the curr| `/whatnow en`, `/whatnow es`, `/whatnow auto` | change language (any `lang/<code>.json` works as `/whatnow <code>`) |t session is, how far along the whole project is, and what is still left. When the context fills up, it asks Claude to write a handoff so you can continue in a fresh session.

> Early version (0.2). Works in t| `/whatnow en`, `/whatnow es`, `/whatnow auto` | change language (any `lang/<code>.json` works as `/whatnow <code>`) |ts; feedback from real sessions is welcome.

## What you see

```
Context ██░░░░ 33% · S| `/whatnow en`, `/whatnow es`, `/whatnow auto` | change language (any `lang/<code>.json` works as `/whatnow <code>`) |sion ████░░ 75% · Project ███░░░ 50%
```

- **Context**: tok| `/whatnow en`, `/whatnow es`, `/whatnow auto` | change language (any `lang/<code>.json` works as `/whatnow <code>`) |s used against a limit you choose (default 150k = 100%).
- **S| `/whatnow en`, `/whatnow es`, `/whatnow auto` | change language (any `lang/<code>.json` works as `/whatnow <code>`) |sion**: % of the checklist under `## This session` in `PROGRESS.md`.
- **Project**: % of the r| `/whatnow en`, `/whatnow es`, `/whatnow auto` | change language (any `lang/<code>.json` works as `/whatnow <code>`) |t of the checklist in `PROGRESS.md`.
- **Left**: the unchecked items of each list (side pane).

## Install

whatnow is a Claude Code mod. Copy this folder into your mods directory:

```bash
git clone https://github.com/facunicedev/whatnow.git ~/.claude/mods/whatnow
```

R| `/whatnow en`, `/whatnow es`, `/whatnow auto` | change language (any `lang/<code>.json` works as `/whatnow <code>`) |tart Claude Code. Check it with `claude plugin validate ~/.claude/mods/whatnow`.

## Usage

Keep a `PROGRESS.md` in your project with checkbox| `/whatnow en`, `/whatnow es`, `/whatnow auto` | change language (any `lang/<code>.json` works as `/whatnow <code>`) |:

```md
# My project
- [x] Done thing
- [ ] P| `/whatnow en`, `/whatnow es`, `/whatnow auto` | change language (any `lang/<code>.json` works as `/whatnow <code>`) |ding thing

## This s| `/whatnow en`, `/whatnow es`, `/whatnow auto` | change language (any `lang/<code>.json` works as `/whatnow <code>`) |sion
- [x] Step one
- [ ] Step two
```

| Command | What it do| `/whatnow en`, `/whatnow es`, `/whatnow auto` | change language (any `lang/<code>.json` works as `/whatnow <code>`) | |
|---|---|
| `/whatnow` | show or hide the panel |
| `/whatnow side` | put it in a side pane (falls back to the band if the window is narrow) |
| `/whatnow band` | one line above the prompt |
| `/whatnow limit 120k` | tok| `/whatnow en`, `/whatnow es`, `/whatnow auto` | change language (any `lang/<code>.json` works as `/whatnow <code>`) |s at which the handoff is requested |
| `/whatnow progr| `/whatnow en`, `/whatnow es`, `/whatnow auto` | change language (any `lang/<code>.json` works as `/whatnow <code>`) |s` | Claude updates `PROGRESS.md` now |
| `/whatnow handoff` | Claude writ| `/whatnow en`, `/whatnow es`, `/whatnow auto` | change language (any `lang/<code>.json` works as `/whatnow <code>`) | the handoff now |
| `/whatnow en`, `/whatnow es`, `/whatnow auto` | change language (any `lang/<code>.json` works as `/whatnow <code>`) |
| `/whatnow help` | list commands |

The handoff go| `/whatnow en`, `/whatnow es`, `/whatnow auto` | change language (any `lang/<code>.json` works as `/whatnow <code>`) | to `.claude/HANDOFF.md` and is offered to the next session you open in that folder. Tip: open Claude Code inside the project folder, not a parent folder, so these files land in the right place. Adding `PROGRESS.md` and `.claude/` to your `.gitignore` keeps them private.

## Languag| `/whatnow en`, `/whatnow es`, `/whatnow auto` | change language (any `lang/<code>.json` works as `/whatnow <code>`) |

English and Spanish included; `auto` follows Claude Code's language setting, th| `/whatnow en`, `/whatnow es`, `/whatnow auto` | change language (any `lang/<code>.json` works as `/whatnow <code>`) | your system language. To add one, copy `lang/en.json` to `lang/<code>.json` and translate it.

## Developm| `/whatnow en`, `/whatnow es`, `/whatnow auto` | change language (any `lang/<code>.json` works as `/whatnow <code>`) |t

```bash
claude plugin t| `/whatnow en`, `/whatnow es`, `/whatnow auto` | change language (any `lang/<code>.json` works as `/whatnow <code>`) |t .
claude plugin validate .
```

See [CONTRIBUTING.md](CONTRIBUTING.md). Lic| `/whatnow en`, `/whatnow es`, `/whatnow auto` | change language (any `lang/<code>.json` works as `/whatnow <code>`) |sed under [MIT](LICENSE).
