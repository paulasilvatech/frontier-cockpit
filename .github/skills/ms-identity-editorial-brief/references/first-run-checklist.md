# First-run checklist

Use this gate before delivering a ms-identity editorial brief PDF or its print HTML source. The starter Python script is the canonical build source.

## Source and thesis

- [ ] Source material was fully read: dashboard HTML, Markdown report, structured data, or analysis notes.
- [ ] The brief has a one-sentence thesis that drives the cover lede and close-page quote.
- [ ] Hero numbers and data tables are sourced, not retyped from memory.
- [ ] Every metric, customer claim, performance number, and recommendation is sourced or marked as an assumption.
- [ ] If the source has audited numbers, those numbers are preserved exactly.

## Build prerequisites

- [ ] `assets/starter_brief.py`, `assets/template_css.py`, `assets/components.py`, and `assets/charts.py` are copied together before running the starter.
- [ ] For PDF conversion, install WeasyPrint with `pip install -r assets/requirements.txt`.
- [ ] `python3 -m py_compile assets/*.py` passes.

## Identity and copy

- [ ] Frontier Cockpit Team, Software Global Black Belt, Microsoft identity is used throughout.
- [ ] Single contact is `frontier-cockpit@example.com`.
- [ ] Microsoft 4-color palette only.
- [ ] No em dashes or en dashes in the generated HTML/PDF.
- [ ] "GitHub Copilot" is written in full.
- [ ] No personal identity strings, personal social handles, or personal palette.
- [ ] No serif or personal-brand typography leaks: no Fraunces, Georgia, `font-serif`, Prism, or Highlight.js.

## Editorial-brief checks

- [ ] Cover has all four color stripes visible.
- [ ] Close page has all four Microsoft logo squares visible.
- [ ] Data strips and four-card rows do not overflow the page width.
- [ ] Tables fit their page, with no orphan header rows.
- [ ] Charts are SVG primitives and remain readable in print.
- [ ] Folios and runheads do not collide with content.

## Output validation

- [ ] The starter writes both `.html` and `_print.html` with UTF-8 encoding.
- [ ] Generated files exist and are non-empty.
- [ ] The identity checklist in `references/identity-audit.md` passes.
- [ ] The PDF opens, has no empty pages, and text is selectable.

## Delivery

- [ ] Deliver the PDF and the print HTML source.
- [ ] Keep the build script available for repeatable regeneration.
