# ms-identity technical documentation, page archetype catalog

Every page in a technical-doc PDF falls into one of these archetypes. Mix
and match across the document; combine archetypes within one page if the
content fits. Stay inside the archetype contracts to keep the family
cohesive.

## Page 1, cover (locked)

Dark `#0B0B0B`. Top chrome with Microsoft logo + author block + doc type and
date. Mid region with eyebrow, title, lede, version badge. Bottom chrome
with audience, last-updated, status on the left, author block on the right.
4-color Microsoft bar at the very bottom.

Use `page_cover()` from the starter. The title block is the only freely
variable region: pick a punchy 2 to 4 line title with one italic accent line
in yellow, then a single paragraph lede.

## Page 2, masthead + TOC (one page)

Top runhead, bottom folio. Document metadata grid (Project, Version,
Audience, Status, Last updated, Maintainer) followed by the nested TOC.

The TOC supports two levels: top-level chapter entries (full width) and
sub-section entries (indented, smaller). Use `li class="sub"` for the
indented sub-entries. Keep the total TOC entries under 20 to fit one page.

## Quickstart page (1 or 2 pages)

The first technical chapter. Goal: a developer copies and pastes their way
to a working "hello world" in five minutes.

Structure:
1. Section header with bar
2. Body paragraph explaining what the chapter does and what comes after
3. Admonition (`note()`) listing prerequisites in one paragraph
4. `h2()` "Prerequisites" followed by `body()` paragraph
5. `h2()` "Hello world" followed by `steps()` block with 3 to 5 steps
6. Closing `tip()` admonition for a common gotcha

Each step uses `step(title, body_html)` and counts auto-increment via CSS.
A step body can mix `body()`, `code_block()`, `terminal_block()`, and
inline admonitions.

## Architecture page (1 or 2 pages)

For overall system architecture or component diagrams.

Structure:
1. Section header (no bar, the diagram is the visual anchor)
2. Body paragraph framing the diagram
3. `diagram_card(title, subtitle, svg_body)` wrapping an `arch_layered()`,
   `arch_sequence()`, or `arch_flow()` SVG
4. `h3()` "Layer responsibilities" or "Components" with body paragraph
5. Sidebar explaining the design decision behind the architecture

For sequence diagrams, name actors clearly (Client, API, Worker, DB) and
keep messages under 8 per diagram. For flow diagrams, position nodes with
`x` and `y` in [0, 1] coordinates and let the helper place them.

## Concept page (1 to 4 pages)

For explaining how things work, the mental model behind a feature.

Structure:
1. Section header
2. Body paragraphs that build the model
3. `h2()` and `h3()` subheadings for sub-concepts
4. `code_block()` examples to illustrate concepts
5. `admonition()` to flag important consequences

Concept pages tend to be longer than reference pages. Aim for two pages per
concept if the mental model needs build-up; one page if it is a simple
clarification.

## Reference page (1 page per topic)

For API endpoints, parameter tables, response codes, environment variables.

Structure:
1. Section header
2. `h2()` per resource or topic
3. `endpoint(method, path, description)` for each HTTP endpoint, repeated
   as needed
4. `h2()` "Request parameters" followed by `param_table()` listing the
   parameters with name, type, required/optional, default, description
5. `warning()` or `important()` admonitions for non-obvious constraints

Parameter tables: aim for 10 rows or fewer per table. If you have 20
parameters, split into two tables grouped by purpose (e.g., "Required
parameters" and "Optional tuning parameters").

## Procedure page (1 or 2 pages per procedure)

For step-by-step operational tasks (deploy, rotate keys, migrate data).

Structure:
1. Section header
2. Optional `body()` paragraph framing when this procedure applies
3. `steps()` block with `step()` items
4. Each step has a title, a one-sentence explanation, optionally a code or
   terminal block
5. Closing verification step that confirms the procedure worked

The `steps()` block uses a CSS counter, so the numbers are automatic. Do
not hand-number steps in the title.

## Troubleshooting page (1 or 2 pages)

For known issues and how to fix them.

Structure per issue:
1. `h3()` with the problem statement (one short line)
2. `body()` with three parts in one paragraph: symptom, cause, solution
3. Optional `danger()` or `warning()` admonition for destructive steps

Group issues by topic if there are more than 8. Use `h2()` for the topic
group and `h3()` for each issue underneath.

## Glossary page (1 page)

For terms and acronyms.

Use `glossary(entries)` with a list of `(term, definition)` tuples. The
component sorts alphabetically and renders in two columns. Aim for 8 to 16
entries; more than 16 starts to feel cramped.

Definitions are one sentence each. If a definition needs more than one
sentence, the term probably deserves its own concept chapter.

## Close page (locked)

Same as the editorial sibling: dark `#0B0B0B` background, Microsoft mark
plus GitHub Octocat centered, "Microsoft + GitHub" mono label, italic Inter
quote, 30 mm blue rule, signature line.

For tech docs the signature reads `End of documentation · v1.0.0 · RELEASE`
(version + status) instead of `End of brief`.

## Page count guidance

| Doc type | Typical pages |
|---|---|
| Focused API reference (single resource) | 8 to 12 |
| SDK guide (multi-language, concept + reference) | 16 to 20 |
| Full project documentation (quickstart + architecture + reference + ops) | 18 to 24 |
| Runbook (procedures + troubleshooting) | 12 to 16 |
| Architecture document (ADRs + diagrams) | 14 to 18 |

Stay between 12 and 24 pages. Shorter than 12 reads as a one-pager; longer
than 24 reads as a book and the format starts to fight the content. Split
into multiple documents if needed.

## Mixing archetypes on one page

Quickstart pages often combine a section header + body + admonition +
steps + closing admonition. Reference pages often combine endpoints +
parameter table + warning. The archetypes are composable; mix freely as
long as the page does not feel cramped. If a page feels cramped, split.
