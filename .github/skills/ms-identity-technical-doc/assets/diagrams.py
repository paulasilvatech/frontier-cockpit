"""
ms-identity technical documentation, SVG diagram helpers.

These render architecture, sequence, and flow diagrams as pure inline SVG
(no Graphviz, no Mermaid, no JavaScript). WeasyPrint renders them as vector
inside the final PDF.

Identity rules:
- Microsoft 4-color palette only for accent fills (red, green, blue, yellow)
- Neutral grayscale for connectors and labels
- Inter sans for all labels (no serif)
- All text in viewBox coordinates so it scales with the diagram
"""

PAL = {
    "r": "#F25022", "r7": "#B33816",
    "g": "#7FBA00", "g7": "#5A8500",
    "b": "#00A4EF", "b7": "#0076AC",
    "y": "#FFB900", "y7": "#B88500",
    "ink": "#111111", "ink2": "#333333", "ink3": "#6C6C6C",
    "rule": "#DDD9D2", "paper": "#FFFFFF", "bgc": "#EEF1F4",
}


def _svg(w, h, body):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" '
            f'width="100%" height="100%" font-family="Inter,sans-serif" '
            f'font-size="11">{body}</svg>')


def arch_layered(layers: list, w: int = 720, h: int = 380) -> str:
    """Layered architecture diagram, top-down stack.

    `layers` is a list of dicts:
        {
          'name': 'Display name (e.g., Intent, Context, Platform, Infra)',
          'desc': 'One line description',
          'color': '#F25022',  # accent fill
          'items': ['component1', 'component2', ...],  # boxes inside the row
        }
    Top layer in list is rendered at the top (closest to user).
    """
    pad_l, pad_r, pad_t, pad_b = 24, 24, 24, 24
    iw = w - pad_l - pad_r
    ih = h - pad_t - pad_b
    n = len(layers)
    row_h = ih / n
    row_gap = 6
    inner_h = row_h - row_gap
    out = []
    for i, layer in enumerate(layers):
        y = pad_t + i * row_h + row_gap / 2
        color = layer.get("color", PAL["b"])
        # Background row
        out.append(f'<rect x="{pad_l}" y="{y:.1f}" width="{iw}" '
                   f'height="{inner_h:.1f}" fill="{PAL["paper"]}" '
                   f'stroke="{PAL["rule"]}" stroke-width="1"/>')
        # Left color stripe
        out.append(f'<rect x="{pad_l}" y="{y:.1f}" width="5" '
                   f'height="{inner_h:.1f}" fill="{color}"/>')
        # Name + desc
        cx = pad_l + 18
        out.append(f'<text x="{cx}" y="{y+16:.1f}" '
                   f'fill="{PAL["ink"]}" font-size="13" '
                   f'font-weight="700">{layer["name"]}</text>')
        out.append(f'<text x="{cx}" y="{y+32:.1f}" '
                   f'fill="{PAL["ink2"]}" font-size="10">{layer["desc"]}</text>')
        # Items as small boxes on the right
        items = layer.get("items", [])
        if items:
            box_w = 90
            box_h = 22
            box_gap = 8
            total_w = len(items) * box_w + (len(items) - 1) * box_gap
            start_x = pad_l + iw - total_w - 14
            box_y = y + (inner_h - box_h) / 2
            for j, item in enumerate(items):
                x = start_x + j * (box_w + box_gap)
                out.append(f'<rect x="{x:.1f}" y="{box_y:.1f}" '
                           f'width="{box_w}" height="{box_h}" '
                           f'fill="{color}" opacity="0.12" '
                           f'stroke="{color}" stroke-width="1"/>')
                out.append(f'<text x="{x + box_w/2:.1f}" '
                           f'y="{box_y + box_h/2 + 4:.1f}" '
                           f'text-anchor="middle" font-size="10" '
                           f'fill="{PAL["ink"]}" font-weight="500">{item}</text>')
    return _svg(w, h, "".join(out))


def arch_sequence(actors: list, messages: list, w: int = 720, h: int = 380) -> str:
    """Sequence diagram with actors across the top and time flowing down.

    `actors` is a list of strings (actor names left to right).
    `messages` is a list of dicts:
        {
          'from': 'ActorA',
          'to':   'ActorB',
          'label': 'message label',
          'kind': 'sync' | 'async' | 'return',  # default 'sync'
        }
    """
    pad_l, pad_r, pad_t, pad_b = 30, 30, 50, 30
    iw = w - pad_l - pad_r
    n = len(actors)
    col_w = iw / n
    out = []
    # Actor headers
    actor_x = {}
    for i, a in enumerate(actors):
        cx = pad_l + (i + 0.5) * col_w
        actor_x[a] = cx
        # Box
        out.append(f'<rect x="{cx-50:.1f}" y="{pad_t-30}" width="100" '
                   f'height="24" fill="{PAL["bgc"]}" stroke="{PAL["b"]}" '
                   f'stroke-width="1"/>')
        out.append(f'<text x="{cx:.1f}" y="{pad_t-14}" text-anchor="middle" '
                   f'font-size="11" fill="{PAL["ink"]}" font-weight="600">{a}</text>')
        # Lifeline
        out.append(f'<line x1="{cx:.1f}" y1="{pad_t-6}" '
                   f'x2="{cx:.1f}" y2="{h-pad_b}" stroke="{PAL["ink3"]}" '
                   f'stroke-width="0.6" stroke-dasharray="3,3"/>')
    # Messages
    msg_count = len(messages)
    msg_step = (h - pad_t - pad_b - 14) / max(msg_count, 1)
    for i, m in enumerate(messages):
        y = pad_t + 18 + i * msg_step
        x1 = actor_x[m["from"]]
        x2 = actor_x[m["to"]]
        kind = m.get("kind", "sync")
        color = PAL["b7"] if kind != "return" else PAL["ink3"]
        dash = ' stroke-dasharray="4,3"' if kind == "return" else ""
        # Arrow line
        out.append(f'<line x1="{x1:.1f}" y1="{y:.1f}" x2="{x2:.1f}" '
                   f'y2="{y:.1f}" stroke="{color}" stroke-width="1.3"{dash}/>')
        # Arrowhead at destination
        ax = x2 - 5 if x2 > x1 else x2 + 5
        ay_top = y - 4
        ay_bot = y + 4
        out.append(f'<polygon points="{x2:.1f},{y:.1f} {ax:.1f},{ay_top:.1f} '
                   f'{ax:.1f},{ay_bot:.1f}" fill="{color}"/>')
        # Label centered on the line
        cx = (x1 + x2) / 2
        out.append(f'<text x="{cx:.1f}" y="{y-4:.1f}" text-anchor="middle" '
                   f'font-size="9.5" fill="{PAL["ink2"]}">{m["label"]}</text>')
    return _svg(w, h, "".join(out))


def arch_flow(nodes: list, edges: list, w: int = 720, h: int = 400) -> str:
    """Simple flow/component diagram.

    `nodes` is a list of dicts:
        {
          'id': 'n1',
          'label': 'Node label',
          'x': 0.5,  # 0..1 horizontal position
          'y': 0.5,  # 0..1 vertical position
          'kind': 'box' | 'pill' | 'cylinder',  # default 'box'
          'color': '#F25022',  # accent for left stripe / outline
        }
    `edges` is a list of dicts:
        {'from': 'n1', 'to': 'n2', 'label': 'optional'}
    """
    pad = 30
    iw = w - 2 * pad
    ih = h - 2 * pad
    out = []
    by_id = {}
    box_w = 130
    box_h = 50
    for node in nodes:
        cx = pad + node["x"] * iw
        cy = pad + node["y"] * ih
        x = cx - box_w / 2
        y = cy - box_h / 2
        by_id[node["id"]] = (cx, cy, box_w, box_h)
        color = node.get("color", PAL["b"])
        kind = node.get("kind", "box")
        if kind == "pill":
            rx = box_h / 2
            out.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{box_w}" '
                       f'height="{box_h}" rx="{rx}" ry="{rx}" '
                       f'fill="{PAL["paper"]}" stroke="{color}" stroke-width="1.5"/>')
        elif kind == "cylinder":
            out.append(f'<ellipse cx="{cx:.1f}" cy="{y:.1f}" rx="{box_w/2}" '
                       f'ry="6" fill="{PAL["paper"]}" stroke="{color}" stroke-width="1.5"/>')
            out.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{box_w}" '
                       f'height="{box_h}" fill="{PAL["paper"]}" stroke="{color}" '
                       f'stroke-width="1.5"/>')
            out.append(f'<ellipse cx="{cx:.1f}" cy="{y+box_h:.1f}" rx="{box_w/2}" '
                       f'ry="6" fill="{PAL["paper"]}" stroke="{color}" stroke-width="1.5"/>')
        else:
            out.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{box_w}" '
                       f'height="{box_h}" fill="{PAL["paper"]}" '
                       f'stroke="{PAL["rule"]}" stroke-width="1"/>')
            out.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="5" '
                       f'height="{box_h}" fill="{color}"/>')
        out.append(f'<text x="{cx:.1f}" y="{cy+4:.1f}" text-anchor="middle" '
                   f'font-size="11" fill="{PAL["ink"]}" '
                   f'font-weight="600">{node["label"]}</text>')
    # Draw edges last so they sit between but on top of subtle visuals
    for e in edges:
        cx1, cy1, w1, h1 = by_id[e["from"]]
        cx2, cy2, w2, h2 = by_id[e["to"]]
        # Simple straight line between centers, clipped at box edges horizontally
        if cx2 > cx1:
            sx, ex = cx1 + w1 / 2, cx2 - w2 / 2
        else:
            sx, ex = cx1 - w1 / 2, cx2 + w2 / 2
        sy, ey = cy1, cy2
        out.append(f'<line x1="{sx:.1f}" y1="{sy:.1f}" x2="{ex:.1f}" '
                   f'y2="{ey:.1f}" stroke="{PAL["ink3"]}" stroke-width="1.2"/>')
        # Arrowhead
        if cx2 > cx1:
            ax = ex - 6
        else:
            ax = ex + 6
        out.append(f'<polygon points="{ex:.1f},{ey:.1f} {ax:.1f},{ey-4:.1f} '
                   f'{ax:.1f},{ey+4:.1f}" fill="{PAL["ink3"]}"/>')
        label = e.get("label")
        if label:
            mx = (sx + ex) / 2
            my = (sy + ey) / 2 - 4
            out.append(f'<text x="{mx:.1f}" y="{my:.1f}" text-anchor="middle" '
                       f'font-size="9" fill="{PAL["ink3"]}">{label}</text>')
    return _svg(w, h, "".join(out))
