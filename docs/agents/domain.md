# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

Layout: **single-context**.

## Before exploring, read these

1. **`AGENTS.md` §3 « Vocabulaire »** — the canonical FR ↔ TCG term table (Planqué, Seuil, Stress, Café, Pression, Intervention…). This is the glossary for this repo.
2. **`docs/DECISIONS.md`** — dated decisions. Per `AGENTS.md` §2, this is the final authority when documents conflict.
3. **`docs/adr/`** — if it appears later, read the ADRs that touch the area you're about to work in.
4. **`GLOSSARY.md`** at the repo root — if it appears later, it complements §3 rather than replacing it.

If a file in steps 3–4 doesn't exist, **proceed silently**. Don't flag its absence; don't suggest creating it upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `AGENTS.md` §3. Don't drift to synonyms the glossary explicitly avoids.

Banned terms: `Galère`, `GalèreMon`, `Grèvomon`, `Pokémon` must never appear in `src/`, the UI or card data. `docs/` may cite « Pokémon TCG Pocket » as an external reference only. The collection is **le Parc** (renamed by D-026; « Galérodex » is the abandoned legacy name); « Galère » alone is always wrong.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Respect the decision log

`docs/DECISIONS.md` overrides all other documents, and ADRs in `docs/adr/` are its natural home once they exist. If your output contradicts an existing decision or ADR, surface it explicitly rather than silently overriding:

> _Contradicts D-004 (Changement de priorité), but worth reopening because…_

> _Contradicts ADR-0007 (event-sourced orders), but worth reopening because…_

Changing base rules, vocabulary or scope requires a **new dated decision**, not a doc edit.

## Never treat these as domain docs

`../grevomon-pocket/` is **legacy** (`AGENTS.md` §9). It may inform UI ideas or an inventory of the old APK, but it is never a source of truth for rules, vocabulary, content or percentages.
