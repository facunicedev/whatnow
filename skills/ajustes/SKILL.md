---
name: ajustes
description: Change whatnow settings with a picker - panel position (side or above the prompt), handoff token limit, and language. Use when the user wants to move the panel, change the limit, or change the language of whatnow.
---

Ask the person with ONE AskUserQuestion call and these three questions (each with a "Don't change" option; the automatic "Other" lets them type their own value):

1. Panel position: "Side" / "Above the prompt" / "Don't change".
2. Handoff limit (tokens at which whatnow asks for the handoff): "100k" / "120k" / "Don't change"; Other = they type a number (20k to 1000k).
3. Language: "Español" / "English" / "Don't change"; Other = they type any language name; turn it into its ISO 639-1 code (fr, de, pt...).

Then write `whatnow-ajustes.json` inside the `.claude` folder of the user's home directory (e.g. `C:\Users\<name>\.claude\whatnow-ajustes.json`; the whatnow plugin reads it on the next tool call or turn, applies it and empties the file). Include only what changed:

```json
{ "position": "lateral" | "band", "limit": 120000, "lang": "es" }
```

`limit` is a number of tokens. If nothing changed, write nothing. Finish with one line saying what you set.
