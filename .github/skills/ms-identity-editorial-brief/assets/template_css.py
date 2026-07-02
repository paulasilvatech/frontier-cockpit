"""
ms-identity editorial brief CSS, as a Python constant.

The CSS below is the canonical stylesheet used by every brief in this family
(DevServices, Growth, Performance, Portfolio, ZeroToAgents, Top3Impacts,
ConnectFinal). Do not modify the typography, the palette, the cover/close
chrome, or the page grid. The CSS is identity-locked.

What you may change in a new brief:
- nothing structural; all variation lives in the page content, not in the CSS
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
.cover-issue{font-family:var(--fm);font-size:7.5pt;color:#9A9590;
             letter-spacing:0.12em;text-transform:uppercase;line-height:1.9}
.cover-issue strong{color:#FFFFFF}
.cover-by{text-align:right;font-family:var(--fm);font-size:7.5pt;
          color:#9A9590;letter-spacing:0.1em;text-transform:uppercase;line-height:1.9;
          white-space:nowrap;flex-shrink:0}
.cover-by .name{display:block;font-family:var(--fs);font-weight:600;
                font-size:13pt;letter-spacing:-0.02em;color:#FFFFFF;
                text-transform:none;margin-bottom:2mm}
.cover-bar{display:flex;height:6mm;margin-top:8mm}
.cover-bar i{flex:1;display:block;height:6mm}

.mt-title{font-family:var(--fs);font-weight:700;font-size:22pt;
          line-height:1.12;letter-spacing:-0.025em;margin-bottom:5mm;max-width:170mm}
.mt-deck{font-family:var(--fs);font-weight:300;font-size:10.5pt;
         line-height:1.55;color:var(--ink2);max-width:170mm;margin-bottom:6mm}
.mt-grid{display:grid;grid-template-columns:7fr 5fr;gap:8mm;margin-top:4mm}
.toc-h{font-family:var(--fm);font-size:8pt;color:var(--ink3);
       letter-spacing:0.2em;text-transform:uppercase;
       padding-bottom:2.5mm;border-bottom:2px solid var(--ink);margin-bottom:3mm}
.toc-l{list-style:none}
.toc-l li{display:grid;grid-template-columns:9mm 1fr auto;align-items:baseline;
          padding:1.9mm 0;border-bottom:1px solid var(--rule);gap:2mm}
.toc-l .n{font-family:var(--fm);font-size:8pt;color:var(--ink3);letter-spacing:0.12em}
.toc-l .t{font-family:var(--fs);font-size:10.5pt;font-weight:600;color:var(--ink);
          letter-spacing:-0.018em;line-height:1.2}
.toc-l .t span{display:block;font-family:var(--fs);font-size:8.5pt;
               font-weight:400;color:var(--ink3);margin-top:0.4mm;line-height:1.25}
.toc-l .p{font-family:var(--fm);font-size:8.5pt;color:var(--ink);font-weight:500}

.side{background:var(--bgc);padding:6mm 7mm;border-left:3px solid var(--b);break-inside:avoid}
.side h5{font-family:var(--fm);font-size:8.5pt;color:var(--b7);
         letter-spacing:0.16em;text-transform:uppercase;margin-bottom:2.5mm}
.side p{font-size:9.5pt;line-height:1.55;color:var(--ink2)}
.side.r{border-left-color:var(--r)} .side.r h5{color:var(--r7)}
.side.g{border-left-color:var(--g)} .side.g h5{color:var(--g7)}
.side.y{border-left-color:var(--y)} .side.y h5{color:var(--y7)}

.sh{margin-bottom:7mm}
.sh-k{font-family:var(--fm);font-size:8.5pt;color:var(--ink3);
      letter-spacing:0.22em;text-transform:uppercase;margin-bottom:4mm;
      display:flex;align-items:baseline;gap:6mm}
.sh-k .n{color:var(--b7);font-weight:600;font-size:9.5pt;letter-spacing:0.14em}
.sh-h{font-family:var(--fs);font-weight:700;font-size:26pt;
      line-height:1.08;letter-spacing:-0.028em;margin-bottom:5mm;max-width:175mm}
.sh-d{font-family:var(--fs);font-weight:300;font-size:12pt;
      line-height:1.5;color:var(--ink2);max-width:165mm;margin-bottom:6mm}
.sh-bar{display:flex;gap:1.5mm;margin-bottom:8mm}
.sh-bar i{display:block;width:12mm;height:3mm}

.kicker{font-family:var(--fm);font-size:8.5pt;color:var(--b7);
        letter-spacing:0.18em;text-transform:uppercase;margin-bottom:3mm;
        display:inline-flex;align-items:center;gap:6px}
.kicker::before{content:"";width:12px;height:2px;background:var(--b)}
.kicker.r{color:var(--r7)} .kicker.r::before{background:var(--r)}
.kicker.g{color:var(--g7)} .kicker.g::before{background:var(--g)}
.kicker.y{color:var(--y7)} .kicker.y::before{background:var(--y)}

h3.head{font-family:var(--fs);font-weight:600;font-size:15pt;
        line-height:1.2;letter-spacing:-0.018em;margin-bottom:3mm}
p.body{font-size:10pt;line-height:1.6;color:var(--ink2);margin-bottom:3.5mm}

.two-col{column-count:2;column-gap:7mm;column-rule:1px solid var(--rule)}
.two-col p{break-inside:avoid}

.pq{padding:6mm 0;margin:5mm 0;
    border-top:2px solid var(--ink);border-bottom:2px solid var(--ink);break-inside:avoid}
.pq q{font-family:var(--fs);font-weight:600;font-size:17pt;line-height:1.28;
      letter-spacing:-0.022em;color:var(--ink);display:block}
.pq .a{font-family:var(--fm);font-size:8.5pt;color:var(--ink3);
       letter-spacing:0.14em;text-transform:uppercase;margin-top:3mm}

.dstrip{display:grid;grid-template-columns:repeat(4,1fr);gap:2.5mm;margin:4mm 0 5mm}
.dstrip.three{grid-template-columns:repeat(3,1fr)}
.dc{padding:4mm 4.5mm;border-top:3px solid var(--b);background:var(--paper);
    border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);
    border-left:1px solid var(--rule);min-width:0}
.dc.r{border-top-color:var(--r)}
.dc.g{border-top-color:var(--g)}
.dc.y{border-top-color:var(--y)}
.dc .l{font-family:var(--fm);font-size:7.5pt;color:var(--ink3);
       letter-spacing:0.14em;text-transform:uppercase;margin-bottom:2.5mm;line-height:1.3}
.dc .v{font-family:var(--fs);font-weight:700;font-size:24pt;line-height:1;
       letter-spacing:-0.035em;color:var(--ink);font-variant-numeric:tabular-nums}
.dc .s{font-family:var(--fm);font-size:7.5pt;color:var(--ink3);
       margin-top:2.5mm;letter-spacing:0.05em;line-height:1.35}
.dc .t{display:inline-block;padding:1mm 2.5mm;margin-top:2.5mm;
       font-family:var(--fm);font-size:7.5pt;font-weight:600;
       letter-spacing:0.04em;background:#F1F8E3;color:#5A8500}
.dc .t.flat{background:var(--bgw);color:var(--ink2)}

.calls{display:grid;grid-template-columns:1fr 1fr;gap:3mm;margin-top:4mm}
.calls.three{grid-template-columns:repeat(3,1fr)}
.call{padding:5mm 6mm;background:var(--paper);border:1px solid var(--rule);
      border-left:3px solid var(--b);break-inside:avoid}
.call.r{border-left-color:var(--r)}
.call.g{border-left-color:var(--g)}
.call.y{border-left-color:var(--y)}
.call .t{font-family:var(--fm);font-size:7.5pt;color:var(--b7);
         letter-spacing:0.14em;text-transform:uppercase;margin-bottom:2.5mm}
.call.r .t{color:var(--r7)}
.call.g .t{color:var(--g7)}
.call.y .t{color:var(--y7)}
.call h4{font-family:var(--fs);font-weight:600;font-size:11pt;
         line-height:1.28;letter-spacing:-0.012em;margin-bottom:2mm}
.call p{font-size:9pt;line-height:1.5;color:var(--ink2)}

.cc{background:var(--paper);border:1px solid var(--rule);padding:5mm;break-inside:avoid;min-width:0}
.cc .h{display:flex;align-items:baseline;justify-content:space-between;
       margin-bottom:3mm;padding-bottom:2.5mm;border-bottom:1px solid var(--rule);gap:6mm}
.cc .h .t{font-family:var(--fs);font-weight:600;font-size:10.5pt}
.cc .h .s{font-family:var(--fm);font-size:7.5pt;color:var(--ink3);
          letter-spacing:0.1em;text-transform:uppercase;text-align:right}
.cw{position:relative}
.cw svg{display:block;width:100%;height:auto}

.hero-num{display:grid;grid-template-columns:1fr 1.4fr;gap:8mm;margin:4mm 0;align-items:baseline}
.hn-big{font-family:var(--fs);font-weight:800;font-size:64pt;line-height:0.95;
        letter-spacing:-0.05em;color:var(--r);font-variant-numeric:tabular-nums}
.hn-l{font-family:var(--fm);font-size:8.5pt;color:var(--ink3);
      letter-spacing:0.18em;text-transform:uppercase;margin-bottom:2mm}
.hn-t{font-family:var(--fs);font-weight:400;font-size:12pt;line-height:1.55;color:var(--ink2)}

table.ed{width:100%;border-collapse:collapse;font-size:8.5pt}
table.ed thead{border-bottom:2px solid var(--ink)}
table.ed th{padding:2.5mm 1.6mm;text-align:left;font-family:var(--fm);font-size:7.5pt;
            letter-spacing:0.1em;text-transform:uppercase;color:var(--ink2);font-weight:600}
table.ed th.num{text-align:right}
table.ed td{padding:2mm 1.6mm;border-bottom:1px solid var(--rule);color:var(--ink2);vertical-align:top}
table.ed td.num{text-align:right;font-variant-numeric:tabular-nums}
table.ed .c{color:var(--ink);font-weight:500}
table.ed .s{color:var(--ink);font-weight:600;font-variant-numeric:tabular-nums}
table.ed .m{color:var(--ink4)}

ul.bullets{list-style:none;padding:0;margin-bottom:5mm}
ul.bullets li{position:relative;padding-left:7mm;margin-bottom:3mm;
              font-size:10pt;line-height:1.55;color:var(--ink2);break-inside:avoid}
ul.bullets li::before{content:"";position:absolute;left:0;top:7px;
                      width:3mm;height:2px;background:var(--b)}
ul.bullets.r li::before{background:var(--r)}
ul.bullets.g li::before{background:var(--g)}
ul.bullets.y li::before{background:var(--y)}
ul.bullets li strong{color:var(--ink);font-weight:600}

.paste{position:relative;background:var(--bgc);border:1px solid var(--rule);
       border-left:3px solid var(--ink);padding:6mm 7mm;margin-top:4mm;
       font-size:9pt;line-height:1.55;color:var(--ink2);
       white-space:pre-wrap;font-family:var(--fs)}
.paste-h{display:flex;justify-content:space-between;align-items:baseline;
         margin-bottom:3mm;padding-bottom:2.5mm;border-bottom:1px solid var(--rule)}
.paste-h .l{font-family:var(--fm);font-size:8pt;color:var(--ink3);
            letter-spacing:0.14em;text-transform:uppercase;font-weight:600}
.paste-h .c{font-family:var(--fm);font-size:8pt;color:var(--ink3);letter-spacing:0.05em}
.paste-h .c strong{color:var(--ink);font-weight:600;font-variant-numeric:tabular-nums}

.tags{display:flex;flex-wrap:wrap;gap:2mm;margin-top:4mm}
.tag{display:inline-block;padding:1.5mm 4mm;background:var(--paper);border:1px solid var(--rule);
     font-family:var(--fm);font-size:7.5pt;color:var(--ink2);letter-spacing:0.06em}
.tag .l{color:var(--ink3);text-transform:uppercase;letter-spacing:0.12em;
        margin-right:6px;font-weight:600}

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
