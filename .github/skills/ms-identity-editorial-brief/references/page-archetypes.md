# ms-identity editorial brief, page archetype catalog

Every page in the brief falls into one of these archetypes. Each archetype
has a fixed structural skeleton (the parts marked locked) and content slots
(the parts marked variable). Mix and match across a brief, but stay inside
the archetype contracts; that is what makes the family of briefs cohere.

## Page 1, cover (locked)

Dark `#0B0B0B` background. No runhead, no folio. Three horizontal regions:

1. **Top chrome** (locked): Microsoft 4-color SVG + "Frontier Cockpit Team | Software Global Black Belt" on the left, "Vol. NN / FY26 / Internal" on the right, mono uppercase, 7.5pt, color `#9A9590`, gap 14mm.
2. **Mid region** (variable): blue eyebrow, then the cover title in Inter 800 at 46-48pt with one italic yellow accent line (the third or final line is the strongest gesture), then a 13pt Inter 300 lede paragraph up to 150mm wide.
3. **Bottom chrome** (locked): issue line on the left, author block on the right, 1mm rule above, then the 4-color Microsoft horizontal stripes at 6mm tall (red, green, blue, yellow, left to right).

The cover sets the rhythm for the whole brief. Use one bold metric in the title and one quiet metric in the lede, not the other way around.

## Page 2, masthead + TOC (one page)

Top runhead, bottom folio. Split layout 7fr / 5fr:

- **Left column**: kicker (blue rule + uppercase mono), masthead title (Inter 700 at 22pt), masthead deck (Inter 300 at 10.5pt), then the TOC (numbered list with chapter name + one-line description + page number).
- **Right column**: two sidebars stacked, "How to read this brief" and "The thesis, in one line" (red accent for the thesis).

TOC must fit one page. If it spills, reduce `padding` from 2.4mm to 1.9mm on `.toc-l li`, drop `font-size` from 11pt to 10.5pt on `.toc-l .t`, or merge two entries into one if the section count is too high.

## Page 3, executive lede (one page, page-tinted background)

Top runhead, bottom folio. The chapter that the cover lede expands into.

- Section header (kicker "Chapter 01", slug "Executive lede", headline ~26pt, color bar `<i>...</i>` row)
- Two-column body, 3 to 4 paragraphs total, with the strongest paragraph having a `<strong>` lead phrase
- Pull quote (1px rules top and bottom, Inter 600 italic-feel 17pt, mono attribution underneath)
- Data strip of 3 or 4 cards (the same metrics shown on the cover, expanded with one-line subtext)

## Chapter pages (alternate plain and page-tinted, 1 to 2 pages each)

Each chapter spread carries one argument, one big metric, and one piece of evidence (chart, table, or callout grid).

**Skeleton:**
1. Section header with kicker + headline + optional deck
2. Body, which is one of:
   - Chart card (use `chart_card()` wrapping `chart_stacked_bar`, `chart_line`, `chart_donut`, or `chart_h_bar`)
   - Data table (`<table class="ed">`)
   - Layered diagram (4 rows, one per layer)
   - Hero number (huge red Inter 800 number + read column)
   - Bullets list with colored markers
   - Callouts grid (2x2 or 2x3 of `.call` cards)
3. One closing sidebar with a reading note ("How to read this chart" or "Why this matters")

**Color rhythm**: alternate `<section class="page">` and `<section class="page tint">` between chapters. Tinted pages use `--bgw: #ECE7DE`. Three to four consecutive tinted pages start to fatigue the eye, so break them up with a plain page.

## Chart card pages

Wrap each chart in a `<div class="cc">` with `<div class="h">` (title and subtitle) and `<div class="cw">` (SVG). For two-up layouts use:

```html
<div style="display:grid;grid-template-columns:1fr 1fr;gap:5mm">
  <div class="cc">...</div>
  <div class="cc">...</div>
</div>
```

Charts must be inline SVG. Do not ship Chart.js or any JavaScript. WeasyPrint cannot execute JS and the chart will render blank.

## Table pages

Use `<table class="ed">` for editorial tables. Cells take `c` (customer name, bold), `s` (strong number, dark), `m` (muted index), `num` (right-aligned tabular). The header row is uppercase mono 7.5pt, ink2 color. Body rows are 8.5pt with thin rules below. A "cumulative" or "totals" row gets `style="background:var(--bgw)"`.

For wide tables, drop font size to 8pt on the `<table>` element. For very wide tables (12+ columns), consider splitting across two pages instead of shrinking past 7.5pt.

## Hero number pages

```html
<div class="hero-num">
  <div>
    <div class="hn-l">Label</div>
    <div class="hn-big">45.0%</div>
  </div>
  <div>
    <div class="hn-l">Read</div>
    <div class="hn-t">One-paragraph editorial gloss.</div>
  </div>
</div>
```

The big number is Inter 800 at 64pt, red `#F25022`. Use sparingly. One hero number per chapter, not more.

## Callout grid pages

```html
<div class="calls">
  <div class="call r">...</div>
  <div class="call g">...</div>
  ...
</div>
```

Two columns by default. Add `.three` class for three columns. Six callouts (2x3 grid) is the recommended density for a Strategic Takeaways chapter. Three callouts (1x3) works for a sectoral comparison.

## Appendix divider

A separate page that introduces the appendix tables. Section header + 4 callouts (Table A / Table B / Table C / Source) describing what each subsequent appendix page contains.

## Appendix table pages (one per data table)

Like a chapter page but with a single `<table class="ed">` filling the body and a methodology sidebar at the bottom explaining how the numbers were computed.

## Connect / performance brief, paste-box page

For performance-review-style briefs (Connect Final), each field gets its own page with a special paste box:

```html
<div class="paste">
  <div class="paste-h">
    <span class="l">Paste-ready content for Connect form</span>
    <span class="c"><strong>1,190</strong> / 1,200 chars · 99.2%</span>
  </div>
  ...content paragraphs...
</div>
```

The paste box uses `white-space: pre-wrap` so line breaks are preserved. The header shows the char count, the limit, and the utilization percentage. Below the paste box, render a `tags_strip()` (Value / Cultural / Leadership / Impact pills) and a sidebar with the manager-read check.

## Close page (locked)

Dark `#0B0B0B` background. No runhead, no folio. Centered column with:

1. Microsoft mark + GitHub Octocat, both at 28mm, gap 12mm
2. Mono label "Microsoft + Github" in uppercase, 9pt
3. The closing thesis in Inter 500 at 22pt, max 160mm wide, white
4. A 30mm by 2px blue rule
5. The signature "End of brief" in mono uppercase

The close page must not carry any metadata, version string, locale code, or skill name. Those leak the build environment and break the editorial feel.

## Page count guidance

| Brief type | Typical pages |
|---|---|
| Performance / promotion (single audience) | 12 to 14 |
| Topic analysis with appendix | 15 to 17 |
| Full dashboard conversion with appendix | 18 |

Stay between 12 and 18 pages. Shorter than 12 reads as a one-pager and the format is overkill; longer than 18 reads as a report and the editorial structure starts to fight the content.
