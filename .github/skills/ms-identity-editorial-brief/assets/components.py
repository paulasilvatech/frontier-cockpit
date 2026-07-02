"""
ms-identity editorial brief components.

Stateless helpers that emit HTML strings. The CSS in `template_css.py`
expects exactly these class names; do not rename them in new briefs.

Identity rules baked in:
- Microsoft logo: viewBox 0 0 17 17, rects at (0,0)/(9,0)/(0,9)/(9,9) all 8x8,
  colors red TL, green TR, blue BL, yellow BR. Gap is 1 unit (~6% of width).
- GitHub Octocat: official path, white fill on dark backgrounds.
- Microsoft 4-color palette only: #F25022, #7FBA00, #00A4EF, #FFB900.
"""

PAL = {
  "red": "#F25022", "red700": "#B33816",
  "green": "#7FBA00", "green700": "#5A8500",
  "blue": "#00A4EF", "blue700": "#0076AC",
  "yellow": "#FFB900", "yellow700": "#B88500",
  "ink": "#111111", "ink2": "#333333", "ink3": "#6C6C6C", "ink4": "#9A9A9A",
  "paper": "#FFFFFF", "bg": "#F4F2EE", "bgw": "#ECE7DE", "bgc": "#EEF1F4",
  "rule": "#DDD9D2",
}

# ===== LOGOS =====

def ms_logo(size: int = 14) -> str:
    """Microsoft 4-color mark, official spec.

    Red top-left, green top-right, blue bottom-left, yellow bottom-right.
    The 1-unit gap inside the 17-unit viewBox gives the official 6% spacing.
    """
    return (
        f'<svg width="{size}" height="{size}" viewBox="0 0 17 17" '
        f'xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
        f'<rect x="0" y="0" width="8" height="8" fill="#F25022"/>'
        f'<rect x="9" y="0" width="8" height="8" fill="#7FBA00"/>'
        f'<rect x="0" y="9" width="8" height="8" fill="#00A4EF"/>'
        f'<rect x="9" y="9" width="8" height="8" fill="#FFB900"/>'
        f'</svg>'
    )

_GH_PATH = ('M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38'
            ' 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13'
            '-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66'
            '.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15'
            '-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0'
            ' 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56'
            '.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07'
            '-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z')

def gh_logo(size: int = 14, fill: str = "#FFFFFF") -> str:
    """GitHub Octocat, official mark.

    Use white fill on dark backgrounds (cover, close page), or '#111111' on light.
    """
    size_attr = size if isinstance(size, str) else str(size)
    return (
        f'<svg width="{size_attr}" height="{size_attr}" viewBox="0 0 16 16" '
        f'xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
        f'<path fill="{fill}" d="{_GH_PATH}"/></svg>'
    )

# ===== CHROME =====

def runhead(title: str, meta: str) -> str:
    """Top chrome bar with logo, brief title, and section meta on right.

    Sits above every chapter page (not on cover or close).
    """
    return (
        f'<div class="runhead">'
        f'<div class="id">{ms_logo(14)}{title}</div>'
        f'<div>{meta}</div>'
        f'</div>'
    )

def folio(num: int, name: str) -> str:
    """Bottom chrome bar with folio (page number) and section name.

    Sits below every chapter page.
    """
    return f'<div class="folio"><span>{num:02d}</span><span>{name}</span></div>'

# ===== EDITORIAL ELEMENTS =====

def kicker(text: str, accent: str = "blue") -> str:
    """Small uppercase mono label with a colored 12px rule before it.

    `accent` ∈ {"blue","red","green","yellow"}.
    """
    cls = "" if accent == "blue" else f" {accent[0]}"
    return f'<div class="kicker{cls}">{text}</div>'

def section_header(chapter: str, slug: str, headline: str, deck: str = "", bar: bool = False) -> str:
    """Section header used at the top of every chapter page.

    `chapter` is like "Chapter 03"; `slug` is the short topic name.
    """
    out = ['<div class="sh">',
           f'<div class="sh-k"><span class="n">{chapter}</span><span>{slug}</span></div>',
           f'<h2 class="sh-h">{headline}</h2>']
    if deck:
        out.append(f'<p class="sh-d">{deck}</p>')
    if bar:
        out.append('<div class="sh-bar">'
                   '<i style="background:#F25022"></i>'
                   '<i style="background:#7FBA00"></i>'
                   '<i style="background:#00A4EF"></i>'
                   '<i style="background:#FFB900"></i>'
                   '</div>')
    out.append('</div>')
    return "".join(out)

def sidebar(title: str, body: str, accent: str = "blue") -> str:
    """Light box with a colored left rule, used for definitions and notes.

    `accent` ∈ {"blue","red","green","yellow"}.
    """
    cls = "" if accent == "blue" else f" {accent[0]}"
    return f'<div class="side{cls}"><h5>{title}</h5><p>{body}</p></div>'

def pull_quote(text: str, attribution: str) -> str:
    """Editorial pull quote with rules top and bottom, italic-feel Inter."""
    return (f'<div class="pq"><q>{text}</q>'
            f'<div class="a">{attribution}</div></div>')

def data_card(label: str, value: str, sub: str, accent: str = "blue",
              trend: str = None, trend_flat: bool = False) -> str:
    """Single data card (small KPI tile). Use 3 or 4 in a `.dstrip` grid.

    `accent` ∈ {"blue","red","green","yellow"}.
    """
    cls = "" if accent == "blue" else f" {accent[0]}"
    trend_html = ""
    if trend:
        flat = " flat" if trend_flat else ""
        trend_html = f'<span class="t{flat}">{trend}</span>'
    return (f'<div class="dc{cls}">'
            f'<div class="l">{label}</div>'
            f'<div class="v">{value}</div>'
            f'<div class="s">{sub}</div>{trend_html}</div>')

def data_strip(cards: list, three_col: bool = False) -> str:
    """Grid wrapper for data cards. Pass a list of strings from `data_card()`.

    Default is 4 columns. Set `three_col=True` for 3 columns.
    """
    cls = " three" if three_col else ""
    return f'<div class="dstrip{cls}">{"".join(cards)}</div>'

def callout(tag: str, headline: str, body: str, accent: str = "blue") -> str:
    """Editorial callout card. Use in a `.calls` grid (2 or 3 columns).

    `accent` ∈ {"blue","red","green","yellow"}.
    """
    cls = "" if accent == "blue" else f" {accent[0]}"
    return (f'<div class="call{cls}">'
            f'<div class="t">{tag}</div>'
            f'<h4>{headline}</h4>'
            f'<p>{body}</p></div>')

def callouts(items: list, three_col: bool = False) -> str:
    """Grid wrapper for callouts. Pass a list of strings from `callout()`.

    Default is 2 columns. Set `three_col=True` for 3 columns.
    """
    cls = " three" if three_col else ""
    return f'<div class="calls{cls}">{"".join(items)}</div>'

def chart_card(title: str, subtitle: str, svg_body: str) -> str:
    """Frame around an SVG chart. `svg_body` is a complete `<svg>...</svg>`."""
    return (f'<div class="cc">'
            f'<div class="h"><span class="t">{title}</span><span class="s">{subtitle}</span></div>'
            f'<div class="cw">{svg_body}</div></div>')

def hero_number(label: str, big: str, read_label: str, read: str) -> str:
    """Two-column layout: huge red number on left, label and read on right."""
    return (f'<div class="hero-num">'
            f'<div><div class="hn-l">{label}</div><div class="hn-big">{big}</div></div>'
            f'<div><div class="hn-l">{read_label}</div><div class="hn-t">{read}</div></div>'
            f'</div>')

def paste_box(chars: int, limit: int, content: str) -> str:
    """Bordered paste-ready content block with char count and utilization %.

    Used in Connect/performance briefs where the actual paste text is shown.
    """
    pct = round(chars / limit * 100, 1)
    return (f'<div class="paste">'
            f'<div class="paste-h">'
            f'<span class="l">Paste-ready content for Connect form</span>'
            f'<span class="c"><strong>{chars}</strong> / {limit} chars · {pct}%</span>'
            f'</div>{content}</div>')

def tags_strip(value: str, cultural: str, lp: str, impact: str) -> str:
    """Pill tags row, used after paste boxes to summarize the field's framing."""
    return (
        f'<div class="tags">'
        f'<span class="tag"><span class="l">Value</span>{value}</span>'
        f'<span class="tag"><span class="l">Cultural</span>{cultural}</span>'
        f'<span class="tag"><span class="l">Leadership</span>{lp}</span>'
        f'<span class="tag"><span class="l">Impact</span>{impact}</span>'
        f'</div>'
    )

def bullets(items: list, accent: str = "blue") -> str:
    """Bulleted list with colored squared markers. Items are raw HTML strings.

    `accent` ∈ {"blue","red","green","yellow"}.
    """
    cls = "" if accent == "blue" else f" {accent[0]}"
    lis = "".join(f"<li>{it}</li>" for it in items)
    return f'<ul class="bullets{cls}">{lis}</ul>'

# ===== FORMATTERS =====

def fmt_short(n) -> str:
    """Format a number as compact USD: $1.23M, $12.3K, $123."""
    if n is None or n == 0:
        return '<span style="color:#9A9A9A">·</span>'
    if abs(n) >= 1e6:
        return f"${n/1e6:.2f}M"
    if abs(n) >= 1e3:
        return f"${n/1e3:.1f}K"
    return f"${round(n)}"

def fmt_num(n) -> str:
    """Format a count as compact: 1.23M, 12.3K, 123."""
    if abs(n) >= 1e6:
        return f"{n/1e6:.2f}M"
    if abs(n) >= 1e3:
        return f"{n/1e3:.1f}K"
    return f"{round(n)}"
