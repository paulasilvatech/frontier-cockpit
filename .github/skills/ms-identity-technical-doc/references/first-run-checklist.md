# First-run checklist

Use this gate before delivering a ms-identity technical documentation PDF or its print HTML source. The starter Python script is the canonical build source.

## Source and structure

- [ ] Source material was fully read: Markdown, OpenAPI, README, ADRs, runbook, design docs, or code references.
- [ ] The audience is explicit: developer, ops, architect, integrator, or mixed.
- [ ] The document type is explicit: guide, reference, runbook, architecture, SDK, or integration guide.
- [ ] The chapter rhythm follows the skill: cover, masthead and TOC, quickstart, concepts, architecture, reference, procedures, troubleshooting, glossary, close.
- [ ] Every metric, product limit, benchmark, and operational claim is sourced or marked as an assumption.

## Build prerequisites

- [ ] `assets/starter_doc.py`, `assets/template_css.py`, `assets/components.py`, and `assets/diagrams.py` are copied together before running the starter.
- [ ] For PDF conversion, install WeasyPrint with `pip install -r assets/requirements.txt`.
- [ ] `python3 -m py_compile assets/*.py` passes.

## Identity and copy

- [ ] Frontier Cockpit Team, Software Global Black Belt, Microsoft identity is used throughout.
- [ ] Single contact is `frontier-cockpit@example.com`.
- [ ] Microsoft 4-color palette only.
- [ ] No em dashes or en dashes in the generated HTML/PDF.
- [ ] "GitHub Copilot" is written in full.
- [ ] No personal identity strings, personal social handles, or personal palette.

## Technical-document checks

- [ ] Code blocks are selectable text, not images.
- [ ] No Prism, Highlight.js, or external syntax-highlighting library leaks.
- [ ] Long code blocks fit the page width or are split.
- [ ] Parameter tables paginate cleanly.
- [ ] Admonitions use only the Microsoft palette.
- [ ] Architecture diagrams are SVG and labels do not collide.

## Output validation

- [ ] The starter writes both `.html` and `_print.html` with UTF-8 encoding.
- [ ] Generated files exist and are non-empty.
- [ ] The identity checklist in `references/identity-audit.md` passes.
- [ ] The PDF opens, has no empty pages, and text is selectable.

## Delivery

- [ ] Deliver the PDF and the print HTML source.
- [ ] Keep the build script available for repeatable regeneration.
