# ms-identity technical documentation, identity audit checklist

Same identity gates as the editorial sibling, plus three technical-doc
gates. Run before exporting the final PDF.

## Shared gates with the editorial sibling

These four gates are identical to `ms-identity-editorial-brief`. See
that skill's `references/identity-audit.md` for the full rationale.

### Typography gate

Inter and JetBrains Mono only.

```bash
grep -nE "Fraunces|font-serif|Georgia" my_doc_print.html  # must return 0
```

### Punctuation gate

No em-dashes (`—`) or en-dashes (`–`).

```bash
grep -nE "—|–" my_doc_print.html  # must return 0
```

### Microsoft logo gate

The SVG must use viewBox `0 0 17 17` with four 8x8 rects at positions
(0,0), (9,0), (0,9), (9,9) and colors red TL, green TR, blue BL, yellow BR.

### Palette gate

Only Microsoft 4-color palette plus the neutral grayscale.

### Forbidden strings gate

```bash
grep -nE "AI-Native Software Engineer|@your-org|your-handle|linkedin\.com|agenticdevops" my_doc_print.html  # must return 0
```

## Tech-doc-specific gates

### Gate 1, code block selectability

Code blocks must render as selectable text inside the PDF, not as images
or rasterized output. Test:

```bash
pdftotext my_doc.pdf - | grep -c "code marker string"  # must return >= 1
```

Replace `code marker string` with any unique line you know exists in a
code block. If grep returns 0, the code block was rasterized somewhere
in the pipeline and the fix is to remove any `background-image` CSS or
ensure the code block stays as `<pre>` text, not converted to an image.

### Gate 2, syntax highlighting via inline spans only

No Prism, no Highlight.js, no external CSS for syntax colors. All token
colors must be inline spans with classes defined inside the document
stylesheet.

```bash
grep -nE "prism|highlight\.js|hljs-" my_doc_print.html  # must return 0
```

Token color classes used by the components module are: `k` (keyword),
`s` (string), `c` (comment), `n` (number), `fn` (function), `v` (variable),
`t` (type), `p` (property). All defined in `template_css.py`. Do not add
new token classes; they will not theme correctly.

### Gate 3, admonition palette

Admonitions (note, tip, important, warning, danger) use only Microsoft
palette accents and the neutral grayscale. No purple, no magenta, no
other colors.

Validation:

```python
import re, pathlib
s = pathlib.Path("my_doc_print.html").read_text()
adm_fills = re.findall(r'class="adm (\w+)"', s)
allowed = {"note", "tip", "important", "warning", "danger"}
for kind in set(adm_fills):
    assert kind in allowed, f"Unknown admonition kind: {kind}"
print(f"Admonitions: {len(adm_fills)} total, all known kinds")
```

### Gate 4, parameter table integrity

Parameter tables must declare exactly four columns: Parameter, Type,
Default, Description. Inserting extra columns breaks the editorial
rhythm and forces tables out of the 178 mm interior.

```bash
# Count thead columns; expect 4 per param table
grep -oE '<table class="params">.*?</thead>' my_doc_print.html \
  | grep -oE '<th>' | wc -l
# Should equal 4 * (number of param tables)
```

## Tech-doc structural gates

### Gate 5, every code block has a language label or filename

A naked code block without a language label and without a filename is
hard to read. The component `code_block(language, code, filename=None)`
requires at least one of the two.

```bash
# All codeblocks should have a header
codeblocks=$(grep -c '<div class="codeblock">' my_doc_print.html)
headers=$(grep -c '<div class="codeblock-h">' my_doc_print.html)
[ "$codeblocks" = "$headers" ] && echo "OK" || echo "FAIL: $codeblocks codeblocks but $headers headers"
```

### Gate 6, no orphan section headers

A section header at the bottom of a page with content starting on the
next page reads as broken. The `break-inside: avoid` rule on `.sh`
prevents this in practice, but verify visually at 150 DPI.

### Gate 7, file paths and identifiers use inline_code, not raw text

References to filenames, function names, environment variables, etc.,
inside body paragraphs should always go through `inline_code()`, never
raw text. The visual distinction matters for reader scanning.

Heuristic check: search for common patterns that should be inline code:

```bash
# These patterns suggest raw text where inline code is expected:
grep -nE '\b[A-Z_]+_[A-Z_]+\b' my_doc_print.html | grep -v 'class="inline"' | head
# (environment variable names like AGENTIC_API_KEY)

grep -nE '\b[a-z]+\.[a-z]+\(\)' my_doc_print.html | grep -v 'class="inline"' | head
# (function calls like client.ping())
```

Manual review acceptable; the heuristics surface candidates.

## Summary one-liner

```bash
fail=0
grep -nE "Fraunces|font-serif|Georgia|—|–|@your-org|your-handle|linkedin\.com|agenticdevops|AI-Native Software Engineer|prism|highlight\.js|hljs-" my_doc_print.html && fail=1
[ "$fail" = "1" ] && echo "Identity audit: FAIL" || echo "Identity audit: PASS"
```
