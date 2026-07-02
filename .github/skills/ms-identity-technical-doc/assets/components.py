"""
ms-identity technical documentation components.

Stateless helpers that emit HTML strings, designed for technical content:
code blocks, inline code, admonitions, file trees, parameter tables,
endpoint blocks, numbered procedure steps, terminal blocks, glossary entries.

Identity rules baked in:
- Microsoft 4-color logo with viewBox 0 0 17 17 (red TL, green TR, blue BL, yellow BR)
- GitHub Octocat with official path
- Inter + JetBrains Mono only
- Microsoft palette + neutral grayscale only
"""
import html as html_module

PAL = {
    "red": "#F25022", "red700": "#B33816",
    "green": "#7FBA00", "green700": "#5A8500",
    "blue": "#00A4EF", "blue700": "#0076AC",
    "yellow": "#FFB900", "yellow700": "#B88500",
    "ink": "#111111", "ink2": "#333333", "ink3": "#6C6C6C",
}

# ===== LOGOS =====

def ms_logo(size: int = 14) -> str:
    """Microsoft 4-color mark, official spec."""
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

def gh_logo(size="14", fill: str = "#FFFFFF") -> str:
    return (
        f'<svg width="{size}" height="{size}" viewBox="0 0 16 16" '
        f'xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
        f'<path fill="{fill}" d="{_GH_PATH}"/></svg>'
    )

# ===== CHROME =====

def runhead(title: str, meta: str) -> str:
    return (f'<div class="runhead">'
            f'<div class="id">{ms_logo(14)}{title}</div>'
            f'<div>{meta}</div></div>')

def folio(num: int, name: str) -> str:
    return f'<div class="folio"><span>{num:02d}</span><span>{name}</span></div>'

# ===== STRUCTURE =====

def section_header(chapter: str, slug: str, headline: str,
                   deck: str = "", bar: bool = False) -> str:
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

def kicker(text: str) -> str:
    return f'<div class="kicker">{text}</div>'

def h2(text: str) -> str:
    return f'<h2 class="h2">{text}</h2>'

def h3(text: str) -> str:
    return f'<h3 class="h3">{text}</h3>'

def h4(text: str) -> str:
    return f'<h4 class="h4">{text}</h4>'

def body(text: str) -> str:
    return f'<p class="body">{text}</p>'

def sidebar(title: str, body: str, accent: str = "blue") -> str:
    cls = "" if accent == "blue" else f" {accent[0]}"
    return f'<div class="side{cls}"><h5>{title}</h5><p>{body}</p></div>'

# ===== INLINE CODE =====

def inline_code(text: str) -> str:
    """Inline monospace code, used inside paragraphs for filenames,
    function names, variable names, environment variables."""
    return f'<code class="inline">{html_module.escape(text)}</code>'

# ===== CODE BLOCK =====

def code_block(language: str, code: str, filename: str = None,
               lineno: bool = False, highlight: dict = None) -> str:
    """Code block with dark background, optional filename header, optional
    line numbers, optional syntax highlight via inline spans.

    `language` is just a label (python, typescript, bash, json, etc).
    `code` is the raw text.
    `filename` shows in the right side of the header.
    `lineno` adds line number gutter.
    `highlight` is an optional dict {line_number: [(start_col, end_col, css_class)]}
    used to wrap parts of lines with classes like 'k' (keyword), 's' (string),
    'c' (comment), 'fn', 'v', 't', 'p'. Most users will pass raw escaped code
    and skip highlighting; for high-fidelity coloring, pre-render the code with
    a Python syntax highlighter that emits these spans.
    """
    safe = html_module.escape(code)
    if lineno:
        lines = safe.split("\n")
        numbered = "\n".join(
            f'<span class="ln">{i+1}</span>{line}'
            for i, line in enumerate(lines)
        )
        body_html = numbered
    else:
        body_html = safe
    header_html = ""
    lang_part = (f'<span class="lang">{html_module.escape(language)}</span>'
                 if language else "")
    file_part = (f'<span class="file">{html_module.escape(filename)}</span>'
                 if filename else "")
    if lang_part or file_part:
        header_html = f'<div class="codeblock-h">{lang_part}{file_part}</div>'
    return f'<div class="codeblock">{header_html}<pre>{body_html}</pre></div>'

# ===== TERMINAL BLOCK =====

def terminal_block(commands_with_output: list, title: str = "Terminal") -> str:
    """Terminal-style block with traffic-light dots header and per-command
    prompt + output rendering.

    `commands_with_output` is a list of dicts: {'cmd': str, 'output': str}.
    The cmd is shown with a green `$ ` prompt prefix; output is shown muted.
    Pass an empty 'output' to skip the response line.
    """
    lines = []
    for entry in commands_with_output:
        cmd = html_module.escape(entry["cmd"])
        out = html_module.escape(entry.get("output", ""))
        lines.append(f'<span class="prompt">$ </span><span class="cmd">{cmd}</span>')
        if out:
            lines.append(f'<span class="out">{out}</span>')
    body = "\n".join(lines)
    title_esc = html_module.escape(title)
    return (f'<div class="terminal">'
            f'<div class="terminal-h">'
            f'<span class="dot"></span><span class="dot y"></span>'
            f'<span class="dot g"></span>{title_esc}'
            f'</div><pre>{body}</pre></div>')

# ===== ADMONITIONS =====

_ADM_ICONS = {
    "note":      "&#9432;",  # ⓘ
    "tip":       "&#9733;",  # ★
    "important": "&#9728;",  # ☀
    "warning":   "&#9888;",  # ⚠
    "danger":    "&#10006;", # ✖
}

def admonition(kind: str, body: str, title: str = None) -> str:
    """Admonition box. kind ∈ {'note','tip','important','warning','danger'}.

    `body` may contain HTML. If `title` is None, uses the kind as the label
    (e.g. NOTE, TIP, IMPORTANT, WARNING, DANGER).
    """
    kind = kind.lower()
    label = (title or kind).upper()
    icon = _ADM_ICONS.get(kind, "&#9432;")
    return (f'<div class="adm {kind}">'
            f'<div class="lbl"><span>{icon}</span>{label}</div>'
            f'<p>{body}</p></div>')

# Convenience aliases
def note(body, title=None): return admonition("note", body, title)
def tip(body, title=None): return admonition("tip", body, title)
def important(body, title=None): return admonition("important", body, title)
def warning(body, title=None): return admonition("warning", body, title)
def danger(body, title=None): return admonition("danger", body, title)

# ===== FILE TREE =====

def file_tree(lines: list) -> str:
    """Render a file tree from a list of strings.

    Each string is a line of the tree. Annotate directories with trailing `/`
    and add inline comments after `# ` if you want them muted.
    Example input:
        [
          "my-project/",
          "├── README.md           # entry point",
          "├── src/",
          "│   ├── app.py",
          "│   └── utils/",
          "│       └── helpers.py",
          "└── tests/"
        ]
    """
    rendered_lines = []
    for ln in lines:
        # Split on " # " for inline annotation
        if " # " in ln:
            code, ann = ln.split(" # ", 1)
            esc_code = html_module.escape(code)
            esc_ann = html_module.escape(ann)
            rendered_lines.append(
                f'{esc_code}<span class="ann">  # {esc_ann}</span>'
            )
        else:
            rendered_lines.append(html_module.escape(ln))
    return f'<div class="tree">{chr(10).join(rendered_lines)}</div>'

# ===== PARAMETER TABLE =====

def param_table(rows: list) -> str:
    """Parameter documentation table.

    `rows` is a list of dicts:
        {
          'name': 'param_name',
          'type': 'string|number|object|...',
          'required': True/False,
          'default': 'default_value or None',
          'description': 'what the param does',
        }
    """
    body_rows = []
    for r in rows:
        name = html_module.escape(r["name"])
        type_str = html_module.escape(r.get("type", ""))
        default = r.get("default")
        default_html = (f'<td class="def">{html_module.escape(str(default))}</td>'
                        if default is not None else '<td class="def">-</td>')
        desc = r.get("description", "")
        badge = ('<span class="req-badge">Required</span>'
                 if r.get("required") else
                 '<span class="opt-badge">Optional</span>')
        body_rows.append(
            f'<tr><td class="name">{name}{badge}</td>'
            f'<td class="type">{type_str}</td>'
            f'{default_html}'
            f'<td>{desc}</td></tr>'
        )
    return (f'<table class="params">'
            f'<thead><tr><th>Parameter</th><th>Type</th><th>Default</th><th>Description</th></tr></thead>'
            f'<tbody>{"".join(body_rows)}</tbody></table>')

# ===== ENDPOINT BLOCK =====

def endpoint(method: str, path: str, description: str = "") -> str:
    """HTTP endpoint header. Method is one of GET/POST/PUT/PATCH/DELETE."""
    m = method.lower()
    cls_map = {"get": "get", "post": "post", "put": "put",
               "delete": "del", "del": "del", "patch": "patch"}
    cls = cls_map.get(m, "get")
    label = method.upper()
    if label == "DEL":
        label = "DELETE"
    desc_html = (f'<span class="desc">{html_module.escape(description)}</span>'
                 if description else "")
    return (f'<div class="endpoint">'
            f'<span class="method {cls}">{label}</span>'
            f'<span class="path">{html_module.escape(path)}</span>'
            f'{desc_html}</div>')

# ===== STEP-BY-STEP PROCEDURE =====

def step(title: str, body_html: str) -> str:
    """One step in a numbered procedure. Numbering is auto via CSS counter.

    `body_html` can contain `<p class="body">`, `code_block()`, `terminal_block()`,
    admonitions, or any inline HTML.
    """
    return (f'<div class="step">'
            f'<div class="num"></div>'
            f'<div class="body"><h4>{title}</h4>{body_html}</div>'
            f'</div>')

def steps(items: list) -> str:
    """Wrap a list of step() outputs in a `.steps` counter container."""
    return f'<div class="steps">{"".join(items)}</div>'

# ===== GLOSSARY =====

def glossary(entries: list) -> str:
    """Two-column glossary.

    `entries` is a list of (term, definition) tuples. Sorted alphabetically
    by term before render.
    """
    sorted_entries = sorted(entries, key=lambda e: e[0].lower())
    parts = []
    for term, defn in sorted_entries:
        parts.append(f'<dt>{term}</dt><dd>{defn}</dd>')
    return f'<dl class="glossary">{"".join(parts)}</dl>'

# ===== CONTRIBUTORS =====

def contributors(people: list) -> str:
    """Pill-style contributors list.

    `people` is a list of (name, role) tuples.
    """
    pills = []
    for name, role in people:
        pills.append(
            f'<span class="person"><strong>{html_module.escape(name)}</strong>'
            f'{html_module.escape(role)}</span>'
        )
    return f'<div class="contrib">{"".join(pills)}</div>'

# ===== VERSION BADGE =====

def version_badge(version: str, status: str = None) -> str:
    """Version badge with optional status (draft, beta, release)."""
    status_cls = f" status-{status.lower()}" if status else ""
    label = f"v{version}"
    if status:
        label = f"v{version} · {status.upper()}"
    return f'<span class="ver-badge{status_cls}">{label}</span>'

# ===== METADATA BLOCK =====

def metadata_block(meta: dict) -> str:
    """Document metadata block: a dl/dt/dd grid.

    `meta` is a dict of label -> value. Order is preserved.
    Common keys: Project, Version, Audience, Status, Last updated,
    Maintainer, Repository, License.
    """
    items = []
    for k, v in meta.items():
        items.append(f'<dt>{html_module.escape(k)}</dt><dd>{v}</dd>')
    return f'<dl class="meta-grid">{"".join(items)}</dl>'

# ===== CHART CARD (reused for diagrams) =====

def diagram_card(title: str, subtitle: str, svg_body: str) -> str:
    """Frame around an architecture or sequence diagram SVG."""
    return (f'<div class="cc">'
            f'<div class="h"><span class="t">{title}</span>'
            f'<span class="s">{subtitle}</span></div>'
            f'<div class="cw">{svg_body}</div></div>')
