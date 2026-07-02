"""
ms-identity editorial brief, inline SVG chart helpers.

All charts render as pure SVG primitives (rect, line, path, polyline, circle, text).
No external libraries, no Chart.js, no JavaScript. WeasyPrint renders them
as vector inside the final PDF, so they stay crisp at any zoom.

Every helper takes a `data` argument (a list of dicts or tuples) and color
palette (defaults to Microsoft 4-color) and returns a complete `<svg>...</svg>`
string ready to embed inside `chart_card()`.
"""
import math

PAL = {
  "red": "#F25022", "red700": "#B33816",
  "green": "#7FBA00", "green700": "#5A8500",
  "blue": "#00A4EF", "blue700": "#0076AC",
  "yellow": "#FFB900", "yellow700": "#B88500",
  "ink": "#111111", "ink2": "#333333", "ink3": "#6C6C6C",
  "rule": "#DDD9D2", "bg": "#F4F2EE", "bgc": "#EEF1F4",
}

def _svg(w: int, h: int, body: str) -> str:
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" '
            f'width="100%" height="100%" font-family="Inter,sans-serif" '
            f'font-size="9">{body}</svg>')

def chart_stacked_bar(months: list, series: list, labels: dict,
                      colors: dict, w: int = 720, h: int = 320) -> str:
    """Vertical stacked bar chart, one stack per month.

    months: list of x-axis labels, e.g. ["Jul 25", "Aug 25", ...]
    series: list of dicts, each dict maps series-key -> value for that month
    labels: dict of series-key -> display name
    colors: dict of series-key -> hex color
    """
    pl, pr, pt, pb = 56, 14, 14, 64
    iw, ih = w - pl - pr, h - pt - pb
    n = len(series)
    gap = iw / n
    bw = gap * 0.72
    keys = list(labels.keys())
    mx = max(sum(s[k] for k in keys) for s in series)
    out = []
    for f in [0, 0.25, 0.5, 0.75, 1]:
        y = pt + ih - f * ih
        out.append(f'<line x1="{pl}" y1="{y:.1f}" x2="{w-pr}" y2="{y:.1f}" '
                   f'stroke="{PAL["rule"]}" stroke-width="0.5"/>')
        val = mx * f
        tick = f"${val/1e6:.2f}M" if val >= 1e6 else (
            f"${val/1e3:.0f}K" if val >= 1e3 else f"{int(val)}")
        out.append(f'<text x="{pl-6}" y="{y+3:.1f}" text-anchor="end" '
                   f'fill="{PAL["ink3"]}" font-size="8.5">{tick}</text>')
    for i, m in enumerate(series):
        x = pl + i * gap + (gap - bw) / 2
        yc = pt + ih
        for k in keys:
            hh = (m[k] / mx) * ih
            yc -= hh
            out.append(f'<rect x="{x:.1f}" y="{yc:.1f}" width="{bw:.1f}" '
                       f'height="{hh:.1f}" fill="{colors[k]}"/>')
        out.append(f'<text x="{x+bw/2:.1f}" y="{h-pb+12}" text-anchor="middle" '
                   f'fill="{PAL["ink3"]}" font-size="8.5">{months[i]}</text>')
    # legend
    for j, k in enumerate(keys):
        col = j % 4
        row = j // 4
        cx = pl + col * 108
        cy = h - pb + 30 + row * 14
        out.append(f'<rect x="{cx}" y="{cy-8}" width="9" height="9" '
                   f'fill="{colors[k]}"/>')
        out.append(f'<text x="{cx+13}" y="{cy}" fill="{PAL["ink2"]}" '
                   f'font-size="9">{labels[k]}</text>')
    return _svg(w, h, "".join(out))

def chart_line(months: list, series: list, w: int = 440, h: int = 280) -> str:
    """Multi-line chart with optional filled area on the first series.

    series: list of dicts with keys 'label', 'data' (list of values),
            'color', and optional 'dashed' bool and 'fill' bool.
    """
    pl, pr, pt, pb = 44, 14, 12, 52
    iw, ih = w - pl - pr, h - pt - pb
    all_vals = [v for s in series for v in s["data"]]
    ymin, ymax = min(all_vals) - 8, max(all_vals) + 8

    def X(i):
        return pl + i * (iw / (len(months) - 1))

    def Y(v):
        return pt + ih - (v - ymin) / (ymax - ymin) * ih

    out = []
    for f in [0, 0.25, 0.5, 0.75, 1]:
        v = ymin + (ymax - ymin) * f
        y = Y(v)
        out.append(f'<line x1="{pl}" y1="{y:.1f}" x2="{w-pr}" y2="{y:.1f}" '
                   f'stroke="{PAL["rule"]}" stroke-width="0.5"/>')
        out.append(f'<text x="{pl-6}" y="{y+3:.1f}" text-anchor="end" '
                   f'fill="{PAL["ink3"]}" font-size="8.5">{int(v)}</text>')
    for s in series:
        pts = " ".join(f"{X(i):.1f},{Y(v):.1f}" for i, v in enumerate(s["data"]))
        if s.get("fill"):
            area = f"{pl},{pt+ih} {pts} {w-pr},{pt+ih}"
            fill_c = s["color"] + "26"  # 15% alpha hex
            out.append(f'<polygon points="{area}" fill="{fill_c}"/>')
        dash = ' stroke-dasharray="4,4"' if s.get("dashed") else ""
        out.append(f'<polyline points="{pts}" fill="none" stroke="{s["color"]}" '
                   f'stroke-width="2.4"{dash}/>')
        for i, v in enumerate(s["data"]):
            out.append(f'<circle cx="{X(i):.1f}" cy="{Y(v):.1f}" r="2.5" '
                       f'fill="{s["color"]}"/>')
    for i, m in enumerate(months):
        out.append(f'<text x="{X(i):.1f}" y="{h-pb+14}" text-anchor="middle" '
                   f'fill="{PAL["ink3"]}" font-size="8.5">{m}</text>')
    # legend
    for j, s in enumerate(series):
        cx = pl + j * 150
        cy = h - pb + 30
        out.append(f'<rect x="{cx}" y="{cy-2}" width="14" height="2" '
                   f'fill="{s["color"]}"/>')
        out.append(f'<text x="{cx+19}" y="{cy+2}" fill="{PAL["ink2"]}" '
                   f'font-size="9">{s["label"]}</text>')
    return _svg(w, h, "".join(out))

def chart_donut(slices: list, w: int = 440, h: int = 280,
                cx: int = 120, cy: int = 140, r: int = 105,
                rin: int = 58) -> str:
    """Donut chart with legend on the right.

    slices: list of dicts {'label', 'value', 'color'}
    """
    total = sum(s["value"] for s in slices)
    start = -math.pi / 2
    out = []
    for s in slices:
        frac = s["value"] / total
        end = start + frac * 2 * math.pi
        x1, y1 = cx + r * math.cos(start), cy + r * math.sin(start)
        x2, y2 = cx + r * math.cos(end), cy + r * math.sin(end)
        xi1, yi1 = cx + rin * math.cos(end), cy + rin * math.sin(end)
        xi2, yi2 = cx + rin * math.cos(start), cy + rin * math.sin(start)
        large = 1 if frac > 0.5 else 0
        d = (f"M {x1:.1f} {y1:.1f} A {r} {r} 0 {large} 1 {x2:.1f} {y2:.1f} "
             f"L {xi1:.1f} {yi1:.1f} A {rin} {rin} 0 {large} 0 {xi2:.1f} {yi2:.1f} Z")
        out.append(f'<path d="{d}" fill="{s["color"]}" '
                   f'stroke="#FFFFFF" stroke-width="1.5"/>')
        start = end
    # legend, sorted by descending value
    lx = 252
    for i, s in enumerate(sorted(slices, key=lambda x: -x["value"])):
        y = 50 + i * 22
        out.append(f'<rect x="{lx}" y="{y-7}" width="10" height="10" '
                   f'fill="{s["color"]}"/>')
        out.append(f'<text x="{lx+15}" y="{y+1}" fill="{PAL["ink2"]}" '
                   f'font-size="9">{s["label"]}</text>')
        out.append(f'<text x="{lx+165}" y="{y+1}" fill="{PAL["ink3"]}" '
                   f'font-size="9" text-anchor="end">'
                   f'{s["value"]/total*100:.1f}%</text>')
    return _svg(w, h, "".join(out))

def chart_h_bar(rows: list, color: str, w: int = 440, h: int = 320,
                pad_l: int = 148, value_fmt=None) -> str:
    """Horizontal bar chart, labels on left, values on right.

    rows: list of tuples (label, value). Value can be negative (use red color).
    """
    pr, pt, pb = 70, 8, 12
    iw, ih = w - pad_l - pr, h - pt - pb
    vmax = max(abs(r[1]) for r in rows) * 1.05
    step = ih / len(rows)
    bh = step * 0.66
    if value_fmt is None:
        def value_fmt(v):
            if abs(v) >= 1e6:
                return f"${v/1e6:.2f}M"
            if abs(v) >= 1e3:
                return f"${v/1e3:.1f}K"
            return f"${round(v)}"
    out = []
    for i, (label, val) in enumerate(rows):
        y = pt + i * step + (step - bh) / 2
        ww = (abs(val) / vmax) * iw
        out.append(f'<rect x="{pad_l}" y="{y:.1f}" width="{ww:.1f}" '
                   f'height="{bh:.1f}" fill="{color}"/>')
        out.append(f'<text x="{pad_l-8}" y="{y+bh/2+3:.1f}" text-anchor="end" '
                   f'fill="{PAL["ink2"]}" font-size="8.5">{label}</text>')
        sign = "+" if val > 0 else "-"
        out.append(f'<text x="{pad_l+ww+6:.1f}" y="{y+bh/2+3:.1f}" '
                   f'fill="{PAL["ink"]}" font-size="8.5" font-weight="600">'
                   f'{sign}{value_fmt(abs(val))}</text>')
    return _svg(w, h, "".join(out))

def chart_gap_pairs(rows: list, w: int = 440, h: int = 330,
                    pad_l: int = 110) -> str:
    """Paired horizontal bars per row showing two values side-by-side.

    Designed for "claim vs reality" type comparisons.

    rows: list of (label, value_a, value_b, gap). value_a is green (top bar),
          value_b is red (bottom bar). gap is reserved for callout if you want
          to show it as text.
    """
    pr, pt, pb = 24, 16, 24
    iw, ih = w - pad_l - pr, h - pt - pb
    vmax = 100
    step = ih / len(rows)
    bh_pair = step * 0.74
    bh = bh_pair * 0.45
    gap_between = bh_pair * 0.10
    out = []
    for i, (label, va, vb, _gap) in enumerate(rows):
        y_top = pt + i * step + (step - bh_pair) / 2
        y_a = y_top
        y_b = y_top + bh + gap_between
        w_a = (va / vmax) * iw
        w_b = (vb / vmax) * iw
        out.append(f'<rect x="{pad_l}" y="{y_a:.1f}" width="{w_a:.1f}" '
                   f'height="{bh:.1f}" fill="{PAL["green"]}"/>')
        out.append(f'<rect x="{pad_l}" y="{y_b:.1f}" width="{w_b:.1f}" '
                   f'height="{bh:.1f}" fill="{PAL["red"]}"/>')
        out.append(f'<text x="{pad_l-8}" y="{y_top+bh_pair/2+3:.1f}" '
                   f'text-anchor="end" fill="{PAL["ink2"]}" font-size="9">{label}</text>')
        out.append(f'<text x="{pad_l+w_a+5:.1f}" y="{y_a+bh/2+3:.1f}" '
                   f'fill="{PAL["ink"]}" font-size="8.5" font-weight="600">'
                   f'{va:.1f}%</text>')
        out.append(f'<text x="{pad_l+w_b+5:.1f}" y="{y_b+bh/2+3:.1f}" '
                   f'fill="{PAL["ink"]}" font-size="8.5" font-weight="600">'
                   f'{vb:.1f}%</text>')
    return _svg(w, h, "".join(out))
