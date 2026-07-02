#!/usr/bin/env python3
"""
ms-identity editorial brief, starter Python script.

Workflow:
1. Copy this file into your outputs directory and rename it _build_<topic>.py
2. Make sure assets/template_css.py, assets/components.py, assets/charts.py
   are alongside it (or import from the skill's assets path).
3. Edit the BRIEF_META block, the TOC, the chapter contents, the data.
4. Leave the imports, the CSS, the page-archetype helpers untouched.
5. Run the script. It writes out HTML, print HTML, and PDF.

Output filename convention:
   {Topic}_Editorial_v{M}_{m}_{p}_{YYYY-MM-DD}_{locale}.{ext}
"""
import pathlib
import sys

# When this starter ships inside the skill, the assets sit next to it.
# When the user copies it to outputs/, they should also copy template_css.py,
# components.py, charts.py to the same directory (or adjust these imports).
try:
  from template_css import CSS
  from components import (
    ms_logo, gh_logo, runhead, folio, kicker, section_header,
    sidebar, pull_quote, data_card, data_strip,
    callout, callouts, chart_card, hero_number,
    paste_box, tags_strip, bullets, fmt_short, fmt_num,
  )
  from charts import (
    chart_stacked_bar, chart_line, chart_donut, chart_h_bar, chart_gap_pairs,
  )
except ImportError as exc:
  sys.exit(
    f"ERROR: required local module missing ({exc.name}).\n"
    "Copy these files next to this starter before running it:\n"
    "  - template_css.py\n"
    "  - components.py\n"
    "  - charts.py"
  )

# ============================================================
# BRIEF METADATA, edit these per brief
# ============================================================
TOPIC          = "MyTopic"
ISSUE          = 8
COVER_EYEBROW  = "Project name, audience, FY26"
COVER_TITLE    = "First line.<br>Second line.<br><em>Third line with accent.</em>"
COVER_LEDE     = "One paragraph that gives the reader the full thesis in roughly 60 to 90 words. Mention the period, the scope, the dominant signal, and the action implied. The lede sets up everything the chapters will substantiate."
PERIOD_LINE    = "<strong>Period:</strong> Jul 2025, Apr 2026"
EXTRA_META     = "<strong>Scope:</strong> 11 main customers &nbsp;·&nbsp; <strong>Refreshed:</strong> 2026-05-25"
RUNHEAD_TITLE  = "MyTopic, editorial brief"
CLOSE_QUOTE    = "The thesis in one final sentence, italic-feel Inter at 22pt on the dark close page."
VERSION        = "v1_0_0"
DATE           = "2026-05-25"
LOCALE         = "en"

# Output paths
HERE = pathlib.Path(__file__).parent
OUT_BASE = f"{TOPIC}_Editorial_{VERSION}_{DATE}_{LOCALE}"
OUT_HTML  = HERE / f"{OUT_BASE}.html"
OUT_PRINT = HERE / f"{OUT_BASE}_print.html"
OUT_PDF   = HERE / f"{OUT_BASE}.pdf"

# ============================================================
# DATA, edit per brief
# ============================================================
# Example: 4 cards on the executive lede page
LEDE_CARDS = [
    data_card("Hero metric A", "+120%", "Run rate, period", accent="red"),
    data_card("Hero metric B", "$11.13M", "Annualized total", accent="blue"),
    data_card("Hero metric C", "1,081", "Devs enabled", accent="green"),
    data_card("Hero metric D", "7", "Multi-year deals", accent="yellow"),
]

# Example: TOC entries [(num_label, title, deck, page_str)]
TOC_ENTRIES = [
    ("01", "Executive lede",      "The thesis in one page",                "03"),
    ("02", "Headline KPIs",       "Six numbers that frame the rest",       "04"),
    ("03", "Chapter three topic", "What this chapter argues",              "05"),
    ("04", "Chapter four topic",  "What this chapter argues",              "06"),
    ("05", "Strategic takeaways", "Action-ready moves",                    "07"),
    ("A",  "Data appendix",       "Tables that back every number",         "08"),
]

# ============================================================
# RENDER
# ============================================================
def html_open() -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>{RUNHEAD_TITLE}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="author" content="Frontier Cockpit Team, Software Global Black Belt">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>{CSS}</style>
</head>
<body>"""

def page_cover() -> str:
    return f"""
<section class="page" style="padding:0">
  <div class="cover">
    <div class="cover-top">
      <span class="left">{ms_logo(14)}Frontier Cockpit Team &nbsp;|&nbsp; Software Global Black Belt</span>
      <span>Vol. 01 &nbsp;/&nbsp; FY26 &nbsp;/&nbsp; Internal</span>
    </div>
    <div class="cover-mid">
      <div class="eyebrow">{COVER_EYEBROW}</div>
      <h1 class="title">{COVER_TITLE}</h1>
      <p class="lede">{COVER_LEDE}</p>
    </div>
    <div class="cover-bottom">
      <div class="cover-issue">
        <strong>Issue {ISSUE:02d}.</strong> {PERIOD_LINE}<br>
        {EXTRA_META}
      </div>
      <div class="cover-by">
        <span class="name">Frontier Cockpit Team</span>
        Software Global Black Belt<br>
        frontier-cockpit@example.com
      </div>
    </div>
    <div class="cover-bar">
      <i style="background:#F25022"></i>
      <i style="background:#7FBA00"></i>
      <i style="background:#00A4EF"></i>
      <i style="background:#FFB900"></i>
    </div>
  </div>
</section>"""

def page_masthead_toc() -> str:
    toc_items = "".join(
        f'<li><span class="n">{n}</span>'
        f'<span class="t">{t}<span>{d}</span></span>'
        f'<span class="p">{p}</span></li>'
        for (n, t, d, p) in TOC_ENTRIES
    )
    return f"""
<section class="page">
  {runhead(RUNHEAD_TITLE, "Masthead")}
  <div style="padding-top:11mm">
    <div class="kicker">From the Software Global Black Belt</div>
    <h2 class="mt-title">A reading guide for this brief, structured for the manager and skip-level read.</h2>
    <p class="mt-deck">The brief organizes the material into N chapters plus an appendix. Each chapter sits on one or two spreads. Charts are inline SVG, tables are editorial style, and every number is traceable to the source files cited in the appendix.</p>
  </div>
  <div class="mt-grid">
    <div>
      <div class="toc-h">In this issue</div>
      <ol class="toc-l">{toc_items}</ol>
    </div>
    <div>
      {sidebar("How to read this brief", "One short paragraph about the reading order, what to look for, and where the evidence lives.")}
      <div style="margin-top:5mm">{sidebar("The thesis, in one line", "One declarative sentence that the entire brief substantiates.", accent="red")}</div>
    </div>
  </div>
  {folio(2, "Masthead")}
</section>"""

def page_executive_lede() -> str:
    return f"""
<section class="page tint">
  {runhead(RUNHEAD_TITLE, "Chapter 01, Executive lede")}
  <div style="padding-top:12mm">
    {section_header("Chapter 01", "Executive lede", "One single declarative headline.", bar=True)}
    <div class="two-col">
      <p class="body"><strong style="color:var(--ink)">First paragraph.</strong> Body paragraph that opens the argument.</p>
      <p class="body">Second paragraph that adds the second strongest piece of evidence.</p>
      <p class="body">Third paragraph that completes the argument or sets up the chapters.</p>
    </div>
    {pull_quote("The one-line thesis as a pull quote inside the page.", "The thesis, in one line")}
    {data_strip(LEDE_CARDS)}
  </div>
  {folio(3, "Executive lede")}
</section>"""

def page_chapter(num: int, chapter_label: str, slug: str, headline: str,
                 body_html: str, folio_name: str,
                 tinted: bool = False) -> str:
    cls = " tint" if tinted else ""
    return f"""
<section class="page{cls}">
  {runhead(RUNHEAD_TITLE, f"{chapter_label}, {slug}")}
  <div style="padding-top:12mm">
    {section_header(chapter_label, slug, headline)}
    {body_html}
  </div>
  {folio(num, folio_name)}
</section>"""

def page_close() -> str:
    gh_big = gh_logo("28mm")
    ms_big = (
        '<svg width="28mm" height="28mm" viewBox="0 0 17 17" '
        'xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
        '<rect x="0" y="0" width="8" height="8" fill="#F25022"/>'
        '<rect x="9" y="0" width="8" height="8" fill="#7FBA00"/>'
        '<rect x="0" y="9" width="8" height="8" fill="#00A4EF"/>'
        '<rect x="9" y="9" width="8" height="8" fill="#FFB900"/>'
        '</svg>'
    )
    return f"""
<section class="page dark">
  <div class="close">
    <div class="marks">{ms_big}{gh_big}</div>
    <div class="lbl">Microsoft &nbsp;+&nbsp; GitHub</div>
    <div class="q">{CLOSE_QUOTE}</div>
    <div class="rule"></div>
    <div class="sig">End of brief</div>
  </div>
</section>"""

def html_close() -> str:
    return "</body></html>"

# ============================================================
# ASSEMBLY
# ============================================================
def render() -> str:
    H = [html_open()]
    H.append(page_cover())
    H.append(page_masthead_toc())
    H.append(page_executive_lede())

    # Example chapter using the helper. Replace and add as needed.
    chapter3_body = (
        callouts([
            callout("Tag A", "Headline A", "Body of callout A.", accent="red"),
            callout("Tag B", "Headline B", "Body of callout B.", accent="green"),
        ])
        + sidebar("Reading the chapter", "What the reader should take from this page.")
    )
    H.append(page_chapter(4, "Chapter 02", "Chapter slug",
                          "Chapter headline goes here.",
                          chapter3_body, "Chapter slug",
                          tinted=False))

    H.append(page_close())
    H.append(html_close())
    return "".join(H)


def main():
    html = render()
    OUT_HTML.write_text(html, encoding="utf-8")
    OUT_PRINT.write_text(html, encoding="utf-8")
    for out in (OUT_HTML, OUT_PRINT):
        if not out.is_file() or out.stat().st_size == 0:
            sys.exit(f"ERROR: output file was not written or is empty: {out}")
    print(f"wrote {OUT_HTML.name}")
    print(f"wrote {OUT_PRINT.name}")
    print("")
    print("To convert HTML -> vector PDF via WeasyPrint Python lib:")
    print("  PYTHONPATH=/path/to/weasyprint/env python3 -c \\")
    print(f"    \"import weasyprint; weasyprint.HTML(filename='{OUT_BASE}_print.html').write_pdf(target='{OUT_BASE}.pdf')\"")


if __name__ == "__main__":
    main()
