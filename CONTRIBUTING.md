# Contributing to whatnow

Thanks for helping! Bugs and ideas: open an issue with the templates. Code changes: open a PR.

## Setup

```bash
git clone https://github.com/facunicedev/whatnow.git
cd whatnow
claude plugin test .       # must pass
claude plugin validate .
```

All code lives in `hooks/register.tsx`; texts in `lang/*.json`.

## Adding a language

Copy `lang/en.json` to `lang/<code>.json` and translate the values (keep the keys and `{placeholders}`). Open a PR.

## PR rules

- One change per PR, explain *why*.
- Tests pass; update `CHANGELOG.md` under `[Unreleased]`.
- AI-assisted code is welcome if you reviewed and tested it.
