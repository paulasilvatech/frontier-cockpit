---
name: ms-identity-editorial-brief
description: Generate enterprise editorial PDF briefs in the ms-identity identity (Microsoft 4-color logo, Inter + JetBrains Mono typography, GitHub co-brand close). Use whenever the user wants to turn a dashboard, report, analysis, performance review, or Markdown document into a polished multi-page A4 vector PDF brief authored by Frontier Cockpit Team, Software Global Black Belt. Triggers include "create editorial brief", "make a PDF brief", "turn this dashboard into a PDF", "build a Connect/performance/analyst report", "render a ms-identity document", "make an enterprise PDF report", "produce a Microsoft-branded long-form PDF", or any request to convert content into a structured editorial document with cover, table of contents, chapter pages, data tables, and a closing co-brand. Use this skill even when the user doesn't explicitly say "ms-identity" if they ask for a Frontier Cockpit Team report, a Microsoft GBB document, or a polished multi-page PDF from a source HTML/markdown.
---

# ms-identity editorial brief generator

This skill produces an enterprise-grade A4 portrait editorial PDF brief from any source content (HTML dashboard, Markdown analysis, structured data). The output follows the ms-identity identity exactly:

- **Typography**: Inter (weights 300, 400, 500, 600, 700, 800) and JetBrains Mono only. No serif, no Fraunces, no Georgia fallback.
- **Palette**: Microsoft 4-color official spec, red `#F25022`, green `#7FBA00`, blue `#00A4EF`, yellow `#FFB900`.
- **Logo**: Microsoft mark as inline SVG with viewBox 0 0 17 17, official color positions (red top-left, green top-right, blue bottom-left, yellow bottom-right) and 6-percent gaps.
- **Close page**: Microsoft + GitHub co-brand pair on a dark background, italic Inter quote, blue rule, "End of brief" stamp.
- **Conversion**: pure Python via WeasyPrint. No browser, no print dialog, no rasterization. Vector PDF.

The skill is opinionated about the layout, the rhythm, the typography, the color palette, and the close. Those should not be customized. The variable parts are the title, the deck, the chapters, the data, and the cohort-specific charts.

## When to invoke

Use this skill whenever the user wants any of these:

- Convert a dashboard HTML (the `window.DATA = {...}` style) into a polished editorial PDF
- Turn a Markdown analysis or report into a multi-page brief
- Produce a performance review document like Connect Final FY26
- Build a one-pager-style strategic narrative as a multi-page editorial PDF
- Generate an enterprise analyst report (cover, masthead, chapters, appendix, close)
- Re-render any of the existing briefs in this family (DevServices, Growth, Performance, Portfolio, ZeroToAgents, Top3Impacts, ConnectFinal)

Trust the user even when they say things like "make me a PDF from this" or "generate a brief" without naming ms-identity explicitly. If the audience is internal Microsoft / Frontier Cockpit Team / GBB and the content is long-form analysis or report, this skill applies.

## Workflow

### Step 1, gather the source content

Read the source file completely. Extract:

- Title and eyebrow (the small uppercase line that sits above the cover title)
- Hero numbers (3 to 4 standouts that go on the cover and the executive lede)
- Section list with one-line descriptions (becomes the TOC)
- Data tables (per-month, per-customer, per-cohort)
- Insights and callouts (becomes editorial callouts)
- Strategic takeaways / recommendations (becomes the closing chapter before the appendix)
- One-sentence thesis (becomes the cover lede and the close-page quote)

For data-rich source HTML, look for `const DATA = {...}` or `window.DATA = {...}` blocks. For Markdown sources, look for headings, tables, and bold standouts.

### Step 2, scaffold the build script

Copy `assets/starter_brief.py` to the output directory and rename it `_build_<topic>.py`. The starter contains:

- The CSS as a constant (`CSS = """..."""`)
- The `ms_logo()` and `gh_logo()` helpers
- The chart helpers (`chart_stacked`, `chart_line`, `chart_donut`, `chart_h_bar`, `chart_gap_pairs`)
- The page archetypes as functions (`page_cover`, `page_masthead_toc`, `page_executive_lede`, `page_chapter`, `page_chart`, `page_table`, `page_appendix`, `page_close`)

Edit the data constants and the chapter contents. Leave the CSS and the page-archetype helpers untouched.

### Step 3, write the editorial chapters

Map source sections to chapters with this rhythm:

1. **Cover** (1 page): dark background, eyebrow, big Inter 800 title with one italic yellow accent line, lede paragraph, issue line, author block, 4-color bar.
2. **Masthead + TOC** (1 page): editorial intro paragraph, full TOC with chapter numbers and one-line descriptions, sidebars for "How to read this brief" and "The thesis, in one line".
3. **Executive lede** (1 page, page-tinted background): the one-sentence thesis expanded into a 3-to-4 paragraph two-column body, a pull quote, a data strip of 3 to 4 cards.
4. **Chapters** (1 to 2 pages each, alternate plain and tinted backgrounds): each chapter opens with `Chapter N` kicker + serif-feel sans title + optional deck. Body uses callouts, chart cards, data tables, layered diagrams, or sidebars. Close with a "Reading the table/chart" sidebar.
5. **Appendix** (1 divider page + 1 to 3 table pages): the full dataset behind the brief, one table per page with a methodology sidebar.
6. **Close** (1 page, dark): Microsoft + GitHub co-brand pair centered, italic Inter quote, blue rule, "End of brief" stamp. No metadata, no skill leakage.

Total page count: 12 to 18 pages. Shorter is fine for focused topics (Top 3 Impacts, 12 pages). Longer is fine for data-heavy briefs (DevServices, 18 pages).

For the full archetype catalog with code, read `references/page-archetypes.md`.

### Step 4, audit identity before exporting

Before running WeasyPrint, run the identity audit checklist (see `references/identity-audit.md`). The audit checks:

- No Fraunces, no `font-serif`, no Georgia
- No em-dashes (`—`) or en-dashes (`–`)
- No forbidden identity strings (`AI-Native Software Engineer`, `@your-org`, `your-handle`, `linkedin.com`, `agenticdevops`)
- MS logo SVG uses the official position spec (red TL, green TR, blue BL, yellow BR)
- Microsoft palette `#F25022 / #7FBA00 / #00A4EF / #FFB900` only

If any audit fails, fix the source HTML and rebuild before exporting the PDF.

Then walk `references/first-run-checklist.md` end to end before delivery. It is the final gate for source completeness, identity, local module readiness, output validation, WeasyPrint/PDF checks, and editorial layout checks.

### Step 5, export PDF via Python (WeasyPrint)

Convert the HTML to PDF using the Python library WeasyPrint. The user might worry that "browser print" or "save as PDF" was used. It was not. WeasyPrint is a pure Python library that reads HTML and CSS and emits a vector PDF directly. No browser, no print dialog.

```python
import weasyprint, pathlib
src = pathlib.Path("brief_print.html").resolve()
dst = pathlib.Path("brief.pdf").resolve()
weasyprint.HTML(filename=str(src)).write_pdf(target=str(dst))
```

The output is a vector PDF, A4 portrait, 595 by 842 points. Text is real text (Inter embedded), logos are SVG paths, charts are SVG primitives. Resolution is infinite.

### Step 6, visual audit at high DPI

Rasterize the PDF at 150 DPI via `pdftoppm -png -r 150` and inspect every page. Look for:

- Logo alignment in the cover top (the SVG must sit on the same baseline as the "PAULA SILVA" text; add 10 to 14 pixels of gap if it looks tight)
- All 4 stripes of the cover bottom bar visible (red, green, blue, yellow; flex children need `display: block`)
- All four squares of the close-page logo present
- Tables fitting page width without column overflow
- Data strips of 4 cards not overflowing right margin (use 2.5 mm gap maximum)
- Folios and runheads not colliding with content
- No empty pages (TOC overflow is the usual culprit; tighten line height if it spills)

### Step 7, deliver

Output the PDF + the print-version HTML to the user's outputs folder. Clean up the build script. Present the PDF as a `computer://` link.

## Filename conventions

Follow this pattern:

```
{Topic}_Editorial_v{M}_{m}_{p}_{YYYY-MM-DD}_{locale}.pdf
{Topic}_Editorial_v{M}_{m}_{p}_{YYYY-MM-DD}_{locale}.html
{Topic}_Editorial_v{M}_{m}_{p}_{YYYY-MM-DD}_{locale}_print.html
```

Examples from the existing family:
```
FY26_DevServices_Editorial_v3_0_0_2026-05-25_en.pdf
FY26_Growth_Editorial_v1_0_0_2026-05-25_en.pdf
FY26_ConnectFinal_Editorial_v1_0_0_2026-05-25_en.pdf
```

The `_print.html` is the WeasyPrint-friendly source (no Chart.js, inline SVG charts). The plain `.html` mirrors it. Both stay in outputs alongside the PDF.

## What this skill produces, what it does not produce

This skill produces multi-page editorial PDFs. It does not produce:

- Single-page art objects (use `canvas-design`)
- Adobe Express template designs (use `adobe-design-from-template`)
- Slide decks (use `ms-identity` deck path or `ms-gamma-presenter`)
- Word documents (use `ms-docx-creator`)
- Single-page one-pagers in landscape (this skill is portrait, multi-page)

If the user wants any of those, route them to the correct tool. This skill is specifically the multi-page A4 portrait editorial format.

## Reference files

- `assets/starter_brief.py`: complete working Python build script, copy and edit
- `assets/template_css.py`: the CSS as a Python constant (used by the starter)
- `assets/components.py`: all the helpers (logos, runhead, folio, callouts, sidebars, paste boxes)
- `assets/charts.py`: SVG chart renderers (stacked bar, line, donut, horizontal bar, gap pairs)
- `assets/requirements.txt`: WeasyPrint dependency for converting the generated `_print.html` to PDF
- `references/page-archetypes.md`: catalog of every page archetype with example markup
- `references/identity-audit.md`: pre-publish checklist (forbidden strings, palette, logo spec)
- `references/first-run-checklist.md`: final gate before delivery, covering source completeness, identity, output validation, WeasyPrint/PDF checks, and editorial-brief-specific layout checks
