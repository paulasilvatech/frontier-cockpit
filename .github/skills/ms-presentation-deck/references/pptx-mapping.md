# PPTX mapping from HTML

How the HTML deck patterns translate to PptxGenJS API calls. This file is the bridge between the design system documented in `patterns.md` and the generator script `scripts/make_pptx.js`.

## Coordinate system

PptxGenJS uses **inches** as the coordinate unit. The deck layout is `LAYOUT_WIDE` (13.333 × 7.5 in), which corresponds 1:1 to the HTML viewport at 96 DPI (1280 × 720 px).

Conversion: `px / 96 = inches`.

So:
- HTML `padding-left: 48px` becomes PPTX `x: 0.5`.
- HTML `width: 1180px` becomes PPTX `w: 12.3` (with 0.5" margins on both sides).
- HTML `font-size: 36px` corresponds roughly to PPTX `fontSize: 36` (PPTX size is points, but visually similar for slide content).

## Setup boilerplate

```javascript
const pptxgen = require("pptxgenjs");
const fs = require("fs");

const data = JSON.parse(fs.readFileSync("deck_data_pt.json", "utf8"));

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333" × 7.5"
pres.author = "Frontier Cockpit Team";
pres.company = "Microsoft";
pres.title = "...";
pres.subject = "...";

const C = {
  red: "F25022", redLight: "FCE9E3",
  green: "7FBA00", greenLight: "F1F8E3",
  yellow: "FFB900", yellowLight: "FFF7E0",
  blue: "00A4EF", blueLight: "DDF3FD",
  ink: "1A1A19", ink2: "5C5A52", ink3: "82807A",
  paper: "F8F7F2", rule: "E8E5DC", bg: "FFFFFF",
  darkBg: "0F0F0E", darkInk: "F0F0EB", darkInk2: "B8B6AE", darkInk3: "82807A"
};

const FONT_SANS = "Inter";
const FONT_MONO = "JetBrains Mono";
```

## Speaker notes embedding

```javascript
function plainNote(text) {
  if (!text) return "";
  return text.replace(/\*\*/g, "").replace(/\*/g, "").trim();
}

// At the end of each slide function:
s.addNotes(plainNote(data.notes.s5));
```

Notes preserve the markers (`[ABERTURA]`, `[NÚCLEO]`, etc.) as plain text — they appear in the PowerPoint notes panel. The markdown lite (`**bold**`, `*italic*`) is stripped because PPTX notes don't support rich text in pptxgenjs.

## Font size cheat sheet for PPTX

Hard-won values from iteration. Don't increase these without re-testing rendering in LibreOffice and PowerPoint.

| Element | Max safe size | Notes |
|---------|---------------|-------|
| Cover title (2 lines) | **44pt** | At 54pt wraps to 3 lines and overlaps subtitle |
| Cover subtitle | 15pt | y: 5.5 (not 5.0) to give room for title |
| Section divider Roman numeral ("I", "II") | tested large size, light weight | Use the same Roman numeral style as the HTML divider, at a tested PPTX size |
| Section divider title | 50pt | x: 6.0, w: 7 |
| Big date or number ("2026-06-01") | **110pt mono** | At 180pt+ wraps |
| "100x" inline (number + superscript) | 130pt + 50pt superscript | See Pattern 8 |
| Stat-pair value (wide, e.g. "7,500") | **70pt** | Smaller than narrower stats |
| Stat-pair value (narrow, e.g. "0") | **90pt** | More room to be big |
| Stat-pair ratio in middle ("7,500x") | 48pt | Smaller than the extremes |
| Slide title (content) | 30-36pt | Default 36pt |
| Slide title (dense content) | 26-30pt | When the slide also has tables or charts |
| Eyebrow (mono uppercase) | 10pt | charSpacing 4 |
| Card title | 14-18pt bold | Depends on card width |
| Card body | 11-12pt | Depends on card density |
| Body paragraph | 13-15pt | Inter, not too dense |
| Closing slide title | 52pt | Has room because background is dark and contained |
| Page number | 9pt mono | Right-aligned bottom |

## Critical pitfalls

### 1. Shared option objects mutate

```javascript
// WRONG: shadow mutated by first addShape, second call gets corrupted EMU values
const shadow = { type: "outer", blur: 6, offset: 2, color: "000000", opacity: 0.15 };
slide.addShape(pres.shapes.RECTANGLE, { shadow, ... });
slide.addShape(pres.shapes.RECTANGLE, { shadow, ... });  // BROKEN

// RIGHT: factory function or inline objects
const makeShadow = () => ({ type: "outer", blur: 6, offset: 2, color: "000000", opacity: 0.15 });
slide.addShape(pres.shapes.RECTANGLE, { shadow: makeShadow(), ... });
slide.addShape(pres.shapes.RECTANGLE, { shadow: makeShadow(), ... });
```

### 2. Hex colors NEVER take "#" prefix

```javascript
color: "FF0000"      // CORRECT
color: "#FF0000"     // WRONG, corrupts the file
```

### 3. Opacity in color is a file killer

```javascript
shadow: { color: "00000020" }  // WRONG (8-char hex with alpha)
shadow: { color: "000000", opacity: 0.12 }  // CORRECT
```

### 4. ROUNDED_RECTANGLE + RECTANGLE overlay don't mix

The accent bar won't cover the rounded corners. Use RECTANGLE for both, or accept that the accent bar will have sharp corners against the rounded card.

### 5. Don't use `lineSpacing` with bullets

Use `paraSpaceAfter` instead. lineSpacing creates excessive gaps with bullet lists.

### 6. Never reuse pres instance

Each PPTX generation must create a fresh `new pptxgen()`. Don't try to cache or reuse.

## Pattern function template

A slide function follows this template:

```javascript
function slideN() {
  const s = pres.addSlide();
  s.background = { color: C.bg };  // or C.darkBg for dark slides
  addBrandHeader(s);                // or addBrandHeader(s, "dark")

  addEyebrow(s, data.<key>.eyebrow, C.blue);  // or another color
  addTitle(s, data.<key>.title, { size: 36 });

  // pattern-specific content (see patterns.md for code snippets)

  addPageNumber(s, N, total);  // or addPageNumber(s, N, total, "dark")
  s.addNotes(plainNote(data.notes.sN));
}
```

## Generating and validating

```bash
# Generate
NODE_PATH=/path/to/global/node_modules node make_pptx.js

# Validate the full three-language PPTX package against the HTML source
python3 scripts/validate_derivatives.py --html decks/<DeckBase>_multi.html --locale pt-BR --pptx decks/pptx/<DeckBase>/<DeckBase>_pt-BR.pptx
python3 scripts/validate_derivatives.py --html decks/<DeckBase>_multi.html --locale en --pptx decks/pptx/<DeckBase>/<DeckBase>_en.pptx
python3 scripts/validate_derivatives.py --html decks/<DeckBase>_multi.html --locale es --pptx decks/pptx/<DeckBase>/<DeckBase>_es.pptx

# Convert to PDF for visual inspection
soffice --headless --convert-to pdf deck.pptx

# Convert to images for slide-by-slide check
rm -f /tmp/check-*.jpg
pdftoppm -jpeg -r 100 deck.pdf /tmp/check
ls /tmp/check-*.jpg

# Then view each image with the `view` tool. Look for:
# - Text overlap (especially title vs subtitle)
# - Text overflow (cutoff at slide edges)
# - Misaligned columns (cards not visually equal)
# - Decorative bars in wrong position (offset from text edge)
```

## Inspecting embedded notes

```python
from pptx import Presentation
prs = Presentation('deck.pptx')
for i, slide in enumerate(prs.slides):
    if slide.has_notes_slide:
        notes = slide.notes_slide.notes_text_frame.text
        print(f"Slide {i+1}: {len(notes)} chars, markers: {'[ABERTURA' in notes}")
```

If a slide has 0 chars or missing markers, the notes weren't passed correctly. Check the `data.notes.sN` references in the slide function.

## Re-generation cycle

After fixing a defect:

1. Edit the slide function in `make_pptx.js`.
2. `node make_pptx.js` to regenerate.
3. `soffice.py --headless --convert-to pdf deck.pptx` to re-render.
4. `pdftoppm` to re-extract images.
5. View only the affected slide(s) — no need to re-check everything.

Don't iterate forever. Per the pptx skill QA guidance: **fix one cycle, ship it**. Don't chase sub-pixel positioning or minor color tweaks. Aim for "the user won't notice user-visible defects", not "perfect to my eye".
