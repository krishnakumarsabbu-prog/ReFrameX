"""Executive assessment report renderer.

Produces a single self-contained HTML document used for two purposes:

  * interactive browser review — search, filters, theme toggle, JSON export
  * print / PDF source — A4 cover page, section page breaks, print palette

Everything is inline (CSS, SVG, JS): no CDN, no external font, no image file,
so the document renders identically in an air-gapped environment and can be
handed to a headless browser for a genuine PDF.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from html import escape
from typing import Any

MEASURES = (
    ("complexity", "Migration Complexity", "#B45309", "#F59E0B"),
    ("confidence", "Assessment Confidence", "#1D4ED8", "#3B82F6"),
    ("readiness", "Migration Readiness", "#047857", "#10B981"),
)

_RING_CIRC = 326.726  # 2 * pi * 52


# --------------------------------------------------------------------------- #
# primitives
# --------------------------------------------------------------------------- #

def _e(value: Any) -> str:
    if value is None:
        return ""
    return escape(str(value))


def _t(value: Any, fallback: str = "—") -> str:
    if value is None or value == "":
        return fallback
    return escape(str(value))


def _n(value: Any, digits: int = 1, suffix: str = "") -> str:
    if value is None or value == "":
        return "—"
    try:
        return f"{float(value):.{digits}f}{suffix}"
    except (TypeError, ValueError):
        return escape(str(value))


def _score(value: Any) -> float | None:
    try:
        return None if value is None else float(value)
    except (TypeError, ValueError):
        return None


def _tone(classification: str | None) -> str:
    v = (classification or "").strip().lower()
    if v == "high":
        return "rose"
    if v in ("medium", "partially ready"):
        return "amber"
    if v in ("low", "ready for detailed planning"):
        return "emerald"
    return "slate"


def _badge(label: Any, tone: str = "slate") -> str:
    return f'<span class="badge t-{tone}">{_e(label)}</span>'


def _ring(value: Any, color: str, caption: str) -> str:
    v = _score(value)
    shown = 0.0 if v is None else max(0.0, min(100.0, v))
    offset = _RING_CIRC * (1.0 - shown / 100.0)
    return (
        f'<div class="ring" role="img" aria-label="{escape(caption)} {_n(value, 1)} of 100">'
        f'<svg viewBox="0 0 120 120">'
        f'<circle class="ring-bg" cx="60" cy="60" r="52"/>'
        f'<circle class="ring-fg" cx="60" cy="60" r="52" stroke="{color}" '
        f'stroke-dasharray="{_RING_CIRC:.3f}" stroke-dashoffset="{offset:.2f}"/>'
        f"</svg>"
        f'<div class="ring-txt"><b>{_n(value, 1)}</b><small>/ 100</small></div>'
        f"</div>"
    )


def _meter(value: Any, color: str) -> str:
    v = _score(value)
    width = 0.0 if v is None else max(0.0, min(100.0, v))
    return f'<div class="meter"><i style="width:{width:.1f}%;background:{color}"></i></div>'


def _table(headers: list[str], rows: list[list[str]], cls: str = "", empty: str = "No records.") -> str:
    if not rows:
        return f'<p class="empty">{_e(empty)}</p>'
    head = "".join(f"<th>{h}</th>" for h in headers)
    body = "".join("<tr>" + "".join(f"<td>{c}</td>" for c in row) + "</tr>" for row in rows)
    return f'<div class="tw"><table class="{cls}"><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table></div>'


def _dist(mapping: dict | None, color: str, empty: str = "No data recorded.") -> str:
    items = [(str(k), v) for k, v in (mapping or {}).items() if v]
    if not items:
        return f'<p class="empty">{_e(empty)}</p>'
    peak = max(v for _, v in items) or 1
    out = []
    for key, val in sorted(items, key=lambda kv: -kv[1]):
        pct = 100.0 * val / peak
        out.append(
            f'<div class="drow"><span class="dl" title="{_e(key)}">{_e(key)}</span>'
            f'<span class="dbar"><i style="width:{pct:.1f}%;background:{color}"></i></span>'
            f'<span class="dv">{_e(val)}</span></div>'
        )
    return "".join(out)


def _card(title_html: str, body_html: str, cls: str = "") -> str:
    head = f'<div class="card-h">{title_html}</div>' if title_html else ""
    return f'<div class="card {cls}">{head}{body_html}</div>'


def _section(num: str, sec_id: str, kicker: str, title: str, lede: str, body: str, page: bool = True) -> str:
    cls = "sec page-break" if page else "sec"
    lead = f'<p class="sec-lede">{lede}</p>' if lede else ""
    return (
        f'<section class="{cls}" id="{sec_id}">'
        f'<div class="sec-head"><div class="sec-num">{num}</div>'
        f'<div class="sec-title"><div class="sec-kicker">{kicker}</div>'
        f"<h2>{title}</h2></div></div>{lead}{body}</section>"
    )


def _bullets(items: list, cls: str = "") -> str:
    if not items:
        return '<p class="empty">Nothing recorded.</p>'
    return f'<ul class="bullets {cls}">' + "".join(f"<li>{_e(i)}</li>" for i in items) + "</ul>"


# --------------------------------------------------------------------------- #
# styles
# --------------------------------------------------------------------------- #

_CSS = """
:root{
  --bg:#F5F6F8; --bg-2:#EDEFF3; --card:#FFFFFF; --tint:#F7F8FA;
  --ink:#0B1220; --ink-2:#33415C; --muted:#64748B; --faint:#94A3B8;
  --line:#E4E7EC; --line-2:#D0D5DD;
  --indigo:#4F46E5; --indigo-d:#3730A3; --blue:#2563EB; --amber:#B45309;
  --emerald:#047857; --rose:#BE123C; --violet:#7C3AED;
  --shadow:0 1px 2px rgba(11,18,32,.04), 0 12px 32px -20px rgba(11,18,32,.35);
  --sans:"Segoe UI Variable Text","Segoe UI",-apple-system,BlinkMacSystemFont,Roboto,"Helvetica Neue",Arial,sans-serif;
  --mono:"JetBrains Mono","Cascadia Mono",Consolas,"SF Mono",Menlo,monospace;
  --radius:14px;
}
html.dark{
  --bg:#080C14; --bg-2:#0E1420; --card:#111A2B; --tint:#162034;
  --ink:#F2F5FA; --ink-2:#CBD5E1; --muted:#94A3B8; --faint:#64748B;
  --line:#233047; --line-2:#2E3C55;
  --shadow:0 1px 2px rgba(0,0,0,.35), 0 16px 40px -24px rgba(0,0,0,.8);
}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);font-size:13.5px;line-height:1.55;-webkit-font-smoothing:antialiased}
h1,h2,h3,h4{margin:0;font-weight:750;letter-spacing:-.015em}
p{margin:0}
code,.mono{font-family:var(--mono);font-size:.92em}
a{color:var(--blue);text-decoration:none}

/* ---------- top bar ---------- */
.topbar{position:sticky;top:0;z-index:60;background:color-mix(in srgb,var(--card) 88%,transparent);backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}
.topbar-in{max-width:1280px;margin:0 auto;display:flex;align-items:center;gap:16px;padding:10px 22px;flex-wrap:wrap}
.brand{display:flex;align-items:center;gap:10px;margin-right:auto}
.mark{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;color:#fff;font-family:var(--mono);font-weight:800;font-size:13px;letter-spacing:.06em;background:linear-gradient(135deg,#4F46E5 0%,#2563EB 100%);box-shadow:0 6px 16px -6px rgba(79,70,229,.8)}
.brand-name{font-size:14.5px;font-weight:800;letter-spacing:-.02em;line-height:1.1}
.brand-sub{font-family:var(--mono);font-size:8.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}
.search{position:relative;flex:1;min-width:220px;max-width:420px}
.search input{width:100%;padding:8px 12px 8px 32px;border-radius:10px;border:1px solid var(--line-2);background:var(--tint);color:var(--ink);font:inherit;font-size:12.5px;outline:none}
.search input:focus{border-color:var(--indigo);box-shadow:0 0 0 3px rgba(79,70,229,.16)}
.search svg{position:absolute;left:10px;top:50%;transform:translateY(-50%);width:14px;height:14px;stroke:var(--muted)}
.actions{display:flex;gap:8px;flex-wrap:wrap}
.btn{display:inline-flex;align-items:center;gap:6px;padding:8px 13px;border-radius:10px;border:1px solid var(--line-2);background:var(--card);color:var(--ink);font:inherit;font-size:12px;font-weight:650;cursor:pointer;transition:.15s}
.btn:hover{border-color:var(--indigo);color:var(--indigo)}
.btn-solid{background:linear-gradient(135deg,#4F46E5,#2563EB);border-color:transparent;color:#fff;box-shadow:0 6px 16px -8px rgba(37,99,235,.9)}
.btn-solid:hover{color:#fff;filter:brightness(1.06)}

/* ---------- shell ---------- */
.shell{max-width:1280px;margin:0 auto;padding:26px 22px 70px;display:grid;grid-template-columns:212px minmax(0,1fr);gap:34px;align-items:start}
.toc{position:sticky;top:74px;border-left:1px solid var(--line);padding-left:14px}
.toc-h{font-family:var(--mono);font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:var(--faint);margin-bottom:10px}
.toc a{display:flex;gap:8px;padding:4px 0;font-size:11.5px;color:var(--muted);line-height:1.35}
.toc a b{font-family:var(--mono);font-size:9.5px;color:var(--faint);font-weight:700;padding-top:1px}
.toc a:hover{color:var(--indigo)}
main{display:flex;flex-direction:column;gap:22px;min-width:0}

/* ---------- cover ---------- */
.cover{position:relative;overflow:hidden;border-radius:20px;padding:34px 36px 30px;color:#EAEFFF;background:radial-gradient(1200px 500px at 88% -10%,rgba(99,102,241,.55),transparent 60%),radial-gradient(700px 420px at 5% 110%,rgba(37,99,235,.35),transparent 65%),linear-gradient(150deg,#080C16 0%,#101A33 48%,#0A1020 100%);box-shadow:0 30px 70px -40px rgba(8,12,22,.9)}
.cover:before{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px);background-size:38px 38px;mask-image:radial-gradient(80% 70% at 70% 0%,#000,transparent);pointer-events:none}
.cover>*{position:relative}
.cover-top{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap}
.cover .brand-name{color:#fff;font-size:16px}
.cover .brand-sub{color:#93A4C6}
.cover .mark{width:38px;height:38px;font-size:14px;background:linear-gradient(135deg,#6366F1,#3B82F6);box-shadow:0 10px 26px -10px #4F46E5}
.chip{font-family:var(--mono);font-size:9px;letter-spacing:.14em;text-transform:uppercase;padding:6px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.07);color:#C7D2FE}
.cover-eyebrow{margin-top:34px;font-family:var(--mono);font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:#8FA6FF}
.cover h1{margin-top:12px;font-size:35px;line-height:1.1;letter-spacing:-.03em;color:#fff;max-width:20ch}
@media(max-width:900px){.cover-main{grid-template-columns:1fr}}
.cover h1 em{font-style:normal;background:linear-gradient(90deg,#A5B4FC,#60A5FA);-webkit-background-clip:text;background-clip:text;color:transparent}
.cover-lede{margin-top:14px;max-width:62ch;color:#B7C4E0;font-size:13px}
.cover-main{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(230px,.8fr);gap:32px;align-items:start;margin-top:28px}
.cover-scores{display:grid;grid-template-columns:1fr;gap:9px}
.cscore{border:1px solid rgba(255,255,255,.14);border-radius:12px;padding:11px 13px;background:rgba(255,255,255,.05)}
.cscore span{display:block;font-family:var(--mono);font-size:8.5px;letter-spacing:.14em;text-transform:uppercase;color:#8FA6FF}
.cscore .row{display:flex;align-items:baseline;gap:8px;justify-content:space-between}
.cscore b{font-size:23px;line-height:1.2;color:#fff;letter-spacing:-.02em}
.cscore small{font-size:10px;color:#B7C4E0;text-align:right}
.cscore .meter{margin-top:7px;background:rgba(255,255,255,.14)}
.cover-meta{margin-top:26px;display:grid;grid-template-columns:repeat(auto-fit,minmax(184px,1fr));gap:14px 22px;border-top:1px solid rgba(255,255,255,.12);padding-top:18px}
.cover-meta dt{font-family:var(--mono);font-size:8.5px;letter-spacing:.13em;text-transform:uppercase;color:#7E90B4}
.cover-meta dd{margin:3px 0 0;font-size:12px;font-weight:650;color:#E7ECFA;word-break:break-word}
.cover-foot{margin-top:24px;display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;font-size:10px;color:#8FA0C2}

/* ---------- section chrome ---------- */
.sec,.cover{scroll-margin-top:78px}
.sec{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:26px 26px 24px;box-shadow:var(--shadow)}
.sec-head{display:flex;gap:14px;align-items:flex-start}
.sec-num{font-family:var(--mono);font-size:11px;font-weight:800;color:var(--indigo);background:color-mix(in srgb,var(--indigo) 10%,transparent);border:1px solid color-mix(in srgb,var(--indigo) 28%,transparent);border-radius:8px;padding:5px 8px;line-height:1}
.sec-kicker{font-family:var(--mono);font-size:9px;letter-spacing:.17em;text-transform:uppercase;color:var(--faint)}
.sec-title h2{font-size:20px;margin-top:3px;letter-spacing:-.02em}
.sec-lede{margin:12px 0 0 52px;color:var(--muted);max-width:88ch;font-size:12.5px}
.sec>*+*{margin-top:18px}

/* ---------- layout helpers ---------- */
.grid{display:grid;gap:14px}
.g2{grid-template-columns:repeat(auto-fit,minmax(300px,1fr))}
.g3{grid-template-columns:repeat(auto-fit,minmax(215px,1fr))}
.g4{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}
.card{border:1px solid var(--line);border-radius:12px;background:var(--card);padding:16px}
.card.tint{background:var(--tint)}
.card-h{font-family:var(--mono);font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin-bottom:10px;display:flex;justify-content:space-between;gap:10px;align-items:center}
.card-h h3{font-family:var(--sans);font-size:13px;letter-spacing:-.01em;text-transform:none;color:var(--ink)}
.bullets{margin:0;padding-left:17px;color:var(--ink-2);font-size:12px}
.bullets li{margin:4px 0}
.bullets.plain{padding-left:0;list-style:none}
.empty{color:var(--faint);font-size:12px;font-style:italic}

/* ---------- dashboard ---------- */
.hero{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:14px}
.scorecard{border:1px solid var(--line);border-radius:12px;padding:16px;background:linear-gradient(180deg,var(--card),var(--tint));display:flex;gap:16px;align-items:center}
.scorecard .meta{min-width:0}
.scorecard .lbl{font-family:var(--mono);font-size:8.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.scorecard .cls{font-size:17px;font-weight:800;letter-spacing:-.02em;margin-top:2px}
.scorecard .q{font-size:11px;color:var(--muted);margin-top:3px}
.scorecard .fm{font-family:var(--mono);font-size:9.5px;color:var(--faint);margin-top:7px}
.ring{position:relative;width:86px;height:86px;flex:0 0 86px}
.ring svg{width:100%;height:100%;transform:rotate(-90deg)}
.ring-bg{fill:none;stroke:var(--bg-2);stroke-width:9}
.ring-fg{fill:none;stroke-width:9;stroke-linecap:round}
.ring-txt{position:absolute;inset:0;display:grid;place-content:center;text-align:center;font-family:var(--mono)}
.ring-txt b{font-size:18px;letter-spacing:-.03em}
.ring-txt small{font-size:8px;color:var(--faint)}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px}
.kpi{border:1px solid var(--line);border-radius:11px;padding:11px 12px;background:var(--tint)}
.kpi span{display:block;font-family:var(--mono);font-size:8.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.kpi b{display:block;font-size:19px;line-height:1.25;letter-spacing:-.02em}
.kpi small{color:var(--faint);font-size:10px}
.lede{font-size:13px;color:var(--ink-2);line-height:1.68}
.lede+.lede{margin-top:10px}
.callout{border-left:3px solid var(--indigo);background:color-mix(in srgb,var(--indigo) 7%,transparent);border-radius:0 10px 10px 0;padding:12px 14px;font-size:12.5px;color:var(--ink-2)}
.callout b{color:var(--ink)}

/* ---------- pipeline ---------- */
.flow{display:grid;grid-template-columns:repeat(auto-fit,minmax(215px,1fr));gap:10px}
.step{border:1px solid var(--line);border-radius:11px;padding:12px;background:var(--tint);position:relative}
.step .sn{font-family:var(--mono);font-size:9px;font-weight:800;color:var(--indigo);letter-spacing:.1em}
.step h4{font-size:12px;margin-top:3px}
.step p{font-size:11px;color:var(--muted);margin-top:4px;line-height:1.5}

/* ---------- domain cards ---------- */
.dom{border:1px solid var(--line);border-radius:12px;padding:14px;background:var(--card);display:flex;flex-direction:column;gap:10px}
.dom-h{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
.dom-h h4{font-size:12.5px;letter-spacing:-.01em}
.wchip{font-family:var(--mono);font-size:9px;font-weight:700;padding:3px 6px;border-radius:6px;background:color-mix(in srgb,var(--indigo) 10%,transparent);color:var(--indigo);border:1px solid color-mix(in srgb,var(--indigo) 25%,transparent);white-space:nowrap}
.mrow{display:grid;grid-template-columns:64px 1fr 38px;gap:8px;align-items:center;font-size:10.5px}
.mrow .ml{font-family:var(--mono);font-size:8.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.mrow .mv{font-family:var(--mono);font-weight:700;text-align:right}
.meter{display:block;height:6px;border-radius:99px;background:var(--bg-2);overflow:hidden}
.meter i{display:block;height:100%;border-radius:99px}
.factors{font-size:10.5px;color:var(--muted);border-top:1px dashed var(--line);padding-top:8px}
.factors ul{margin:3px 0 0;padding-left:14px}
.factors li{margin:1px 0}

/* ---------- tables ---------- */
.tw{overflow-x:auto;border:1px solid var(--line);border-radius:11px}
table{width:100%;border-collapse:collapse;font-size:11.5px}
thead th{background:var(--tint);text-align:left;padding:8px 10px;font-family:var(--mono);font-size:8.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);border-bottom:1px solid var(--line);white-space:nowrap;position:sticky;top:0}
tbody td{padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top;color:var(--ink-2)}
tbody tr:last-child td{border-bottom:none}
tbody tr:hover td{background:var(--tint)}
td strong{color:var(--ink)}
.scroll{max-height:360px;overflow:auto}
.badge{display:inline-block;padding:2px 6px;border-radius:5px;font-family:var(--mono);font-size:8.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;border:1px solid transparent;white-space:nowrap}
.t-rose{background:rgba(190,18,60,.1);color:var(--rose);border-color:rgba(190,18,60,.25)}
.t-amber{background:rgba(180,83,9,.1);color:var(--amber);border-color:rgba(180,83,9,.25)}
.t-emerald{background:rgba(4,120,87,.1);color:var(--emerald);border-color:rgba(4,120,87,.25)}
.t-blue{background:rgba(37,99,235,.1);color:var(--blue);border-color:rgba(37,99,235,.25)}
.t-violet{background:rgba(124,58,237,.1);color:var(--violet);border-color:rgba(124,58,237,.25)}
.t-slate{background:var(--bg-2);color:var(--muted);border-color:var(--line-2)}

/* ---------- risk cards ---------- */
.risk{border:1px solid var(--line);border-left:3px solid var(--faint);border-radius:11px;padding:12px 14px;background:var(--card);margin-bottom:9px}
.risk.high{border-left-color:var(--rose)}
.risk.medium{border-left-color:var(--amber)}
.risk-h{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center}
.risk-h h4{font-size:12.5px}
.risk-meta{display:flex;gap:5px;align-items:center;flex-wrap:wrap;font-family:var(--mono);font-size:9px;color:var(--faint)}
.risk p{font-size:11.5px;color:var(--ink-2);margin-top:6px}
.risk .fix{margin-top:8px;font-size:11px;color:var(--emerald);background:rgba(4,120,87,.07);border:1px solid rgba(4,120,87,.2);border-radius:8px;padding:7px 10px}

/* ---------- distributions ---------- */
.drow{display:grid;grid-template-columns:minmax(80px,30%) 1fr 34px;gap:8px;align-items:center;font-size:11px;margin:5px 0}
.dl{color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--mono);font-size:9.5px}
.dbar{height:6px;border-radius:99px;background:var(--bg-2);overflow:hidden}
.dbar i{display:block;height:100%;border-radius:99px}
.dv{text-align:right;font-family:var(--mono);font-weight:700;font-size:10px;color:var(--ink-2)}

/* ---------- details ---------- */
details{border:1px solid var(--line);border-radius:11px;background:var(--tint);padding:0}
details+details{margin-top:8px}
summary{cursor:pointer;padding:10px 13px;font-size:11.5px;font-weight:650;color:var(--ink-2);list-style:none;display:flex;justify-content:space-between;gap:10px}
summary::-webkit-details-marker{display:none}
summary:after{content:"+";font-family:var(--mono);color:var(--faint)}
details[open] summary:after{content:"–"}
details .dbody{padding:0 13px 12px;font-size:11.5px;color:var(--muted)}

/* ---------- footer ---------- */
.foot{border-top:1px solid var(--line);padding-top:16px;color:var(--faint);font-size:10.5px;display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap}

/* =========================== PRINT / PDF ================================ */
@page{size:A4;margin:13mm 12mm 14mm}
@media print{
  html,html.dark{
    --bg:#fff;--bg-2:#EEF1F5;--card:#fff;--tint:#F7F8FA;--ink:#0B1220;--ink-2:#33415C;
    --muted:#5B6B82;--faint:#7C8AA0;--line:#DDE2E9;--line-2:#C6CEDA;--shadow:none;
  }
  body{background:#fff !important;font-size:9.4pt;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .topbar,.toc,.no-print,.search,.actions{display:none !important}
  .shell{display:block;max-width:100%;padding:0;margin:0}
  main{gap:0}
  .sec{box-shadow:none;border:none;border-radius:0;padding:0;margin:0}
  .sec.page-break{break-before:page;page-break-before:always}
  .sec+.sec{margin-top:0}
  .sec>*+*{margin-top:6mm}
  .sec-title h2{font-size:15pt}
  .sec-lede{margin-left:0;font-size:9pt}
  .cover{break-after:page;page-break-after:always;border-radius:0;padding:18mm 14mm;min-height:258mm;display:flex;flex-direction:column;justify-content:space-between}
  .cover h1{font-size:26pt;max-width:22ch}
  .cover-eyebrow{margin-top:12mm}
  .cover-main{grid-template-columns:1.15fr .85fr;gap:10mm;margin-top:10mm}
  .cover-scores{break-inside:avoid}
  .cover-meta{break-inside:avoid}
  .card,.dom,.risk,.kpi,.scorecard,.step,table,details,.callout{break-inside:avoid;page-break-inside:avoid}
  .scroll{max-height:none;overflow:visible}
  .tw{overflow:visible}
  thead th{position:static}
  table{font-size:8.4pt}
  tbody td{padding:5px 7px}
  .hero{grid-template-columns:repeat(3,1fr)}
  .dom,.card,.sec{background:#fff}
  details{break-inside:avoid}
  details:not([open]) .dbody{display:block}
  .risk .fix{background:#F3FBF7}
  a{color:inherit;text-decoration:none}
}
"""


# --------------------------------------------------------------------------- #
# section renderers
# --------------------------------------------------------------------------- #

def _cover(report: dict, app_name: str, app_id: str, stamp: str) -> str:
    s = report.get("executive_summary") or {}
    o = report.get("application_overview") or {}
    v = report.get("versions") or {}
    m = report.get("methodology") or {}
    rs = m.get("ruleset") or {}

    scores = []
    for key, label, dark, light in MEASURES:
        cls = s.get(f"{key}_classification") or "Not assessed"
        scores.append(
            f'<div class="cscore"><span>{label}</span>'
            f'<div class="row"><b>{_n(s.get(f"{key}_score"), 1)}</b>'
            f"<small>{_e(cls)}</small></div>"
            f"{_meter(s.get(f'{key}_score'), light)}</div>"
        )

    meta = [
        ("Target application", _t(o.get("name") or app_name)),
        ("Application id", _t(app_id)),
        ("Business domain", _t(o.get("business_domain"))),
        ("Technology stack", _t(o.get("technology_stack"))),
        ("Owner", _t(o.get("owner"))),
        ("Environment", _t(o.get("environment"))),
        ("Generated", _e(stamp)),
        ("Assessment version", _t(s.get("assessment_version"))),
        ("Ruleset", f"{_t(rs.get('id'))} · v{_t(rs.get('version'))}"),
        ("Engine", _t(v.get("model_version"))),
        ("Rules evaluated", _t((m.get("rules") or {}).get("total"))),
        ("Determinism", "Rules-only · no sampling"),
    ]
    meta_html = "".join(f"<div><dt>{k}</dt><dd>{val}</dd></div>" for k, val in meta)

    return f"""<header class="cover" id="cover">
  <div class="cover-top">
    <div class="brand"><div class="mark">RX</div>
      <div><div class="brand-name">ReFrameX</div><div class="brand-sub">Migration Intelligence</div></div>
    </div>
    <div class="chip">Confidential · Architecture Review</div>
  </div>
  <div class="cover-main">
    <div>
      <div class="cover-eyebrow">Mainframe-to-Open · Executive Assessment</div>
      <h1>Application Modernization <em>Assessment Report</em></h1>
      <p class="cover-lede">A deterministic, evidence-linked appraisal of <strong>{_e(app_name)}</strong>:
      every score in this document traces back to a rule, a file and a line range. Nothing here is
      estimated, sampled or generated stochastically.</p>
    </div>
    <div class="cover-scores">{''.join(scores)}</div>
  </div>
  <div>
    <div class="cover-meta">{meta_html}</div>
    <div class="cover-foot">
      <span>Prepared for the Technical Steering Committee and Enterprise Architecture Review.</span>
      <span class="mono">reframex-executive-report-v3 · {_e(stamp)}</span>
    </div>
  </div>
</header>"""


def _narrative(report: dict) -> str:
    s = report.get("executive_summary") or {}
    doms = report.get("domain_assessments") or {}
    gaps = report.get("evidence_gaps") or {}
    risks = report.get("major_risks") or {}
    deps = report.get("dependency_analysis") or {}
    inv = report.get("artifact_inventory") or {}

    if not s.get("has_assessment"):
        return ('<p class="lede">No assessment has been recorded for this application yet. '
                'The inventory sections below describe what was ingested; the scoring sections will '
                'populate as soon as an assessment run completes.</p>')

    evidenced, ranked = [], []
    for key, data in doms.items():
        cx = (data or {}).get("complexity") or {}
        if cx.get("has_evidence"):
            evidenced.append((data.get("label") or key, _score(cx.get("score"))))
    ranked = sorted([e for e in evidenced if e[1] is not None], key=lambda kv: -kv[1])

    top = ranked[:3]
    top_txt = ", ".join(f"{_e(name)} ({_n(score, 1)})" for name, score in top) if top else "no domain"

    p1 = (
        f'<p class="lede"><b>{_t(s.get("application_name"))}</b> scores '
        f'<b>{_n(s.get("complexity_score"), 1)}</b> on migration complexity '
        f'({_e(s.get("complexity_classification"))}), '
        f'<b>{_n(s.get("confidence_score"), 1)}</b> on assessment confidence '
        f'({_e(s.get("confidence_classification"))}) and '
        f'<b>{_n(s.get("readiness_score"), 1)}</b> on migration readiness '
        f'({_e(s.get("readiness_classification"))}). '
        f'The evidence base is {_t(s.get("artifact_count"))} artifacts, '
        f'{_t(s.get("component_count"))} normalized components and '
        f'{_t(s.get("dependency_count"))} dependency edges, producing '
        f'{_t(s.get("finding_count"))} findings. '
        f'{len(evidenced)} of 8 assessment domains produced evidence.</p>'
    )

    p2 = (
        f'<p class="lede">Complexity is carried by {top_txt}. '
        f'Where a domain shows no score, the reason is missing material rather than absent risk — '
        f'this engine never treats an unseen area as a simple one. '
        f'{_t(risks.get("high_severity_count"))} high-severity and '
        f'{_t(risks.get("medium_severity_count"))} medium-severity risks are registered, and '
        f'{_t(gaps.get("total_unknown_findings"))} findings are classified Unknown, '
        f'each of which must be closed before a migration decision is finalised.</p>'
    )

    unsupported = len(gaps.get("unsupported_artifacts") or [])
    unresolved = deps.get("unresolved_targets") or 0
    p3 = (
        f'<p class="lede">Coverage caveats: {unsupported} artifact(s) are unsupported or detect-only, '
        f'{unresolved} dependency target(s) could not be resolved, and '
        f'{_t((inv.get("by_parse_status") or {}).get("failed"))} artifact(s) failed to parse. '
        f'These depress confidence by construction rather than by opinion.</p>'
    )

    steps = (report.get("prioritized_next_steps") or {}).get("assessment_recommended_steps") or []
    first = steps[0] if steps else None
    close = (
        f'<div class="callout"><b>Suggested first action.</b> {_e(first)}</div>'
        if first else
        '<div class="callout"><b>Suggested first action.</b> Supply the missing artifact '
        'categories listed under Evidence Gaps, then re-run the assessment.</div>'
    )
    return p1 + p2 + p3 + close


def _dashboard(report: dict) -> str:
    s = report.get("executive_summary") or {}
    m = report.get("methodology") or {}
    mdefs = m.get("measures") or {}

    cards = []
    for key, label, dark, _light in MEASURES:
        d = mdefs.get(key) or {}
        cards.append(
            f'<div class="scorecard">'
            f"{_ring(s.get(f'{key}_score'), dark, label)}"
            f'<div class="meta"><div class="lbl">{label}</div>'
            f'<div class="cls">{_e(s.get(f"{key}_classification") or "Not assessed")}</div>'
            f'<div class="q">{_e(d.get("question") or "")}</div>'
            f'<div class="fm">{_e(d.get("formula") or "")}</div>'
            f"</div></div>"
        )

    kpis = [
        ("Artifacts", _t(s.get("artifact_count")), "ingested"),
        ("Components", _t(s.get("component_count")), "normalized"),
        ("Dependencies", _t(s.get("dependency_count")), "resolved edges"),
        ("Findings", _t(s.get("finding_count")), "rule firings"),
        ("High severity", _t(s.get("high_severity_finding_count")), "need action"),
        ("Unknown class", _t(s.get("unknown_evidence_count")), "resolve first"),
    ]
    kpi_html = "".join(
        f'<div class="kpi"><span>{k}</span><b>{v}</b><small>{sub}</small></div>'
        for k, v, sub in kpis
    )

    return (
        f'<div class="hero">{"".join(cards)}</div>'
        f'<div class="kpis">{kpi_html}</div>'
        f"{_narrative(report)}"
    )


def _methodology(report: dict) -> str:
    m = report.get("methodology") or {}
    steps = m.get("pipeline") or []
    flow = "".join(
        f'<div class="step"><div class="sn">{_e(st.get("step"))}</div>'
        f'<h4>{_e(st.get("title"))}</h4><p>{_e(st.get("detail"))}</p></div>'
        for st in steps
    )

    ec = m.get("evidence_classes") or []
    ec_rows = [
        [_badge(e.get("name"), e.get("tone") or "slate"),
         f'<span class="mono">{_e(e.get("name"))}</span>',
         _e(e.get("meaning"))]
        for e in ec
    ]
    ec_table = _table(["Class", "Identifier", "What it means in this report"], ec_rows)

    measure_cards = []
    for key, label, dark, _light in MEASURES:
        d = (m.get("measures") or {}).get(key) or {}
        measure_cards.append(
            f'<div class="card"><div class="card-h"><h3>{label}</h3>{_badge(key, "blue")}</div>'
            f'<p style="font-size:12px;color:var(--ink-2)">{_e(d.get("question") or "")}</p>'
            f'<p class="mono" style="margin-top:8px;font-size:10.5px;color:var(--faint)">{_e(d.get("formula") or "")}</p>'
            f'<p style="margin-top:8px;font-size:11.5px;color:var(--muted)">{_e(d.get("detail") or "")}</p></div>'
        )

    th = m.get("thresholds") or {}
    th_rows = []
    for key, label, _d, _l in MEASURES:
        t = th.get(key) or {}
        if key == "complexity":
            bands = f"Low &lt; {_e(t.get('low'))} · Medium &lt; {_e(t.get('medium'))} · High ≥ {_e(t.get('medium'))}"
        elif key == "readiness":
            bands = f"Not Ready &lt; {_e(t.get('low'))} · Partially Ready &lt; {_e(t.get('medium'))} · Ready ≥ {_e(t.get('medium'))}"
        else:
            bands = f"Low &lt; {_e(t.get('low'))} · Medium &lt; {_e(t.get('medium'))} · High ≥ {_e(t.get('medium'))}"
        th_rows.append([label, f'<span class="mono">{bands}</span>'])
    th_table = _table(["Measure", "Classification bands"], th_rows)

    rules = m.get("rules") or {}
    bm = rules.get("by_measure") or {}
    rule_line = (
        f"<b>{_t(rules.get('total'))}</b> rules "
        f"({_t(bm.get('complexity'))} complexity · {_t(bm.get('confidence'))} confidence · "
        f"{_t(bm.get('readiness'))} readiness)"
    )

    return (
        '<div class="grid g2">'
        + _card("Assessment pipeline", f'<div class="flow">{flow}</div>')
        + _card("Evidence classes",
                ec_table +
                '<p style="margin-top:10px;font-size:11.5px;color:var(--muted)">Every conclusion in '
                'this report carries one of these four labels. A finding is never presented as a fact '
                'when it is an inference, and an unresolvable reference is never discarded.</p>')
        + "</div>"
        + _card("How the three measures are computed", f'<div class="grid g3">{"".join(measure_cards)}</div>')
        + '<div class="grid g2">'
        + _card("Classification thresholds", th_table)
        + _card("Determinism and reproducibility",
                f'<p class="lede">The loaded ruleset contains {rule_line}. Each rule is evaluated '
                'against every applicable component and artifact; no rule is sampled and no model '
                'inference is involved. The same inputs therefore produce byte-identical scores on '
                'every run, which is what makes two assessments of the same application comparable '
                'and auditable.</p>'
                '<div class="callout" style="margin-top:10px"><b>What this report is not.</b> This is '
                'static extraction and deterministic scoring, not full semantic execution analysis. '
                'Absence of a detected risk is not evidence that the risk does not exist.</div>')
        + "</div>"
    )


def _domains(report: dict) -> str:
    doms = report.get("domain_assessments") or {}
    m = report.get("methodology") or {}
    labels_to_weight = m.get("domain_weights") or {}
    descs = m.get("domain_descriptions") or {}

    if not doms:
        return '<p class="empty">No domain assessment recorded. Run an assessment first.</p>'

    cards = []
    for key, data in doms.items():
        data = data or {}
        label = data.get("label") or key
        weight = labels_to_weight.get(label)
        weight_txt = f"{(float(weight) * 100):.0f}% weight" if isinstance(weight, (int, float)) else "—"
        rows = []
        factors = []
        for mk, mlabel, _dark, light in MEASURES:
            md = data.get(mk) or {}
            score = md.get("score")
            cls = md.get("classification")
            rows.append(
                f'<div class="mrow"><span class="ml">{mlabel.split()[-1]}</span>'
                f"{_meter(score, light)}"
                f'<span class="mv" title="{_e(cls)}">{_n(score, 1)}</span></div>'
            )
            for f in (md.get("negative_factors") or [])[:2]:
                factors.append(f)
            for note in (md.get("not_evidenced_notes") or [])[:1]:
                factors.append(note)
        if not rows:
            rows.append('<p class="empty">No measures.</p>')
        fac_html = ""
        if factors:
            fac_html = ('<div class="factors"><b>Drivers</b><ul>'
                        + "".join(f"<li>{_e(f)}</li>" for f in factors[:3])
                        + "</ul></div>")
        cards.append(
            f'<div class="dom"><div class="dom-h"><h4>{_e(label)}</h4>'
            f'<span class="wchip">{weight_txt}</span></div>'
            f'{"".join(rows)}{fac_html}</div>'
        )

    dd_rows = [
        [f"<strong>{_e(label)}</strong>", _e(desc)]
        for label, desc in descs.items()
    ]

    return (
        f'<div class="grid g3">{"".join(cards)}</div>'
        + _card("Domain weights and scope",
                '<p style="font-size:11.5px;color:var(--muted);margin-bottom:8px">Domain weights are '
                'declared in the ruleset, not inferred from the data. Complexity is renormalised over '
                'evidenced domains; confidence and readiness aggregate over all eight so that a blind '
                'spot pulls the score down instead of being ignored.</p>'
                + _table(["Domain", "What is examined"], dd_rows))
    )


def _rule_ledger(report: dict) -> str:
    artifacts = (report.get("artifact_inventory") or {}).get("artifacts") or []
    names = {a.get("id"): a.get("filename") for a in artifacts if a.get("id")}

    section_keys = {
        "complexity": "migration_complexity",
        "confidence": "assessment_confidence",
        "readiness": "migration_readiness",
    }
    blocks = []
    for key, label, _dark, light in MEASURES:
        sec = report.get(section_keys[key]) or {}
        rules = sec.get("fired_rules") or []
        rows = []
        for r in rules:
            refs = r.get("evidence_refs") or []
            locs = []
            for ref in refs[:3]:
                fname = names.get(ref.get("artifact_id")) or ref.get("artifact_id") or ""
                start = ref.get("line_start")
                end = ref.get("line_end")
                loc = f"{fname}" + (f":{start}" if start else "")
                if end and start and end != start:
                    loc += f"–{end}"
                locs.append(loc)
            more = f" +{len(refs) - 3} more" if len(refs) > 3 else ""
            loc_html = (f'<span class="mono" style="font-size:9.5px;color:var(--faint)">'
                        + "<br>".join(_e(x) for x in locs) + _e(more) + "</span>") if locs else '<span class="empty">no line ref</span>'
            rows.append([
                f'<strong class="mono">{_e(r.get("rule_id"))}</strong>',
                _e(r.get("description")),
                _badge(r.get("impact") or "—", "emerald" if r.get("impact") == "positive" else "amber"),
                _badge(r.get("severity") or "—", _tone(r.get("severity")) if r.get("severity") != "medium" else "amber"),
                f'<span class="mono">{_n(r.get("weight"), 0)}</span>',
                loc_html,
            ])

        blocks.append(
            _card(
                f'<h3>{label}</h3><span class="mono">{_n(sec.get("score"), 1)} · {_e(sec.get("classification") or "—")} · {len(rules)} rules fired</span>',
                _table(["Rule", "What fired", "Impact", "Severity", "Weight", "Evidence location"],
                       rows, empty="No rules fired for this measure."),
                cls="",
            )
        )
    return "".join(blocks)


def _risks(report: dict) -> str:
    r = report.get("major_risks") or {}
    high = r.get("high_severity_risks") or []
    medium = r.get("medium_severity_risks") or []
    if not high and not medium:
        return '<p class="empty">No high or medium severity risks were identified from the supplied evidence.</p>'

    def item(x: dict, sev: str) -> str:
        loc = x.get("source_filename") or ""
        if x.get("line_start"):
            loc = f"{loc}:{x.get('line_start')}"
        fix = (f'<div class="fix"><b>Action.</b> {_e(x.get("recommended_action"))}</div>'
               if x.get("recommended_action") else "")
        return (
            f'<div class="risk {sev}" data-sev="{sev}">'
            f'<div class="risk-h"><h4>{_e(x.get("title"))}</h4>'
            f'<div class="risk-meta">{_badge(sev, "rose" if sev == "high" else "amber")}'
            f'{_badge(x.get("evidence_class") or "—", "violet")}'
            f'<span class="mono">{_e(loc)}</span>'
            f'<span>{_e(x.get("detection_rule") or "")}</span></div></div>'
            f'<p>{_e(x.get("explanation"))}</p>{fix}</div>'
        )

    body = "".join(item(x, "high") for x in high) + "".join(item(x, "medium") for x in medium)
    return (f'<p style="font-size:12px;color:var(--muted);margin-bottom:10px">'
            f'{len(high)} high-severity and {len(medium)} medium-severity findings, each with its '
            f'detecting rule, evidence class and source location.</p>{body}')


def _gaps(report: dict) -> str:
    g = report.get("evidence_gaps") or {}
    unsupported = g.get("unsupported_artifacts") or []
    unknown = g.get("unknown_findings") or []

    left = _card(
        f'<h3>Unsupported or opaque artifacts</h3><span class="mono">{len(unsupported)}</span>',
        _table(["File", "Category", "Support"], [
            [f'<span class="mono">{_e(u.get("filename"))}</span>',
             _e(u.get("category")),
             _badge(u.get("support_level"), "slate")]
            for u in unsupported
        ], empty="Every supplied artifact is in a fully supported category."),
    )

    cards = "".join(
        f'<div class="risk medium"><div class="risk-h"><h4>{_e(u.get("title"))}</h4>'
        f'<div class="risk-meta">{_badge(u.get("finding_type") or "unknown", "slate")}</div></div>'
        f'<p>{_e(u.get("explanation"))}</p>'
        + (f'<div class="fix"><b>How to close it.</b> {_e(u.get("recommended_action"))}</div>'
           if u.get("recommended_action") else "")
        + "</div>"
        for u in unknown
    )

    right = _card(
        f'<h3>Unknown architecture elements</h3><span class="mono">{len(unknown)}</span>',
        cards or '<p class="empty">No unresolved elements. Every reference maps to a supplied artifact.</p>',
    )
    return f'<div class="grid g2">{left}{right}</div>'


def _recommendations(report: dict) -> str:
    recs = report.get("component_recommendations") or {}
    items = recs.get("recommendations") or []
    rows = []
    for r in items:
        pri = (r.get("priority") or "medium").lower()
        rows.append([
            f'<strong>{_e(r.get("component_name"))}</strong>',
            _badge(r.get("modernization_pattern") or "Refactor", "violet"),
            _badge(pri, "rose" if pri == "high" else ("amber" if pri == "medium" else "emerald")),
            _e(r.get("rationale")),
        ])
    by_cat = recs.get("by_category") or {}
    return (
        f'<div class="grid g2" style="margin-bottom:14px">'
        f'{_card("Recommendation mix", _dist(by_cat, "#7C3AED", "No categories recorded."))}'
        + _card("How to read this", '<p class="lede">Each row is a component-level pattern, not a '
                'platform decision. Patterns are hypotheses for evaluation against the target '
                'architecture, cost model and delivery constraints; the engine deliberately does not '
                'assume a single target runtime.</p>')
        + '</div>'
        + _table(["Component", "Pattern", "Priority", "Rationale"], rows,
                 empty="No component recommendations recorded.")
    )


def _roadmap(report: dict) -> str:
    ns = report.get("prioritized_next_steps") or {}
    groups = ns.get("groups") or {}
    refac = report.get("refactoring_considerations") or {}

    phases = []
    for name, items in groups.items():
        li = "".join(
            f'<li><b class="mono">{_e(i.get("priority") or "P1")}</b> {_e(i.get("action"))}'
            + (f'<br><span style="color:var(--faint)">{_e(i.get("reason"))}</span>'
               if i.get("reason") else "")
            + "</li>"
            for i in items
        )
        phases.append(f'<div class="card tint"><div class="card-h"><h3>{_e(name)}</h3>'
                      f'<span class="mono">{len(items)}</span></div>'
                      f'<ul class="bullets">{li}</ul></div>')

    steps = ns.get("assessment_recommended_steps") or []
    phase_html = "".join(phases) or '<p class="empty">No roadmap groups recorded.</p>'
    return (
        f'<div class="grid g2">{phase_html}</div>'
        + f'<div class="grid g2" style="margin-top:14px">'
        + _card("Architectural considerations", _bullets(refac.get("considerations") or []))
        + _card("Steps recommended by the scoring engine",
                _bullets(steps) if steps else '<p class="empty">No additional steps.</p>')
        + "</div>"
    )


def _inventory(report: dict) -> str:
    art = report.get("artifact_inventory") or {}
    comp = report.get("component_inventory") or {}
    dep = report.get("dependency_analysis") or {}

    def kb(n: int | None) -> str:
        try:
            return f"{float(n or 0) / 1024.0:.1f} KB"
        except (TypeError, ValueError):
            return "—"

    art_rows = [
        [f'<span class="mono">{_e(a.get("filename"))}</span>', _e(a.get("category")),
         _badge(a.get("support_level"), "emerald" if a.get("support_level") == "FULL" else "slate"),
         _badge(a.get("parse_status"), "emerald" if a.get("parse_status") == "parsed" else "amber"),
         f'<span class="mono">{_e(a.get("encoding"))}</span>', kb(a.get("size_bytes"))]
        for a in (art.get("artifacts") or [])
    ]

    comp_rows = [
        [f'<strong>{_e(c.get("name"))}</strong>', _badge(c.get("type"), "blue"),
         f'<span class="mono">{_e(c.get("source_filename"))}:{_e(c.get("line_start"))}</span>',
         _badge(c.get("evidence_class"), "violet")]
        for c in (comp.get("components") or [])[:120]
    ]

    dep_rows = [
        [f'<strong>{_e(d.get("source"))}</strong>',
         f'<span class="mono" style="color:var(--blue)">{_e(d.get("relationship_type"))}</span>',
         f'<strong>{_e(d.get("target"))}</strong>',
         _badge(d.get("evidence_class"), "violet"),
         f'<span class="mono">{_e(d.get("source_line"))}</span>']
        for d in (dep.get("dependencies") or [])[:120]
    ]

    dists = (
        '<div class="grid g3">'
        + _card(f'<h3>Artifacts by category</h3>', _dist(art.get("by_category"), "#2563EB"))
        + _card(f'<h3>Components by type</h3>', _dist(comp.get("by_type"), "#4F46E5"))
        + _card(f'<h3>Dependencies by relation</h3>', _dist(dep.get("by_relationship_type"), "#047857"))
        + "</div>"
    )

    tables = (
        '<div class="grid" style="margin-top:14px">'
        + _card(f'<h3>Artifact inventory</h3><span class="mono">{len(art_rows)} files · {kb(art.get("total_size_bytes"))}</span>',
                _table(["File", "Category", "Support", "Parse", "Encoding", "Size"], art_rows,
                       empty="No artifacts ingested."))
        + _card(f'<h3>Component inventory</h3><span class="mono">showing {min(len(comp_rows), 120)} of {_t(comp.get("total_components"))}</span>',
                f'<div class="scroll">{_table(["Name", "Type", "Location", "Evidence"], comp_rows, empty="No components.")}</div>')
        + _card(f'<h3>Dependency edges</h3><span class="mono">showing {min(len(dep_rows), 120)} of {_t(dep.get("total_dependencies"))}</span>',
                f'<div class="scroll">{_table(["Caller", "Relation", "Target", "Evidence", "Line"], dep_rows, empty="No dependency edges.")}</div>')
        + "</div>"
    )

    return dists + tables


def _accuracy(report: dict) -> str:
    pc = report.get("parser_coverage_and_accuracy") or {}
    em = report.get("evidence_metrics") or {}
    static = em.get("static") or {}
    acc = (static.get("parser_accuracy") or {})
    overall = acc.get("overall") or {}
    trace = static.get("traceability") or {}
    rules = static.get("rules_metrics") or {}
    review = static.get("review_counts") or {}

    if overall:
        headline = (
            _card("Benchmark parser accuracy",
                  f'<div style="font-family:var(--mono);font-size:26px;font-weight:800;letter-spacing:-.03em">'
                  f'{_n(overall.get("f1"), 1, "%")}</div>'
                  f'<div style="font-size:11px;color:var(--muted)">F1 · precision {_n(overall.get("precision"), 1, "%")} · '
                  f'recall {_n(overall.get("recall"), 1, "%")} · n = {_t(overall.get("sample_size_n"))}</div>')
        )
    else:
        headline = _card("Benchmark parser accuracy",
                         '<div style="font-family:var(--mono);font-size:26px;font-weight:800;color:var(--faint)">—</div>'
                         '<div style="font-size:11px;color:var(--muted)">Ground-truth benchmark not available on this host. '
                         'Not measured is shown as not measured.</div>')

    per_parser = acc.get("per_parser") or {}
    pp_rows = [
        [f'<span class="mono">{_e(name)}</span>', _n(v.get("precision"), 1, "%"),
         _n(v.get("recall"), 1, "%"), _n(v.get("f1"), 1, "%"),
         f'<span class="mono">{_t(v.get("sample_size_n"))}</span>']
        for name, v in per_parser.items()
    ]

    cov = (
        _card("Parser coverage",
              f'<div class="kpis">'
              f'<div class="kpi"><span>Artifacts</span><b>{_t(pc.get("total_artifacts"))}</b><small>supplied</small></div>'
              f'<div class="kpi"><span>Parsed</span><b>{_t(pc.get("parsed_artifacts"))}</b><small>successfully</small></div>'
              f'<div class="kpi"><span>Unsupported</span><b>{_t(pc.get("unsupported_artifacts"))}</b><small>detect-only</small></div>'
              f'<div class="kpi"><span>Components</span><b>{_t(pc.get("components_extracted"))}</b><small>extracted</small></div>'
              f'</div>'
              f'<p style="margin-top:10px;font-size:11px;color:var(--muted)">{_e(pc.get("note") or "")}</p>')
    )

    trace_card = _card(
        "Evidence traceability",
        f'<div style="font-family:var(--mono);font-size:26px;font-weight:800;letter-spacing:-.03em">'
        f'{_n(trace.get("with_line_pct"), 1, "%")}</div>'
        f'<div style="font-size:11px;color:var(--muted)">of findings carry a file and line range '
        f'({_t(trace.get("with_line_ref_count"))} of {_t(trace.get("total"))}).</div>'
        f'<div style="margin-top:10px;font-size:11px;color:var(--muted)">Rules fired: '
        f'<b>{_t(rules.get("rules_fired"))}</b> of <b>{_t(rules.get("total_rules"))}</b> in the ruleset. '
        f'Reviewer decisions: confirmed {_t(review.get("confirmed"))}, rejected {_t(review.get("rejected"))}, '
        f'investigating {_t(review.get("investigate"))}, pending {_t(review.get("pending"))}.</div>',
    )

    return (
        '<div class="grid g3">' + headline + cov + trace_card + "</div>"
        + _card("Accuracy by parser", _table(
            ["Parser", "Precision", "Recall", "F1", "n"], pp_rows,
            empty="No per-parser benchmark recorded."))
    )


def _governance(report: dict) -> str:
    auto = report.get("automation_and_ai_statement") or {}
    ai = report.get("ai_usage_statement") or {}
    lim = report.get("limitations_and_assumptions") or {}
    ver = report.get("versions") or {}
    rev = report.get("reviewer_changes") or {}
    met = report.get("measured_metrics") or {}
    m = report.get("methodology") or {}

    auto_rows = [[f"<strong>{_e(k.replace('_', ' ').title())}</strong>", _e(v)]
                 for k, v in auto.items()]
    rev_rows = [
        [f'<strong>{_e(a.get("reviewer_name"))}</strong>', _e(a.get("reviewer_role")),
         _badge(a.get("action"), "blue"), _e(a.get("finding_title")),
         f'<span class="mono">{_e((a.get("created_at") or "")[:19])}</span>']
        for a in (rev.get("reviewer_actions") or [])
    ] or [['<span class="empty">No reviewer changes — pipeline output is in its original state.</span>', "", "", "", ""]]

    limits = (lim.get("assessment_limitations") or []) + (lim.get("missing_information") or []) + \
             (lim.get("general_limitations") or [])

    return (
        '<div class="grid g2">'
        + _card("Automation and AI usage",
                f'<p class="lede" style="margin-bottom:10px"><b>{_e("AI was used" if ai.get("used") else "No AI was used in producing these scores")}</b> — '
                f'{_e(ai.get("statement"))}</p>'
                f'<div class="kpis">'
                f'<div class="kpi"><span>Model</span><b style="font-size:13px">{_e(ai.get("model"))}</b><small>{_e(ai.get("host"))}</small></div>'
                f'<div class="kpi"><span>Items reviewed</span><b>{_t(ai.get("items_reviewed"))}</b><small>advisory only</small></div>'
                f'<div class="kpi"><span>Human accepted</span><b>{_t(ai.get("items_accepted_by_humans"))}</b><small>reviewed</small></div>'
                f'</div>'
                + _table(["Statement", "Detail"], auto_rows))
        + _card("Versions and provenance",
                _table(["Field", "Value"], [
                    ["Model", f'<span class="mono">{_e(ver.get("model_version"))}</span>'],
                    ["Ruleset", f'<span class="mono">{_e(ver.get("ruleset_id"))} v{_e(ver.get("ruleset_version"))}</span>'],
                    ["Owner", _e((m.get("ruleset") or {}).get("owner"))],
                    ["Effective", _e((m.get("ruleset") or {}).get("effective_date"))],
                    ["Assessment record", f'<span class="mono">{_e(ver.get("assessment_record_id"))}</span>'],
                    ["Computed at", _e((ver.get("computed_at") or "")[:19])],
                    ["Runtime", f'analysis {_t(met.get("analysis_runtime_ms"))} ms · assessment {_t(met.get("assessment_runtime_ms"))} ms'],
                ]))
        + "</div>"
        + '<div class="grid g2" style="margin-top:14px">'
        + _card("Limitations and assumptions", _bullets(limits))
        + _card("Reviewer audit ledger", _table(
            ["Reviewer", "Role", "Action", "Finding", "When"], rev_rows))
        + "</div>"
    )


def _appendix(report: dict) -> str:
    m = report.get("methodology") or {}
    rs = m.get("ruleset") or {}
    climb = rs.get("changelog") or []
    change_rows = [
        [f'<span class="mono">{_e(c.get("version"))}</span>', _e(c.get("date")),
         _e(c.get("author")), _e(c.get("summary"))]
        for c in climb
    ]
    return (
        '<div class="grid g2">'
        + _card("Ruleset changelog", _table(["Version", "Date", "Author", "Summary"], change_rows,
                                            empty="No changelog entries recorded."))
        + _card("Document control",
                '<p class="lede">This document is generated from the persisted assessment record and '
                'the stored inventory. It is reproducible: re-running the export against the same '
                'record yields the same scores, the same findings and the same citations. Scores are '
                'relative to the loaded ruleset version and are not comparable across ruleset '
                'versions without re-assessment.</p>'
                '<div class="callout" style="margin-top:10px"><b>Retention.</b> Reviewer actions are '
                'stored separately from machine findings. Machine output is never overwritten.</div>')
        + "</div>"
    )


# --------------------------------------------------------------------------- #
# document
# --------------------------------------------------------------------------- #

_TOC = [
    ("01", "method", "Method &amp; mechanics"),
    ("02", "summary", "Executive dashboard"),
    ("03", "domains", "Eight-domain matrix"),
    ("04", "rules", "Rule &amp; evidence ledger"),
    ("05", "risks", "Risk register"),
    ("06", "gaps", "Evidence gaps"),
    ("07", "recommendations", "Recommendations"),
    ("08", "roadmap", "Execution roadmap"),
    ("09", "inventory", "Inventory &amp; topology"),
    ("10", "accuracy", "Accuracy &amp; traceability"),
    ("11", "governance", "Governance &amp; audit"),
    ("12", "appendix", "Appendix"),
]


def build_modern_html_report(report: dict, auto_print: bool = False) -> str:
    """Render the full standalone executive report document."""
    meta = report.get("report_metadata") or {}
    summary = report.get("executive_summary") or {}
    app_name = meta.get("application_name") or summary.get("application_name") or "Unknown Application"
    app_id = meta.get("application_id") or ""
    generated = meta.get("generated_at") or datetime.now(timezone.utc).isoformat()
    try:
        dt = datetime.fromisoformat(str(generated).replace("Z", "+00:00"))
        stamp = dt.strftime("%d %B %Y · %H:%M UTC")
    except Exception:
        stamp = str(generated)

    payload = json.dumps(report, default=str).replace("</", "<\\/")

    body = "".join([
        _section("01", "method", "Method &amp; mechanics", "How this report was produced",
                 "Reading order, scoring mechanics and the evidence discipline behind every number that follows.",
                 _methodology(report)),
        _section("02", "summary", "Executive dashboard", "Where the application stands",
                 "One screen for the decision: three independent measures, the inventory behind them, and a plain-language reading.",
                 _dashboard(report)),
        _section("03", "domains", "Domain assessment", "Eight-domain matrix",
                 "The same three measures resolved per domain, with the declared domain weight and the drivers that moved each score.",
                 _domains(report)),
        _section("04", "rules", "Evidence ledger", "Rule and evidence ledger",
                 "Every rule that fired, its weight, its severity and the file and line range that justified it.",
                 _rule_ledger(report)),
        _section("05", "risks", "Risk register", "Major risks and citations",
                 "Findings that change the shape of the migration, highest severity first, each with a concrete action.",
                 _risks(report)),
        _section("06", "gaps", "Coverage", "Evidence gaps and unsupported material",
                 "What could not be assessed, stated explicitly so that absence of evidence is never mistaken for evidence of simplicity.",
                 _gaps(report)),
        _section("07", "recommendations", "Modernization", "Component recommendations",
                 "Pattern hypotheses per component, ranked by priority, with the rationale recorded against each one.",
                 _recommendations(report)),
        _section("08", "roadmap", "Delivery", "Prioritized execution roadmap",
                 "Sequenced work grouped by phase, plus the architectural considerations that constrain it.",
                 _roadmap(report)),
        _section("09", "inventory", "Provenance", "Inventory and dependency topology",
                 "Every artifact, component and dependency edge the engine actually saw — the raw material behind the scores.",
                 _inventory(report)),
        _section("10", "accuracy", "Measurement", "Parser accuracy and traceability",
                 "How much of the supplied material was parsed, how well the parsers perform against ground truth, and what fraction of findings are line-cited.",
                 _accuracy(report)),
        _section("11", "governance", "Assurance", "Governance, limitations and audit ledger",
                 "Automation boundaries, AI usage, versions, limitations and the human review trail.",
                 _governance(report)),
        _section("12", "appendix", "Reference", "Appendix and document control",
                 "Ruleset history and the conditions under which this document may be reused.",
                 _appendix(report)),
    ])

    toc = "".join(f'<a href="#{sid}"><b>{num}</b><span>{label}</span></a>' for num, sid, label in _TOC)

    print_script = ""
    if auto_print:
        print_script = (
            "<script>window.addEventListener('load',function(){"
            "setTimeout(function(){window.print();},700);});</script>"
        )

    return f"""<!DOCTYPE html>
<html lang="en" class="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="ReFrameX M2O Intelligence">
<title>ReFrameX Executive Assessment — {_e(app_name)}</title>
<style>{_CSS}</style>
</head>
<body>

<div class="topbar no-print">
  <div class="topbar-in">
    <div class="brand">
      <div class="mark">RX</div>
      <div><div class="brand-name">ReFrameX</div><div class="brand-sub">Migration Intelligence</div></div>
    </div>
    <label class="search">
      <svg viewBox="0 0 24 24" fill="none" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input id="q" type="search" placeholder="Search findings, rules, files, components…" autocomplete="off">
    </label>
    <div class="actions">
      <button class="btn btn-solid" type="button" onclick="window.print()">Save as PDF</button>
      <button class="btn" type="button" onclick="downloadJson()">Export JSON</button>
      <button class="btn" type="button" onclick="toggleTheme()" id="themeBtn">Dark</button>
    </div>
  </div>
</div>

<div class="shell">
  <nav class="toc no-print" aria-label="Contents">
    <div class="toc-h">Contents</div>
    {toc}
  </nav>
  <main>
    {_cover(report, app_name, app_id, stamp)}
    {body}
    <div class="foot">
      <span>ReFrameX M2O Intelligence · deterministic ruleset execution · zero stochastic output</span>
      <span class="mono">{_e(app_name)} · {_e(stamp)}</span>
    </div>
  </main>
</div>

<script id="report-data" type="application/json">{payload}</script>
<script>
(function () {{
  var root = document.documentElement;
  function paint() {{ document.getElementById('themeBtn').textContent = root.classList.contains('dark') ? 'Light' : 'Dark'; }}
  try {{ if (localStorage.getItem('reframex-report-theme') === 'dark') root.classList.add('dark'); }} catch (e) {{}}
  paint();
  window.toggleTheme = function () {{
    root.classList.toggle('dark');
    try {{ localStorage.setItem('reframex-report-theme', root.classList.contains('dark') ? 'dark' : 'light'); }} catch (e) {{}}
    paint();
  }};
  window.downloadJson = function () {{
    var raw = document.getElementById('report-data').textContent;
    var blob = new Blob([raw], {{ type: 'application/json' }});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'reframex_report_{_e(app_name).replace('"', '')}.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () {{ URL.revokeObjectURL(url); }}, 1000);
  }};
  var input = document.getElementById('q');
  input.addEventListener('input', function () {{
    var q = input.value.trim().toLowerCase();
    var rows = document.querySelectorAll('tbody tr');
    var cards = document.querySelectorAll('.risk, .dom, .step');
    if (!q) {{
      rows.forEach(function (r) {{ r.style.display = ''; }});
      cards.forEach(function (c) {{ c.style.display = ''; }});
      return;
    }}
    rows.forEach(function (r) {{ r.style.display = r.textContent.toLowerCase().indexOf(q) > -1 ? '' : 'none'; }});
    cards.forEach(function (c) {{ c.style.display = c.textContent.toLowerCase().indexOf(q) > -1 ? '' : 'none'; }});
  }});
}})();
</script>
{print_script}
</body>
</html>"""
