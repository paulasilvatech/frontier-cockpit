#!/usr/bin/env python3
"""
ms-identity technical documentation, starter Python script.

Workflow:
1. Copy this file into your outputs directory and rename it _build_<project>.py
2. Make sure template_css.py, components.py, diagrams.py are alongside it.
3. Edit the metadata, the TOC, and the chapter contents.
4. Leave the imports, the CSS, and the page archetypes untouched.
5. Run the script. It emits HTML + print HTML, then convert via WeasyPrint.
"""
import pathlib
import sys

try:
  from template_css import CSS
  from components import (
    ms_logo, gh_logo, runhead, folio, kicker, section_header,
    sidebar, h2, h3, h4, body,
    inline_code, code_block, terminal_block,
    note, tip, important, warning, danger,
    file_tree, param_table, endpoint, step, steps,
    glossary, contributors, version_badge,
    metadata_block, diagram_card,
  )
  from diagrams import arch_layered, arch_sequence, arch_flow
except ImportError as exc:
  sys.exit(
    f"ERROR: required local module missing ({exc.name}).\n"
    "Copy these files next to this starter before running it:\n"
    "  - template_css.py\n"
    "  - components.py\n"
    "  - diagrams.py"
  )

# ============================================================
# METADATA, edit per project
# ============================================================
PROJECT      = "AgenticDevOps"
VERSION      = "1.0.0"
STATUS       = "release"   # draft | beta | release
AUDIENCE     = "Developers, Architects, DevOps"
DOC_TYPE     = "Technical documentation"
LAST_UPDATED = "2026-05-25"

COVER_EYEBROW = f"{PROJECT} {DOC_TYPE}"
COVER_TITLE   = f"{PROJECT}<br><em>Reference guide.</em>"
COVER_LEDE    = ("One paragraph describing what this documentation covers, "
                 "who it is for, and how to use it. Mention the audience, "
                 "the entry point, and the recommended reading order.")

CLOSE_QUOTE = ("The work outlives the touch. Documentation is how the "
               "engineering compounds beyond the original team.")
RUNHEAD_TITLE = f"{PROJECT}, technical documentation"

DATE = "2026-05-25"
LOCALE = "en"
VER_NORMAL = VERSION.replace(".", "_")

HERE = pathlib.Path(__file__).parent
OUT_BASE = f"{PROJECT}_TechDoc_v{VER_NORMAL}_{DATE}_{LOCALE}"
OUT_HTML  = HERE / f"{OUT_BASE}.html"
OUT_PRINT = HERE / f"{OUT_BASE}_print.html"
OUT_PDF   = HERE / f"{OUT_BASE}.pdf"

# ============================================================
# TOC entries [(num, title, deck, page, sub=False)]
# ============================================================
TOC = [
    ("01", "Quickstart",       "Five-minute first run",         "03", False),
    ("",   "Prerequisites",    "What you need before you start", "03", True),
    ("",   "Hello world",      "Your first request",             "04", True),
    ("02", "Architecture",     "Layered system overview",         "05", False),
    ("03", "Concepts",         "Mental model for the framework", "06", False),
    ("04", "Reference",        "API endpoints and parameters",   "08", False),
    ("",   "Authentication",   "Bearer tokens and OAuth",        "08", True),
    ("",   "Endpoints",        "Resource paths and verbs",       "09", True),
    ("05", "Procedures",       "Common operational tasks",       "11", False),
    ("06", "Troubleshooting",  "Problem, symptom, solution",     "13", False),
    ("07", "Glossary",         "Terms and definitions",          "14", False),
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
      <span>{DOC_TYPE.upper()} &nbsp;/&nbsp; {LAST_UPDATED}</span>
    </div>
    <div class="cover-mid">
      <div class="eyebrow">{COVER_EYEBROW}</div>
      <h1 class="title">{COVER_TITLE}</h1>
      <p class="lede">{COVER_LEDE}</p>
      <div style="margin-top:14mm">{version_badge(VERSION, STATUS)}</div>
    </div>
    <div class="cover-bottom">
      <div class="cover-meta">
        <strong>Audience:</strong> {AUDIENCE}<br>
        <strong>Last updated:</strong> {LAST_UPDATED}<br>
        <strong>Status:</strong> {STATUS.upper()}
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
    toc_html = []
    for entry in TOC:
        num, title, deck, page, sub = entry
        cls = ' class="sub"' if sub else ""
        toc_html.append(
            f'<li{cls}><span class="n">{num}</span>'
            f'<span class="t">{title}<span>{deck}</span></span>'
            f'<span class="p">{page}</span></li>'
        )
    meta = metadata_block({
        "Project": PROJECT,
        "Version": version_badge(VERSION, STATUS),
        "Audience": AUDIENCE,
        "Status": STATUS.upper(),
        "Last updated": LAST_UPDATED,
        "Maintainer": "Frontier Cockpit Team, Software Global Black Belt",
    })
    return f"""
<section class="page">
  {runhead(RUNHEAD_TITLE, "Masthead")}
  <div style="padding-top:11mm">
    {kicker("Documentation overview")}
    <h2 class="mt-title">A reading guide for {PROJECT}, structured for developers, architects, and operators.</h2>
    <p class="mt-deck">This documentation is organized into seven sections. Quickstart gets you running in five minutes. Architecture and Concepts give you the mental model. Reference is the lookup table for endpoints and parameters. Procedures, Troubleshooting, and Glossary support day-two operations.</p>
    {meta}
  </div>
  <div class="mt-grid">
    <div>
      <div class="toc-h">Contents</div>
      <ol class="toc-l">{"".join(toc_html)}</ol>
    </div>
    <div>
      {sidebar("How this document is organized", "Each chapter opens with a section header, then the body. Code blocks use dark monospace; inline code is light gray. Admonitions (note, tip, warning, danger) sit inline with the text.")}
      <div style="margin-top:5mm">{sidebar("Conventions", "Required parameters carry a red Required badge. HTTP methods are color-coded (GET blue, POST green, PUT yellow, DELETE red, PATCH brown). File trees, terminal blocks, and code samples all use JetBrains Mono.", accent="g")}</div>
    </div>
  </div>
  {folio(2, "Masthead")}
</section>"""

def page_quickstart() -> str:
    pre_steps = steps([
        step("Install the SDK",
             body("Install the package via your language's package manager.") +
             terminal_block([{"cmd": "pip install agentic-devops", "output": "Successfully installed agentic-devops-1.0.0"}], title="pip")),
        step("Configure credentials",
             body(f"Set the {inline_code('AGENTIC_API_KEY')} environment variable. Or pass it via the SDK constructor.") +
             terminal_block([{"cmd": 'export AGENTIC_API_KEY="your-key-here"', "output": ""}], title="bash")),
        step("Make your first request",
             body("Initialize the client and call the simplest endpoint.") +
             code_block("python", '''from agentic_devops import Client

client = Client()
result = client.ping()
print(result.status)  # "ok"''', filename="hello.py")),
        step("Verify the response",
             body("Run the script. A successful run prints \"ok\".") +
             terminal_block([{"cmd": "python hello.py", "output": "ok"}])),
    ])
    return f"""
<section class="page">
  {runhead(RUNHEAD_TITLE, "Chapter 01, Quickstart")}
  <div style="padding-top:12mm">
    {section_header("Chapter 01", "Quickstart", "Five minutes from zero to your first request.", bar=True)}
    {body("Skip ahead to Architecture if you want the conceptual model first; come back here when you are ready to run code.")}
    {note("This Quickstart assumes you have Python 3.10+ installed and a valid API key. If you need credentials, see the Reference chapter under Authentication.")}
    {h2("Prerequisites")}
    {body("Three things before you begin: Python 3.10 or newer, a valid <code class='inline'>AGENTIC_API_KEY</code>, and network access to the production endpoint.")}
    {h2("Hello world")}
    {pre_steps}
    {tip("Run the verification step every time you upgrade the SDK. The contract for <code class='inline'>ping()</code> is the most stable surface and catches install issues early.")}
  </div>
  {folio(3, "Quickstart")}
</section>"""

def page_architecture() -> str:
    diagram = diagram_card(
        "System architecture",
        "Layered view",
        arch_layered([
            {"name": "Intent",     "desc": "User-facing surface (CLI, SDK, IDE plugin)",
             "color": "#F25022", "items": ["CLI", "SDK", "Plugin"]},
            {"name": "Context",    "desc": "Agent runtime, prompt resolution, tool dispatch",
             "color": "#FFB900", "items": ["Agents", "Tools", "Prompts"]},
            {"name": "Platform",   "desc": "Orchestration, queues, retries, rate limiting",
             "color": "#7FBA00", "items": ["Orchestrator", "Queue", "Cache"]},
            {"name": "Infrastructure", "desc": "Compute, storage, telemetry, runtime protection",
             "color": "#00A4EF", "items": ["Compute", "Storage", "Telemetry"]},
        ])
    )
    return f"""
<section class="page tint">
  {runhead(RUNHEAD_TITLE, "Chapter 02, Architecture")}
  <div style="padding-top:12mm">
    {section_header("Chapter 02", "Architecture", "Four layers, four responsibilities.")}
    {body("Read top to bottom. The Intent layer is what the developer touches; the Infrastructure layer is what runs the workload. Everything in between is convention and configuration.")}
    {diagram}
    {h3("Layer responsibilities")}
    {body("<strong>Intent</strong> exposes verbs the developer can call. <strong>Context</strong> resolves the right agent and the right tool for the verb. <strong>Platform</strong> dispatches the work, retries on failure, enforces quotas. <strong>Infrastructure</strong> runs the compute and stores the result.")}
    {sidebar("Why four layers", "Each layer has one job and one team owning it. The interface between layers is stable. Implementations inside a layer can change without affecting the others.")}
  </div>
  {folio(4, "Architecture")}
</section>"""

def page_reference() -> str:
    params = param_table([
        {"name": "project_id", "type": "string", "required": True,
         "description": "The project identifier. Must be a valid UUID v4."},
        {"name": "model", "type": "string", "required": False, "default": "default",
         "description": "Model alias to invoke. See Models reference for valid values."},
        {"name": "max_tokens", "type": "integer", "required": False, "default": 1024,
         "description": "Upper bound on the response token count. Hard cap at 8192."},
        {"name": "temperature", "type": "number", "required": False, "default": 0.7,
         "description": "Sampling temperature in [0.0, 2.0]. Lower means more deterministic."},
    ])
    return f"""
<section class="page">
  {runhead(RUNHEAD_TITLE, "Chapter 04, Reference")}
  <div style="padding-top:12mm">
    {section_header("Chapter 04", "Reference", "API endpoints, parameters, response codes.")}
    {h2("Endpoints")}
    {endpoint("GET", "/v1/projects/{project_id}", "Retrieve project metadata.")}
    {endpoint("POST", "/v1/projects/{project_id}/runs", "Create a new run.")}
    {endpoint("DELETE", "/v1/projects/{project_id}/runs/{run_id}", "Cancel a running job.")}
    {h2("Request parameters")}
    {params}
    {warning("Setting <code class='inline'>max_tokens</code> above 8192 returns HTTP 400 with code <code class='inline'>params.exceeded</code>. The cap is enforced server-side and cannot be raised via configuration.")}
  </div>
  {folio(5, "Reference")}
</section>"""

def page_troubleshooting() -> str:
    return f"""
<section class="page tint">
  {runhead(RUNHEAD_TITLE, "Chapter 06, Troubleshooting")}
  <div style="padding-top:12mm">
    {section_header("Chapter 06", "Troubleshooting", "Problem, symptom, solution.")}
    {h3("HTTP 401 on every request")}
    {body("Symptom: every API call returns 401 Unauthorized even with a fresh key. Cause: the key is bound to the wrong project. Solution: regenerate the key from the project dashboard and re-export the environment variable in the same shell session.")}
    {danger("Revoking a key invalidates every active token derived from it. If you have production workloads running, rotate first and revoke second, never the reverse.")}
    {h3("Long requests timing out at 30 seconds")}
    {body("Symptom: requests with large prompts hit a hard 30-second timeout. Cause: client-side default timeout. Solution: pass <code class='inline'>timeout=120</code> to the client constructor, or set <code class='inline'>AGENTIC_TIMEOUT=120</code>.")}
    {important("Server-side timeout is 300 seconds. Setting a client timeout above 300 is futile, the server will close the connection first.")}
  </div>
  {folio(6, "Troubleshooting")}
</section>"""

def page_glossary() -> str:
    return f"""
<section class="page">
  {runhead(RUNHEAD_TITLE, "Chapter 07, Glossary")}
  <div style="padding-top:12mm">
    {section_header("Chapter 07", "Glossary", "Terms and definitions.")}
    {glossary([
        ("Agent", "A scoped piece of orchestration that wraps a model, a set of tools, and a system prompt."),
        ("Context", "The runtime layer that resolves agents and tools for a given user intent."),
        ("Endpoint", "An HTTP path that exposes a resource. See Reference chapter for the full list."),
        ("Intent", "What the user wants to do, expressed as a verb the SDK can call."),
        ("PRU", "Platform Resource Unit, the billing unit for compute consumption."),
        ("Run", "A single invocation of an agent against a project, identified by a UUID."),
        ("Project", "The top-level scope for credentials, agents, and runs."),
        ("Token", "A bearer credential or a unit of model input/output, depending on context."),
    ])}
  </div>
  {folio(7, "Glossary")}
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
    <div class="sig">End of documentation &nbsp;·&nbsp; v{VERSION} &nbsp;·&nbsp; {STATUS.upper()}</div>
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
    H.append(page_quickstart())
    H.append(page_architecture())
    H.append(page_reference())
    H.append(page_troubleshooting())
    H.append(page_glossary())
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
