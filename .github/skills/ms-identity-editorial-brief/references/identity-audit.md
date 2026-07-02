# ms-identity editorial brief, identity audit checklist

Run this audit before exporting the final PDF. Each gate must pass for the
brief to ship under the ms-identity identity.

## Typography gate

Inter and JetBrains Mono only. No serif, no Fraunces, no Georgia fallback.

```bash
# This must return 0 matches:
grep -nE "Fraunces|font-serif|Georgia" my_brief_print.html
```

If matches appear, swap them. Headings and titles use Inter 600/700/800.
Body uses Inter 400. Mono labels and chrome use JetBrains Mono. There is
no editorial role for a serif font in this identity.

## Punctuation gate

No em-dashes (`—`, U+2014), no en-dashes (`–`, U+2013). Use commas, periods,
or hyphens.

```bash
# This must return 0 matches:
grep -nE "—|–" my_brief_print.html
```

The most common em-dash leak is a placeholder for zero in tables. Replace
with a quiet middle dot:
```html
<td class="num"><span style="color:#9A9A9A">·</span></td>
```

## Microsoft logo gate

The logo SVG must use the official spec:

- viewBox `0 0 17 17`
- Four 8x8 rects at positions (0,0), (9,0), (0,9), (9,9)
- Colors: red TL `#F25022`, green TR `#7FBA00`, blue BL `#00A4EF`, yellow BR `#FFB900`
- The 1-unit gap inside a 17-unit viewBox gives a 6% spacing ratio

Common errors:
- Swapping blue and yellow on the bottom row (the most frequent bug)
- Using a 16x16 viewBox with 7x7 rects (gives ~13% gap, too wide)
- Forgetting `class="ms"` or omitting `margin-right` on the SVG (logo collides with text)

Validation script:

```python
import re, pathlib
s = pathlib.Path("my_brief_print.html").read_text()
m = re.search(r'<svg[^>]*viewBox="0 0 17 17"[^>]*>(.*?)</svg>', s)
rects = re.findall(r'<rect x="(\d+)" y="(\d+)"[^>]*fill="(#[A-F0-9]+)"', m.group(1))
expected = {('0','0'):'#F25022', ('9','0'):'#7FBA00',
            ('0','9'):'#00A4EF', ('9','9'):'#FFB900'}
for x, y, c in rects:
    assert expected[(x,y)] == c, f"MS logo wrong at ({x},{y}): got {c}"
print("MS logo: OK")
```

## Palette gate

Only the Microsoft 4-color palette `#F25022 / #7FBA00 / #00A4EF / #FFB900`
plus the neutral grayscale. No magenta, no purple, no other accent.

```bash
# These should be the ONLY fill colors in chart SVGs (plus 700-variant darker shades):
grep -oE 'fill="#[0-9A-F]{6}"' my_brief_print.html | sort -u
# Expected output: a small set including F25022, 7FBA00, 00A4EF, FFB900,
# plus B33816, 5A8500, 0076AC, B88500 (700 variants for emphasis),
# plus 111111, 333333, 6C6C6C, 9A9A9A (ink scale).
```

## Forbidden strings gate

The personal your-org identity must not leak into the Microsoft brief:

```bash
# These must return 0 matches:
grep -nE "AI-Native Software Engineer|@your-org|your-handle|linkedin\.com|agenticdevops" my_brief_print.html
```

These strings belong to the personal-identity sibling skill (your-org),
not to ms-identity.

## Cover gate

Open the rendered PDF page 1 at 300 DPI and confirm:

- "PAULA SILVA | SOFTWARE GLOBAL BLACK BELT VOL. 01 / FY26 / INTERNAL" all on one line (no wrap)
- Microsoft logo sits on the same baseline as the "PAULA SILVA" text (vertical-align fine)
- 10px gap between logo and text (not glued, not wide)
- Bottom 4-color bar shows all 4 stripes in equal width (red, green, blue, yellow)
- Title fits the layout, no clipping into the lede

## Close page gate

- Microsoft mark and GitHub Octocat both present, centered, 28mm each, 12mm gap
- Microsoft mark uses the official color positions (audit reads the SVG positions just like on the cover)
- "Microsoft + GitHub" label in uppercase mono, gray `#9A9590`
- Italic-feel Inter 500 quote, 22pt, max 160mm
- 30mm by 2px blue rule
- "End of brief" mono signature
- NO metadata visible: no version string, no locale, no skill name, no document path

## Page count gate

`pypdf` page count should be 12 to 18:

```python
from pypdf import PdfReader
r = PdfReader("my_brief.pdf")
assert 12 <= len(r.pages) <= 18, f"Page count out of range: {len(r.pages)}"
```

Outside this range, the brief either drifts into one-pager territory (too
short) or report territory (too long).

## Page size gate

Every page must be A4 portrait (595.28 by 841.89 points):

```python
from pypdf import PdfReader
r = PdfReader("my_brief.pdf")
for i, p in enumerate(r.pages):
    w, h = float(p.mediabox.width), float(p.mediabox.height)
    assert abs(w - 595.28) < 1 and abs(h - 841.89) < 1, f"Page {i+1} not A4"
```

## Conversion gate

The PDF must be generated via the Python WeasyPrint library, not via a
browser print dialog and not via any rasterization pipeline. The text
inside the PDF must be selectable text, not an image.

```bash
# This must return text (not an image):
pdftotext my_brief.pdf - | head -20
```

If `pdftotext` returns empty, something rasterized the document. The fix is
to use WeasyPrint:

```python
import weasyprint
weasyprint.HTML(filename="my_brief_print.html").write_pdf(target="my_brief.pdf")
```

## Summary one-liner

After all individual gates pass, this composite audit is a useful final pass:

```bash
fail=0
grep -nE "Fraunces|font-serif|Georgia|—|–|@your-org|your-handle|linkedin\.com|agenticdevops|AI-Native Software Engineer" my_brief_print.html && fail=1
[ "$fail" = "1" ] && echo "Identity audit: FAIL" || echo "Identity audit: PASS"
```
