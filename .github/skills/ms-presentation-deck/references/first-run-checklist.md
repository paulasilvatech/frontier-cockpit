# First-run checklist

The single gate that makes a deck correct on the first execution. Walk every item before presenting the HTML, and the format-specific block before presenting any derivative. If an item fails, fix it and re-check, do not deliver.

This checklist is the contract behind "the deck is right the first time". The audit script (`scripts/audit.py`) covers the mechanical items automatically; the rest need a human-style read.

## 0. Before writing any HTML

- [ ] The source content exists and is sufficient. If the user gave only a topic, the slide plan is drafted first, not invented at write time.
- [ ] Every metric, KPI, price, and quote has a source, or is clearly framed as an assumption. Never fabricate numbers. For GitHub Copilot UBB figures, pull from the audited source, never invent.
- [ ] The slide plan passed `references/slide-quality.md`: each slide has a role, pattern, density, anchor, and next move; no layout repeats three times in a row; a visual reset lands every 4 to 6 slides.
- [ ] The pattern choices come from `assets/showcase.html`, not ad hoc layouts.

## 1. Structure and i18n

- [ ] The deck builds on the architecture in `references/deck-architecture.md` (viewport 1280x720, slide system, locale switcher, presenter view).
- [ ] All three locales are present: `en`, `pt-BR`, `es`. No locale is missing keys.
- [ ] No language leaks: the EN view has no Portuguese or Spanish strings, and so on for each locale.
- [ ] No I18N dot-notation conflict (never both `cover.title` as a string and `cover.title.line1` as a nested key).

## 2. Speaker notes

- [ ] Every slide has speaker notes in all three locales, following `references/speaker-notes.md` (`[ABERTURA]`, `[NUCLEO]`, `[GANCHO PROVOCATIVO]`, `[TRANSICAO]`, `[TIMING]`).
- [ ] Notes are substantive, not one-liners. They are the heart of the deliverable.

## 3. Head block and social preview

- [ ] The inline Microsoft favicon from `references/head-meta.md` is present (never an external `favicon.svg`).
- [ ] Open Graph and Twitter meta are present, with `og:locale` and a `previews/<deck-base>-preview-<locale>.png` per language.
- [ ] If publishing, the preview files actually exist under `decks/previews/` (run the audit with `--check-assets`).

## 4. Identity rules (non-negotiable)

- [ ] No em dashes anywhere. Use commas, periods, colons, or " · ".
- [ ] "GitHub Copilot" is always the full name, never abbreviated.
- [ ] "Software Global Black Belt" with no region suffix.
- [ ] `frontier-cockpit@example.com` is the only contact email.
- [ ] Microsoft palette only (`#F25022`, `#7FBA00`, `#FFB900`, `#00A4EF`); Inter and JetBrains Mono fonts.
- [ ] Author name "Frontier Cockpit Team" and the 4-square logo header on every slide.
- [ ] No forbidden strings (`@your-org`, `your-handle`, `Microsoft Americas`, `Frontier Cockpit`, `Microsoft Global Black Belt`).

## 5. Mechanical audit and render

- [ ] `python3 scripts/audit.py deck.html --check-assets` exits 0 with no errors.
- [ ] The HTML opens and renders with zero console errors.
- [ ] The language switcher works for all three locales, and the presenter view (F) plus notes panel (N) work.

## 6. Delivery

- [ ] The file follows the English naming pattern `<EnglishTopicCamelCase>_Deck_v<major>_<minor>_<patch>_<YYYY-MM-DD>_multi.html`.
- [ ] Preview images live under `decks/previews/`, and deck-only support images live under `decks/assets/`.
- [ ] Deck PDF derivatives live under `decks/pdf/<DeckBase>/`.
- [ ] Deck PPTX derivatives live under `decks/pptx/<DeckBase>/`.
- [ ] The file is written to the workspace `output/` folder and surfaced to the user.
- [ ] Only the multi HTML is delivered by default. Derivatives are mentioned in one line, not generated.

## Derivative-specific checks (only when explicitly requested)

### Public HTML (`make_public.py`)

- [ ] Generated for the requested locale only.
- [ ] Notes panel, presenter view, and N/F/P handlers are removed; inline favicon and social meta remain.
- [ ] `audit.py` re-ran on the public output and exited 0.

### PDF (`make_pdf.py`)

- [ ] Dependencies present (Playwright, Chromium, pypdf). The script preflights and reports exact install steps if not.
- [ ] `reduced_motion='no-preference'` was used so animated slides do not render blank.
- [ ] The output PDF exists, is non-empty, and the page count equals the slide count.
- [ ] The PDF is saved under `decks/pdf/<DeckBase>/` with the same English deck base name and locale suffix.
- [ ] `python3 scripts/validate_derivatives.py --html <deck>.html --locale <locale> --pdf decks/pdf/<DeckBase>/<DeckBase>_<locale>.pdf` exits 0.

### PPTX (`make_pptx.js`)

- [ ] A native editable PPTX generator was used. The bare template was not run as-is.
- [ ] The PPTX export produced all three locale files: `<DeckBase>_pt-BR.pptx`, `<DeckBase>_en.pptx`, and `<DeckBase>_es.pptx`.
- [ ] Cover titles fit (44pt, not 54pt for wide titles), shadows use a factory not a shared object, huge digits use rich text.
- [ ] Visual QA done by converting key slides to images and inspecting for overlap, overflow, and misalignment.
- [ ] The PPTX is saved under `decks/pptx/<DeckBase>/` with the same English deck base name and locale suffix.
- [ ] `python3 scripts/validate_derivatives.py --html <deck>.html --locale pt-BR --pptx decks/pptx/<DeckBase>/<DeckBase>_pt-BR.pptx` exits 0.
- [ ] `python3 scripts/validate_derivatives.py --html <deck>.html --locale en --pptx decks/pptx/<DeckBase>/<DeckBase>_en.pptx` exits 0.
- [ ] `python3 scripts/validate_derivatives.py --html <deck>.html --locale es --pptx decks/pptx/<DeckBase>/<DeckBase>_es.pptx` exits 0.
- [ ] If `--allow-notes-derived-content` was used, it was used only for PPTX, the reason is documented, and the output remains native/editable with locale-correct notes.
