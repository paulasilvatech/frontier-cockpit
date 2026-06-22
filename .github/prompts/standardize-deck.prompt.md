---
description: "Bring a ms-identity HTML deck up to the Specky gold standard: declarative slide engine, trilingual EN/PT-BR/ES i18n, full speaker notes, presenter view and overview, a clear storytelling arc, varied per-slide layouts, and at least one hand-built SVG diagram or animated simulation per major section. Validates against the two skill gates and never invents data. Use to audit or fix any deck under decks/, to standardize a deck that looks monotone or text-only, or to port a deck off a divergent engine."
agent: agent
argument-hint: "the deck file under decks/, for example GitHubCopilotHooksLifecycle_Deck_v2_1_0_2026-06-11_multi.html"
---

# Standardize Deck

Bring `${input:deck:the deck HTML file under decks/, for example GitHubCopilotHooksLifecycle_Deck_v2_1_0_2026-06-11_multi.html}` up to the gold standard set by the reference deck [../../decks/SpeckySpecDrivenDevelopment_Deck_v1_0_0_2026-06-01_multi.html](../../decks/SpeckySpecDrivenDevelopment_Deck_v1_0_0_2026-06-01_multi.html).

You are a senior presentation engineer working in the ms-identity Microsoft identity. Your job is to make the target deck match the reference on engine, storytelling, layout variety, and diagram richness, without inventing a single number.

## First step, always

Load the `ms-presentation-deck` and `ms-identity` skills and follow them. Apply the Microsoft identity: the 4-color palette (`#F25022` / `#7FBA00` / `#00A4EF` / `#FFB900` with 50/500/700 ramps), Inter for body and JetBrains Mono for data, author Frontier Cockpit Team, Software Global Black Belt, a single contact email, and no personal social handles. Then read the target deck in full before editing so you understand its real content, engine, and current arc.

## Reference standard (the Definition of Done, A to K)

A deck is in standard only when every criterion holds. Audit the target against all of them first.

- **A. Identity and head.** Inline Microsoft 4-color favicon as an SVG data URI (no external `favicon.svg`), Open Graph and Twitter meta including `og:locale`, an author meta, and a contact. No personal brand.
- **B. Declarative engine.** Slides are real `.slide` DOM sections with `data-active`, `slide--light` / `slide--dark` / `slide--paper`, and text driven by `data-i18n` keys. Slides are never stored as escaped HTML strings injected by script.
- **C. Chrome.** Progress bar, the 4-square brand mark, an EN / PT / ES `lang-switcher`, and the controls with a slide counter.
- **D. Trilingual i18n.** Complete EN, PT-BR, and ES bundles in a single `I18N` object, with no language leaking into another. A single language is acceptable only when the filename is explicitly `_en` (or another single-locale suffix).
- **E. Speaker notes.** One note per slide in every locale, in a `notes` object, using the markers `[OPENING]`, `[CORE]`, `[HOOK]` (or `[PROVOCATIVE HOOK]`), `[TRANSITION]`, and `[TIMING]`. See [../skills/ms-presentation-deck/references/speaker-notes.md](../skills/ms-presentation-deck/references/speaker-notes.md).
- **F. Presenter view.** `BroadcastChannel` sync plus an embedded `PRESENTER_HTML` window, with the `P` key and a presenter timer.
- **G. Overview mode.** A `buildOverview` grid toggled by the `O` key.
- **H. Storytelling arc.** Cover, agenda, numbered part dividers (dark), varied content slides, and a closing slide with contacts. One argument carried end to end, not a list of facts. See [../skills/ms-presentation-deck/references/deck-architecture.md](../skills/ms-presentation-deck/references/deck-architecture.md).
- **I. Layout variety.** At least six distinct slide archetypes across the deck, and no three consecutive content slides sharing the same archetype. Rotate the light, paper, and dark backgrounds.
- **J. Diagram richness.** At least one hand-built SVG diagram or animated simulation per major section, in the design-system style. This is the criterion most decks fail. Reuse the patterns in [../skills/ms-presentation-deck/references/patterns.md](../skills/ms-presentation-deck/references/patterns.md).
- **K. Didactic depth.** Where it fits the topic, include a worked example, a glossary, or a "first 10 minutes" slide so the audience can act.

## Workflow

1. **Audit.** Diff the target against A to K and write a short findings list naming each failing criterion with evidence (line numbers or missing structures). Confirm the two gates' current state before any edit.
2. **Port the engine if needed (criterion B).** If the deck stores slides as escaped HTML strings or otherwise diverges from the declarative engine, port it first: move slide bodies into real `.slide` sections with `data-i18n` keys, consolidate copy into one `I18N` object, and move notes into the standard `notes` structure. Reuse the reference deck's chrome, presenter view, and overview wiring verbatim where possible.
3. **Fill gaps smallest first.** In order: i18n completeness (D), then speaker notes (E), then the storytelling arc and layout variety (H, I), then diagrams (J), then didactic depth (K). Keep each edit focused.
4. **Add diagrams from existing content only (criterion J).** For each major section that has no visual, add one design-system SVG diagram or simulation that illustrates content already in the deck. Pick the archetype that fits the idea: sequence or flow for a process, a layered stack for an architecture, a decision tree for a choice, a loop or cycle for a feedback model, bars or a line for a quantity that the deck already states, a role or RACI grid for governance. Follow the SVG conventions below.
5. **Preserve every number.** Keep all figures identical to the source. For GitHub Copilot billing, usage, ROI, telemetry, or client figures, pull only from the audited source, official GitHub exports or APIs, or cited source documents. Never invent, estimate, or re-round a value to make a chart look fuller.
6. **Verify by rendering.** Run both gates, open the file from `file://`, and walk the criteria.

## SVG diagram conventions (criterion J)

- Tinted `-50` fills, `-500` strokes, and `-700` text from the Microsoft ramp. Color the containers and connectors, never recolor the brand mark.
- Multi-line labels use `tspan`, not wrapped text. Pre-measure every label against its container so nothing overflows or clips.
- Give each diagram a `viewBox` and `role="img"` with an `aria-label`. Keep animations behind `prefers-reduced-motion: no-preference` and make the diagram readable when motion is reduced.
- Keep all diagram text in `data-i18n` keys so it translates with the rest of the deck.
- No external chart libraries. Hand-build the SVG in the design-system style.

## Rules

- Write "GitHub Copilot", never the bare product name alone, in user-facing copy. No em dashes anywhere; use commas, parentheses, or restructure.
- Documentation is English. UI copy is trilingual EN / PT-BR / ES through the existing `t()` and `data-i18n` pattern. Never let one language leak into another.
- Do not modify audited numbers. Do not add a chart whose values you cannot trace to content already in the deck or to an audited source.
- Keep the file in `decks/`. When you supersede a version, move the previous file into `decks/archive/` per [../instructions/document-organization.instructions.md](../instructions/document-organization.instructions.md). Follow the repository conventions in [../copilot-instructions.md](../copilot-instructions.md).
- Reuse the reference deck's validated engine and chrome rather than rewriting them.

## Done when

- Both gates pass:
  - `python3 .github/skills/ms-identity/scripts/validate_html.py decks/${input:deck}`
  - `python3 .github/skills/ms-presentation-deck/scripts/audit.py decks/${input:deck}`
- Criteria A to K all hold, with at least one design-system SVG diagram or simulation per major section and no three consecutive content slides sharing an archetype.
- The deck opens from `file://` with zero console errors, and EN, PT-BR, ES, and the dark slides are verified on sampled slides.
- Every number traces to the source. Nothing was invented, estimated, or re-rounded.
- Any superseded version was archived, and the findings list from step 1 is fully resolved.

## Output

Output concisely: return only the deck path, validation status for both gates, archived superseded path(s) if any, and critical findings or blockers. Do not narrate the process steps.
