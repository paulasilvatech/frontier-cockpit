---
name: ms-identity-technical-doc
description: Generate enterprise technical documentation PDFs in the ms-identity identity (Microsoft 4-color logo, Inter + JetBrains Mono, MS+GitHub co-brand close). Use whenever the user wants a polished multi-page A4 technical PDF, developer guide, API reference, architecture document, runbook, SDK guide, integration playbook, or framework reference authored by Frontier Cockpit Team, Software Global Black Belt. Triggers include "create technical documentation", "build a developer guide", "make an API reference", "render architecture documentation", "produce a runbook PDF", "generate a ms-identity tech doc", or any request to convert Markdown, OpenAPI, README, ADRs, or design docs into a long-form technical PDF with cover, TOC, quickstart, architecture, reference, procedures, troubleshooting, glossary, and co-brand close. Use even without "ms-identity" mentioned. Sibling to ms-identity-editorial-brief; that one is for analyst/dashboard briefs, this one is for technical/developer/operations documentation.
---

# ms-identity technical documentation generator

This skill produces an enterprise-grade A4 portrait technical documentation PDF in the ms-identity identity. It is the technical sibling of ms-identity-editorial-brief: same Microsoft 4-color identity, same Inter + JetBrains Mono typography, same WeasyPrint Python conversion pipeline, but the page archetypes are tuned for documentation rather than analysis.

- **Typography**: Inter (300, 400, 500, 600, 700, 800) and JetBrains Mono only. No serif. Body 10.5pt, code blocks 8.5pt mono, inline code 9.5pt mono.
- **Palette**: Microsoft 4-color spec, red `#F25022`, green `#7FBA00`, blue `#00A4EF`, yellow `#FFB900`. Admonitions reuse the same palette by semantic role.
- **Code presentation**: monospace with optional filename header, optional line numbers, syntax-color tokens via inline spans. Code background is `#0E1116` (near-black) for visual contrast; inline code is light gray `#F0EEE9`.
- **Close page**: same as the editorial sibling, Microsoft + GitHub co-brand pair on a dark background, italic Inter quote, blue rule, "End of documentation" stamp.

The skill is opinionated about typography, palette, page chrome, and identity. The variable parts are the project name, the section content, the code, the diagrams, the API definitions.

## When to invoke

Use this skill whenever the user wants any of these:

- Convert a Markdown technical document into a polished PDF
- Render an architecture document, ADR collection, or design document as PDF
- Produce an API reference (endpoints, parameters, response codes, examples)
- Build a developer guide, integration guide, or SDK reference
- Create a runbook, operations manual, or incident playbook
- Generate framework documentation (component reference, configuration guide)
- Document a project end-to-end with quickstart, concepts, reference, troubleshooting

If the source material is data-heavy analysis (dashboard, performance review, analyst brief), use the sibling skill `ms-identity-editorial-brief` instead. This skill is for technical content: code, diagrams, procedures, references.

## Workflow

### Step 1, gather the source content

Read the source material completely. Extract:

- Project name, version, status (draft, beta, release)
- Target audience (developer, ops, architect, integrator)
- Document type (guide, reference, runbook, architecture)
- Section list with depth (chapter → section → subsection)
- Code examples, command snippets, configuration blocks
- Architecture diagrams (boxes, layers, sequences)
- Parameter tables, response codes, environment variables
- Step-by-step procedures
- Warnings, notes, tips that the source already calls out
- Glossary terms and cross-references

For Markdown sources, look at heading levels (h1 = chapter, h2 = section, h3 = subsection). For OpenAPI sources, parse `paths` for endpoints, `components.schemas` for type definitions. For ADR collections, treat each ADR as one chapter.

### Step 2, scaffold the build script

Copy `assets/starter_doc.py` to the output directory and rename it `_build_<project>.py`. Drop the CSS module, components module, and diagrams module alongside it. The starter contains:

- The CSS as a constant (`CSS`)
- The `ms_logo()` and `gh_logo()` helpers
- The technical components (`code_block`, `inline_code`, `admonition`, `file_tree`, `param_table`, `endpoint_block`, `step`, `terminal_block`, `glossary_entry`)
- The diagram helpers (`arch_layered`, `arch_sequence`, `arch_flow`)
- The page archetypes (`page_cover`, `page_masthead_toc`, `page_quickstart`, `page_concept`, `page_reference`, `page_procedure`, `page_troubleshooting`, `page_glossary`, `page_close`)

Edit the project metadata and the content. Leave the CSS and the archetype helpers untouched.

### Step 3, structure the chapters

Map source sections to chapters with this rhythm:

1. **Cover** (1 page): project name, version, document type, audience, status, Microsoft 4-color bar.
2. **Masthead + TOC** (1 page): document metadata block (version, audience, status, last updated, contributors), nested TOC with chapter and section page numbers.
3. **Quickstart** (1 to 2 pages): TL;DR paragraph, prerequisites checklist, 5-step "first run" procedure, hello-world code example.
4. **Concepts** (2 to 4 pages): one chapter per concept with explanation, optional architecture diagram, callouts for key ideas, examples in code blocks.
5. **Architecture** (1 to 3 pages): layered architecture diagram, component descriptions, sequence diagrams for important flows, sidebar with design decisions.
6. **Reference** (3 to 6 pages): API endpoints, parameter tables, response codes, environment variables, configuration files. One topic per page when dense.
7. **Procedures** (1 to 3 pages): numbered step-by-step instructions with code blocks per step, "verify" commands after each procedure.
8. **Troubleshooting** (1 to 2 pages): problem-symptom-solution triples, with warning/danger admonitions for destructive actions.
9. **Glossary** (1 page): term and definition pairs, alphabetically sorted.
10. **Close** (1 page): Microsoft + GitHub co-brand, italic quote (often a single principle or motto), blue rule, "End of documentation" stamp.

Total page count: 14 to 24 pages depending on the project. Short, focused references can be 14 to 16. Complete project documentation can run 20 to 24.

For the full archetype catalog with code examples, read `references/page-archetypes.md`.

### Step 4, code block discipline

Code blocks deserve special attention. The rules:

- Always use `code_block(language, code, filename=None, lineno=False)`. Never raw `<pre>`.
- For shell commands, use `terminal_block(commands, output)` which differentiates input from output visually.
- For long code (more than 30 lines), prefer splitting across two pages or extract to a sidebar example instead of a wall of code on one page.
- Inline code (variable names, file paths, function names) uses `inline_code()` which renders as light gray rounded pill, mono 9.5pt.
- Code blocks are dark `#0E1116` with off-white text; this contrast is intentional and identity-locked.

### Step 5, audit identity before exporting

Run the audit checklist in `references/identity-audit.md`. The checks are the same as the editorial sibling plus three tech-doc-specific gates:

- No syntax-highlighting library leak (no Prism CSS, no Highlight.js); all colors are inline spans
- Code blocks render as selectable text in the PDF (not as images)
- Admonitions use the Microsoft palette only (no purple, no magenta, no random accents)

Then walk `references/first-run-checklist.md` end to end before delivery. It is the final gate for source completeness, identity, local module readiness, output validation, WeasyPrint/PDF checks, and technical layout checks.

### Step 6, export PDF via Python (WeasyPrint)

Same pure-Python conversion as the editorial sibling. No browser, no print dialog.

```python
import weasyprint, pathlib
src = pathlib.Path("my_doc_print.html").resolve()
dst = pathlib.Path("my_doc.pdf").resolve()
weasyprint.HTML(filename=str(src)).write_pdf(target=str(dst))
```

WeasyPrint emits a vector PDF, A4 portrait, 595 by 842 points. Text is real text. Code blocks render as selectable text inside the PDF. Diagrams are SVG, infinite resolution.

### Step 7, visual audit at high DPI

Rasterize the PDF at 150 DPI and inspect every page. Tech-doc-specific things to look for:

- Code blocks fit page width without horizontal overflow (if not, shorten the lines or split the example)
- Long parameter tables paginate cleanly (no orphan header on its own line)
- Admonitions do not split across page boundaries (the colored left border should run the full height of the box)
- Architecture diagrams center properly and labels do not collide
- Terminal blocks distinguish input from output (input has `$ ` prefix, output is indented or color-distinguished)

### Step 8, deliver

Output the PDF + the print-version HTML to the user's outputs folder. Clean up the build script. Present the PDF as a `computer://` link.

## Filename conventions

```
{Project}_TechDoc_v{M}_{m}_{p}_{YYYY-MM-DD}_{locale}.pdf
{Project}_TechDoc_v{M}_{m}_{p}_{YYYY-MM-DD}_{locale}.html
{Project}_TechDoc_v{M}_{m}_{p}_{YYYY-MM-DD}_{locale}_print.html
```

Examples:
```
AgenticDevOps_TechDoc_v1_0_0_2026-05-25_en.pdf
GitHubCopilot_Integration_TechDoc_v2_1_0_2026-05-25_en.pdf
AIMaturityFramework_TechDoc_v3_0_0_2026-05-25_en.pdf
```

## What this skill produces, what it does not

This skill produces multi-page A4 portrait technical PDFs. It does not produce:

- Editorial/analyst briefs (use `ms-identity-editorial-brief`)
- Single-page art objects (use `canvas-design`)
- Slide decks (use `ms-identity` deck path or `ms-gamma-presenter`)
- Word documents (use `ms-docx-creator`)
- Interactive web docs (this is print/PDF, not web)

If the user wants any of those, route them. The sibling editorial-brief skill in particular is easy to confuse with this one; the distinction is **technical documentation vs editorial analysis**. Code, procedures, references, diagrams = this skill. Argument, evidence, callouts, dashboards = editorial sibling.

## Reference files

- `assets/starter_doc.py`: complete working Python build script, copy and edit
- `assets/template_css.py`: the CSS as a Python constant (used by the starter)
- `assets/components.py`: all the technical helpers (code blocks, admonitions, file trees, param tables, endpoints, steps, terminals, glossary)
- `assets/diagrams.py`: SVG architecture diagram renderers (layered, sequence, flow)
- `assets/requirements.txt`: WeasyPrint dependency for converting the generated `_print.html` to PDF
- `references/page-archetypes.md`: catalog of every page archetype with example markup
- `references/identity-audit.md`: pre-publish checklist (forbidden strings, palette, logo spec, code-block selectability)
- `references/first-run-checklist.md`: final gate before delivery, covering source completeness, identity, output validation, WeasyPrint/PDF checks, and technical-document-specific layout checks
