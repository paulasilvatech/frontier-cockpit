"""
ms-identity technical documentation CSS, as a Python constant.

Built on the same ms-identity identity tokens as the editorial sibling,
but with technical additions:
- Code blocks (dark background, monospace, optional filename header)
- Inline code (pill style)
- Admonitions (note/tip/important/warning/danger)
- File trees (monospace, indented)
- Parameter tables (compact, with Required badge column)
- Endpoint blocks (HTTP method badge + path + description)
- Step blocks (numbered circle + content)
- Terminal blocks (prompt prefix + output)
- Glossary entries (term + definition pairs)
"""

CSS = """
:root{
  --r:#F25022; --r7:#B33816;
  --g:#7FBA00; --g7:#5A8500;
  --b:#00A4EF; --b7:#0076AC;
  --y:#FFB900; --y7:#B88500;
  --ink:#111111; --ink2:#333333; --ink3:#6C6C6C; --ink4:#9A9A9A;
  --paper:#FFFFFF; --bg:#F4F2EE; --bgw:#ECE7DE; --bgc:#EEF1F4;
  --rule:#DDD9D2;
  --code-bg:#0E1116; --code-ink:#E6E6E3; --code-mute:#8B8E94;
  --inline-bg:#F0EEE9; --inline-ink:#1A1A1A;
  --fs:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;
  --fm:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;
}
*{box-sizing:border-box;margin:0;padding:0}
html{font-size:11pt}
body{font-family:var(--fs);color:var(--ink);background:var(--bg);
     -webkit-font-smoothing:antialiased;print-color-adjust:exact;-webkit-print-color-adjust:exact}

.page{width:210mm;height:297mm;margin:6mm auto;background:var(--paper);
      padding:16mm 16mm 14mm;position:relative;overflow:hidden;
      box-shadow:0 1mm 4mm rgba(0,0,0,.06)}
.page.tint{background:var(--bgw)}
.page.cool{background:var(--bgc)}
.page.dark{background:#0B0B0B;color:#F4F2EE;padding:0}

.runhead{position:absolute;top:8mm;left:16mm;right:16mm;
         display:flex;align-items:center;justify-content:space-between;
         font-family:var(--fm);font-size:7.5pt;color:var(--ink3);
         letter-spacing:0.14em;text-transform:uppercase;line-height:1;
         padding-bottom:3mm;border-bottom:1px solid var(--rule)}
.runhead .id{display:flex;align-items:center;white-space:nowrap;line-height:1;gap:10px}
.runhead .id svg{flex-shrink:0}
.folio{position:absolute;bottom:8mm;left:16mm;right:16mm;
       display:flex;align-items:center;justify-content:space-between;
       font-family:var(--fm);font-size:7.5pt;color:var(--ink3);
       letter-spacing:0.14em;text-transform:uppercase;line-height:1;
       padding-top:3mm;border-top:1px solid var(--rule)}

.cover{position:relative;width:210mm;height:297mm;padding:18mm;
       display:flex;flex-direction:column;justify-content:space-between;
       background:#0B0B0B;color:#F4F2EE}
.cover-top{display:flex;justify-content:space-between;align-items:center;line-height:1.3;
           padding-bottom:6mm;border-bottom:1px solid #232323;
           font-family:var(--fm);font-size:7.5pt;color:#9A9590;
           letter-spacing:0.18em;text-transform:uppercase;gap:14mm}
.cover-top .left{display:flex;align-items:center;white-space:nowrap;gap:10px}
.cover-top svg{flex-shrink:0}
.cover-mid{margin:auto 0;max-width:165mm}
.eyebrow{font-family:var(--fm);font-size:9pt;letter-spacing:0.22em;
         text-transform:uppercase;color:#00A4EF;margin-bottom:14mm;
         display:flex;align-items:center;gap:10mm}
.eyebrow::before{content:"";display:block;width:18mm;height:2px;background:#00A4EF}
h1.title{font-family:var(--fs);font-weight:800;font-size:48pt;
         line-height:1.02;letter-spacing:-0.035em;margin-bottom:10mm}
h1.title em{font-style:italic;color:#FFB900;font-weight:700}
p.lede{font-family:var(--fs);font-weight:300;font-size:13pt;
       line-height:1.55;color:#C7C3BB;max-width:150mm}
.cover-bottom{display:flex;justify-content:space-between;align-items:flex-end;
              padding-top:8mm;border-top:1px solid #232323;gap:18mm}
.cover-meta{font-family:var(--fm);font-size:7.5pt;color:#9A9590;
            letter-spacing:0.12em;text-transform:uppercase;line-height:1.9}
.cover-meta strong{color:#FFFFFF}
.cover-by{text-align:right;font-family:var(--fm);font-size:7.5pt;
          color:#9A9590;letter-spacing:0.1em;text-transform:uppercase;line-height:1.9;
          white-space:nowrap;flex-shrink:0}
.cover-by .name{display:block;font-family:var(--fs);font-weight:600;
                font-size:13pt;letter-spacing:-0.02em;color:#FFFFFF;
                text-transform:none;margin-bottom:2mm}
.cover-bar{display:flex;height:6mm;margin-top:8mm}
.cover-bar i{flex:1;display:block;height:6mm}

/* Version badge (used on cover) */
.ver-badge{display:inline-block;padding:1.5mm 4mm;border:1px solid #00A4EF;
           font-family:var(--fm);font-size:8.5pt;color:#00A4EF;
           letter-spacing:0.12em;text-transform:uppercase;margin-right:3mm}
.ver-badge.status-draft{border-color:#FFB900;color:#FFB900}
.ver-badge.status-beta{border-color:#FFB900;color:#FFB900}
.ver-badge.status-release{border-color:#7FBA00;color:#7FBA00}

/* Masthead and metadata */
.mt-title{font-family:var(--fs);font-weight:700;font-size:22pt;
          line-height:1.12;letter-spacing:-0.025em;margin-bottom:5mm;max-width:170mm}
.mt-deck{font-family:var(--fs);font-weight:300;font-size:10.5pt;
         line-height:1.55;color:var(--ink2);max-width:170mm;margin-bottom:6mm}
.mt-grid{display:grid;grid-template-columns:7fr 5fr;gap:8mm;margin-top:4mm}

.meta-grid{display:grid;grid-template-columns:auto 1fr;gap:2mm 8mm;
           margin-top:4mm;padding-top:4mm;border-top:1px solid var(--rule)}
.meta-grid dt{font-family:var(--fm);font-size:8pt;color:var(--ink3);
              letter-spacing:0.12em;text-transform:uppercase;font-weight:600}
.meta-grid dd{font-family:var(--fs);font-size:9.5pt;color:var(--ink);line-height:1.5}

/* TOC with nested sections */
.toc-h{font-family:var(--fm);font-size:8pt;color:var(--ink3);
       letter-spacing:0.2em;text-transform:uppercase;
       padding-bottom:2.5mm;border-bottom:2px solid var(--ink);margin-bottom:3mm}
.toc-l{list-style:none}
.toc-l li{display:grid;grid-template-columns:9mm 1fr auto;align-items:baseline;
          padding:1.7mm 0;border-bottom:1px solid var(--rule);gap:2mm}
.toc-l li.sub{grid-template-columns:14mm 1fr auto;border-bottom:0;padding:1.2mm 0 0.4mm}
.toc-l .n{font-family:var(--fm);font-size:8pt;color:var(--ink3);letter-spacing:0.12em}
.toc-l .t{font-family:var(--fs);font-size:10.5pt;font-weight:600;color:var(--ink);
          letter-spacing:-0.018em;line-height:1.2}
.toc-l .t span{display:block;font-family:var(--fs);font-size:8.5pt;
               font-weight:400;color:var(--ink3);margin-top:0.4mm;line-height:1.25}
.toc-l li.sub .t{font-size:9.5pt;font-weight:500;color:var(--ink2)}
.toc-l .p{font-family:var(--fm);font-size:8.5pt;color:var(--ink);font-weight:500}

/* Sidebar */
.side{background:var(--bgc);padding:6mm 7mm;border-left:3px solid var(--b);break-inside:avoid}
.side h5{font-family:var(--fm);font-size:8.5pt;color:var(--b7);
         letter-spacing:0.16em;text-transform:uppercase;margin-bottom:2.5mm}
.side p{font-size:9.5pt;line-height:1.55;color:var(--ink2)}
.side.r{border-left-color:var(--r)} .side.r h5{color:var(--r7)}
.side.g{border-left-color:var(--g)} .side.g h5{color:var(--g7)}
.side.y{border-left-color:var(--y)} .side.y h5{color:var(--y7)}

/* Section header */
.sh{margin-bottom:6mm}
.sh-k{font-family:var(--fm);font-size:8.5pt;color:var(--ink3);
      letter-spacing:0.22em;text-transform:uppercase;margin-bottom:4mm;
      display:flex;align-items:baseline;gap:6mm}
.sh-k .n{color:var(--b7);font-weight:600;font-size:9.5pt;letter-spacing:0.14em}
.sh-h{font-family:var(--fs);font-weight:700;font-size:26pt;
      line-height:1.08;letter-spacing:-0.028em;margin-bottom:5mm;max-width:175mm}
.sh-d{font-family:var(--fs);font-weight:300;font-size:11.5pt;
      line-height:1.5;color:var(--ink2);max-width:170mm;margin-bottom:5mm}
.sh-bar{display:flex;gap:1.5mm;margin-bottom:6mm}
.sh-bar i{display:block;width:12mm;height:3mm}

.kicker{font-family:var(--fm);font-size:8.5pt;color:var(--b7);
        letter-spacing:0.18em;text-transform:uppercase;margin-bottom:3mm;
        display:inline-flex;align-items:center;gap:6px}
.kicker::before{content:"";width:12px;height:2px;background:var(--b)}

/* Headings inside a chapter */
h2.h2{font-family:var(--fs);font-weight:700;font-size:16pt;
      line-height:1.25;letter-spacing:-0.02em;color:var(--ink);
      margin:7mm 0 3mm;padding-top:2mm}
h3.h3{font-family:var(--fs);font-weight:600;font-size:13pt;
      line-height:1.3;letter-spacing:-0.015em;color:var(--ink);
      margin:5mm 0 2.5mm}
h4.h4{font-family:var(--fs);font-weight:600;font-size:10.5pt;
      line-height:1.3;letter-spacing:-0.01em;color:var(--ink);
      margin:4mm 0 1.5mm}

p.body{font-size:10pt;line-height:1.6;color:var(--ink2);margin-bottom:3.5mm}
p.body strong{color:var(--ink);font-weight:600}

/* INLINE CODE */
code.inline{font-family:var(--fm);font-size:9.5pt;background:var(--inline-bg);
            color:var(--inline-ink);padding:0.4mm 1.5mm;border-radius:1.5mm;
            border:1px solid var(--rule);white-space:nowrap}

/* CODE BLOCKS */
.codeblock{background:var(--code-bg);border-radius:2mm;overflow:hidden;
           margin:3mm 0 5mm;break-inside:avoid}
.codeblock-h{display:flex;justify-content:space-between;align-items:center;
             padding:2.5mm 5mm;border-bottom:1px solid #1F2329;
             font-family:var(--fm);font-size:7.5pt;color:#8B8E94;
             letter-spacing:0.12em;text-transform:uppercase}
.codeblock-h .lang{color:#00A4EF;font-weight:600}
.codeblock-h .file{color:#E6E6E3}
.codeblock pre{padding:4mm 5mm;font-family:var(--fm);font-size:8.5pt;
               color:var(--code-ink);line-height:1.55;white-space:pre;
               overflow:hidden;tab-size:2}
.codeblock pre .ln{display:inline-block;width:6mm;text-align:right;
                   color:var(--code-mute);margin-right:3mm;user-select:none}
.codeblock pre .k{color:#FF7B72}        /* keyword */
.codeblock pre .s{color:#A5D6FF}        /* string */
.codeblock pre .c{color:#8B949E}        /* comment */
.codeblock pre .n{color:#79C0FF}        /* number */
.codeblock pre .fn{color:#D2A8FF}       /* function name */
.codeblock pre .v{color:#FFA657}        /* variable */
.codeblock pre .t{color:#FFA657}        /* type */
.codeblock pre .p{color:#7EE787}        /* property */

/* TERMINAL BLOCK */
.terminal{background:var(--code-bg);border-radius:2mm;overflow:hidden;
          margin:3mm 0 5mm;break-inside:avoid}
.terminal-h{display:flex;align-items:center;gap:2mm;padding:2.5mm 5mm;
            border-bottom:1px solid #1F2329;font-family:var(--fm);
            font-size:7.5pt;color:#8B8E94;letter-spacing:0.12em;text-transform:uppercase}
.terminal-h .dot{width:2.5mm;height:2.5mm;border-radius:50%;background:#FF5F57}
.terminal-h .dot.y{background:#FEBC2E}
.terminal-h .dot.g{background:#28C840;margin-right:3mm}
.terminal pre{padding:4mm 5mm;font-family:var(--fm);font-size:8.5pt;
              color:var(--code-ink);line-height:1.6;white-space:pre;overflow:hidden}
.terminal pre .prompt{color:#7EE787;font-weight:600;user-select:none}
.terminal pre .cmd{color:#E6E6E3}
.terminal pre .out{color:#8B8E94}
.terminal pre .err{color:#FF7B72}

/* ADMONITIONS */
.adm{padding:5mm 6mm;border-left:4px solid var(--b);background:#F0F7FB;
     margin:4mm 0;break-inside:avoid}
.adm.note{border-left-color:#00A4EF;background:#E5F6FD}
.adm.tip{border-left-color:#7FBA00;background:#F1F8E3}
.adm.important{border-left-color:#FFB900;background:#FFF7E0}
.adm.warning{border-left-color:#F25022;background:#FFF0EB}
.adm.danger{border-left-color:#B33816;background:#FFEDE5}
.adm .lbl{font-family:var(--fm);font-size:7.5pt;letter-spacing:0.14em;
          text-transform:uppercase;font-weight:700;margin-bottom:2mm;display:flex;align-items:center;gap:2mm}
.adm.note .lbl{color:#0076AC}
.adm.tip .lbl{color:#5A8500}
.adm.important .lbl{color:#B88500}
.adm.warning .lbl{color:#B33816}
.adm.danger .lbl{color:#7A1F00}
.adm p{font-size:9.5pt;line-height:1.55;color:var(--ink)}
.adm p + p{margin-top:2mm}

/* FILE TREE */
.tree{background:var(--code-bg);color:var(--code-ink);font-family:var(--fm);
      font-size:8.5pt;line-height:1.6;padding:5mm;border-radius:2mm;
      margin:3mm 0 5mm;white-space:pre;break-inside:avoid}
.tree .dir{color:#79C0FF;font-weight:600}
.tree .file{color:#E6E6E3}
.tree .ann{color:#8B8E94}

/* PARAMETER TABLE */
table.params{width:100%;border-collapse:collapse;font-size:9pt;margin:3mm 0 5mm;break-inside:avoid}
table.params thead{border-bottom:2px solid var(--ink)}
table.params th{padding:2.5mm 2mm;text-align:left;font-family:var(--fm);font-size:7.5pt;
                letter-spacing:0.1em;text-transform:uppercase;color:var(--ink2);font-weight:600}
table.params td{padding:2.5mm 2mm;border-bottom:1px solid var(--rule);
                color:var(--ink2);vertical-align:top;line-height:1.5}
table.params td.name{font-family:var(--fm);color:var(--ink);font-weight:600;font-size:9pt;white-space:nowrap}
table.params td.type{font-family:var(--fm);font-size:8.5pt;color:var(--b7)}
table.params td.def{font-family:var(--fm);font-size:8.5pt;color:var(--ink3)}
.req-badge{display:inline-block;padding:0.3mm 2mm;background:#FFF0EB;color:#B33816;
           font-family:var(--fm);font-size:7pt;letter-spacing:0.08em;text-transform:uppercase;
           font-weight:700;border-radius:1mm;margin-left:2mm}
.opt-badge{display:inline-block;padding:0.3mm 2mm;background:#EEF1F4;color:#6C6C6C;
           font-family:var(--fm);font-size:7pt;letter-spacing:0.08em;text-transform:uppercase;
           font-weight:700;border-radius:1mm;margin-left:2mm}

/* ENDPOINT BLOCK */
.endpoint{display:flex;align-items:center;gap:4mm;padding:3mm 4mm;
          background:var(--paper);border:1px solid var(--rule);
          border-left:3px solid var(--b);margin:3mm 0 2mm;break-inside:avoid}
.endpoint .method{display:inline-block;padding:1mm 3mm;font-family:var(--fm);
                  font-size:8.5pt;font-weight:700;letter-spacing:0.08em;
                  border-radius:1mm;color:#FFFFFF}
.endpoint .method.get{background:#00A4EF}
.endpoint .method.post{background:#7FBA00}
.endpoint .method.put{background:#FFB900;color:#1A1A1A}
.endpoint .method.del{background:#F25022}
.endpoint .method.patch{background:#B88500}
.endpoint .path{font-family:var(--fm);font-size:10pt;color:var(--ink);font-weight:600}
.endpoint .desc{margin-left:auto;font-size:9pt;color:var(--ink2);font-style:italic}

/* STEP BLOCK (numbered procedure) */
.steps{counter-reset:step;margin:4mm 0 5mm}
.step{display:grid;grid-template-columns:14mm 1fr;gap:5mm;padding:4mm 0;
      border-top:1px solid var(--rule);break-inside:avoid}
.step:last-child{border-bottom:1px solid var(--rule)}
.step .num{counter-increment:step;font-family:var(--fs);font-weight:800;
           font-size:24pt;line-height:1;color:var(--b);
           letter-spacing:-0.03em;font-variant-numeric:tabular-nums}
.step .num::before{content:counter(step,decimal-leading-zero)}
.step .body h4{font-family:var(--fs);font-weight:600;font-size:12pt;
                line-height:1.3;letter-spacing:-0.012em;margin-bottom:2mm;color:var(--ink)}
.step .body p{font-size:9.5pt;line-height:1.55;color:var(--ink2);margin-bottom:2mm}
.step .codeblock{margin:2mm 0 0}
.step .terminal{margin:2mm 0 0}

/* GLOSSARY */
.glossary{display:grid;grid-template-columns:1fr 1fr;gap:3mm 8mm;margin-top:4mm}
.glossary dt{font-family:var(--fs);font-weight:600;font-size:10.5pt;
             color:var(--ink);margin-top:3mm;letter-spacing:-0.01em}
.glossary dt code{font-family:var(--fm);font-size:9.5pt;color:var(--b7)}
.glossary dd{font-size:9pt;line-height:1.5;color:var(--ink2)}
.glossary dt:first-child, .glossary dt:nth-child(2){margin-top:0}

/* CHART CARD (reused for diagrams) */
.cc{background:var(--paper);border:1px solid var(--rule);padding:5mm;break-inside:avoid;min-width:0}
.cc .h{display:flex;align-items:baseline;justify-content:space-between;
       margin-bottom:3mm;padding-bottom:2.5mm;border-bottom:1px solid var(--rule);gap:6mm}
.cc .h .t{font-family:var(--fs);font-weight:600;font-size:10.5pt}
.cc .h .s{font-family:var(--fm);font-size:7.5pt;color:var(--ink3);
          letter-spacing:0.1em;text-transform:uppercase;text-align:right}
.cw{position:relative}
.cw svg{display:block;width:100%;height:auto}

/* CONTRIBUTORS STRIP */
.contrib{display:flex;flex-wrap:wrap;gap:3mm;margin-top:4mm}
.contrib .person{padding:2mm 4mm;background:var(--paper);border:1px solid var(--rule);
                 font-family:var(--fm);font-size:8.5pt;color:var(--ink2);letter-spacing:0.04em}
.contrib .person strong{color:var(--ink);font-weight:600;margin-right:4mm;letter-spacing:0}

/* Close */
.close{display:flex;flex-direction:column;align-items:center;justify-content:center;
       text-align:center;width:210mm;height:297mm;padding:24mm}
.close .marks{display:flex;gap:12mm;align-items:center;justify-content:center}
.close .lbl{font-family:var(--fm);font-size:9pt;color:#9A9590;
            letter-spacing:0.22em;text-transform:uppercase;margin-top:6mm;margin-bottom:14mm}
.close .q{font-family:var(--fs);font-weight:500;font-size:22pt;line-height:1.4;
          letter-spacing:-0.025em;max-width:160mm;color:#F4F2EE;margin-bottom:14mm}
.close .rule{width:30mm;height:2px;background:#00A4EF;margin-bottom:8mm}
.close .sig{font-family:var(--fm);font-size:9pt;color:#9A9590;
            letter-spacing:0.2em;text-transform:uppercase}

@page{size:A4;margin:0}
@media print{
  body{background:white}
  .page{margin:0!important;box-shadow:none!important;page-break-after:always}
  .page:last-of-type{page-break-after:auto}
}
"""
