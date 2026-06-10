import type { GuardReport, TemplateRegression } from "./types.js";

const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (ch) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!)
  );

/**
 * Render the report as a standalone HTML file.
 * Designed to read like an internal build tool: a status line, the
 * blast-radius view as the centerpiece, then the quieter detail.
 */
export function renderHtml(report: GuardReport, opts: { generatedAt?: Date } = {}): string {
  const generatedAt = opts.generatedAt ?? new Date();
  const status = report.passed ? "PASS" : "FAIL";
  const worst = report.templateRegressions[0]?.blastRadius ?? 0;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>SEO Regression Guard — ${status}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
<style>
  :root {
    --paper: #f3f5f3;
    --card: #ffffff;
    --ink: #15211c;
    --muted: #5e6b64;
    --line: #15211c1a;
    --pass: #0e6e5b;
    --fail: #c2402a;
    --warn: #9a6b16;
    --accent: #0e6e5b;
    --shadow: 0 1px 0 #15211c0a, 0 8px 24px -16px #15211c40;
  }
  * { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  body {
    margin: 0;
    background:
      radial-gradient(120% 60% at 100% 0%, #e7efe9 0%, transparent 60%),
      var(--paper);
    color: var(--ink);
    font-family: "Hanken Grotesk", system-ui, sans-serif;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }
  .wrap { max-width: 920px; margin: 0 auto; padding: 40px 24px 72px; }
  .mono { font-family: "IBM Plex Mono", ui-monospace, monospace; }

  /* ---- masthead ---- */
  .masthead { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; flex-wrap: wrap; }
  .eyebrow {
    font-family: "IBM Plex Mono", monospace; font-size: 12px; letter-spacing: .14em;
    text-transform: uppercase; color: var(--muted); margin: 0 0 8px;
  }
  h1 { font-size: clamp(26px, 4.4vw, 40px); line-height: 1.05; font-weight: 800; margin: 0; letter-spacing: -0.02em; }
  .sub { color: var(--muted); margin: 10px 0 0; max-width: 46ch; }

  .verdict {
    font-family: "IBM Plex Mono", monospace; font-weight: 600; font-size: 13px;
    letter-spacing: .08em; padding: 8px 14px; border-radius: 999px; white-space: nowrap;
    border: 1px solid transparent;
  }
  .verdict.pass { color: var(--pass); background: #0e6e5b14; border-color: #0e6e5b33; }
  .verdict.fail { color: var(--fail); background: #c2402a14; border-color: #c2402a33; }

  /* ---- summary strip ---- */
  .strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: var(--line);
    border: 1px solid var(--line); border-radius: 14px; overflow: hidden; margin: 28px 0 36px; }
  .stat { background: var(--card); padding: 16px 18px; }
  .stat .n { font-family: "IBM Plex Mono", monospace; font-weight: 600; font-size: 26px; line-height: 1; }
  .stat .l { font-size: 12px; color: var(--muted); margin-top: 6px; letter-spacing: .02em; }
  .stat.alarm .n { color: var(--fail); }

  /* ---- section headings ---- */
  .sec-head { display: flex; align-items: baseline; gap: 12px; margin: 8px 0 16px; }
  .sec-head h2 { font-size: 17px; font-weight: 700; margin: 0; letter-spacing: -0.01em; }
  .sec-head .hint { font-size: 13px; color: var(--muted); }

  /* ---- blast-radius cards (the signature element) ---- */
  .blast { display: grid; gap: 14px; margin-bottom: 40px; }
  .reg {
    background: var(--card); border: 1px solid var(--line); border-left: 3px solid var(--fail);
    border-radius: 12px; padding: 18px 20px; box-shadow: var(--shadow);
  }
  .reg.warn { border-left-color: var(--warn); }
  .reg-top { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
  .reg-template {
    font-family: "IBM Plex Mono", monospace; font-weight: 600; font-size: 14px;
    background: #15211c0d; padding: 3px 8px; border-radius: 6px;
  }
  .reg-rule { font-weight: 600; margin-left: 2px; }
  .radius { display: flex; align-items: baseline; gap: 7px; }
  .radius .num { font-family: "IBM Plex Mono", monospace; font-weight: 600; font-size: 30px; line-height: 1; color: var(--fail); }
  .reg.warn .radius .num { color: var(--warn); }
  .radius .lab { font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
  .reg-detail { color: var(--ink); margin: 12px 0 14px; font-size: 14.5px; }

  /* the row of storefront chips that "light up" to show spread */
  .chips { display: flex; flex-wrap: wrap; gap: 7px; align-items: center; }
  .chips .caption { font-size: 12px; color: var(--muted); margin-right: 4px; }
  .chip {
    font-family: "IBM Plex Mono", monospace; font-size: 12px; font-weight: 500;
    padding: 5px 10px; border-radius: 7px; border: 1px solid var(--fail);
    color: #fff; background: var(--fail);
  }
  .reg.warn .chip { border-color: var(--warn); background: var(--warn); }

  /* ---- localized issues ---- */
  .local { display: grid; gap: 1px; background: var(--line); border: 1px solid var(--line);
    border-radius: 12px; overflow: hidden; margin-bottom: 40px; }
  .row { background: var(--card); padding: 14px 18px; display: grid; grid-template-columns: 64px 1fr; gap: 14px; align-items: start; }
  .badge { font-family: "IBM Plex Mono", monospace; font-size: 11px; font-weight: 600; letter-spacing: .06em;
    padding: 3px 0; text-align: center; border-radius: 6px; }
  .badge.fail { color: var(--fail); background: #c2402a14; }
  .badge.warn { color: var(--warn); background: #9a6b1614; }
  .row .what { font-weight: 600; }
  .row .who { font-family: "IBM Plex Mono", monospace; font-size: 12px; color: var(--muted); margin-left: 8px; font-weight: 400; }
  .row .why { color: var(--muted); font-size: 14px; margin-top: 3px; }

  .empty { color: var(--muted); font-size: 14px; padding: 18px; border: 1px dashed var(--line); border-radius: 12px; margin-bottom: 40px; }

  /* ---- footer ---- */
  footer { border-top: 1px solid var(--line); padding-top: 18px; color: var(--muted); font-size: 13px;
    display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
  footer .mono { font-size: 12px; }
  a { color: var(--accent); text-decoration: none; border-bottom: 1px solid #0e6e5b40; }

  @media (max-width: 560px) {
    .strip { grid-template-columns: repeat(2, 1fr); }
    .row { grid-template-columns: 56px 1fr; }
  }
  @media (prefers-reduced-motion: no-preference) {
    .reg, .stat { animation: rise .4s ease both; }
    @keyframes rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  }
</style>
</head>
<body>
<div class="wrap">

  <header class="masthead">
    <div>
      <p class="eyebrow">Build-time SEO check</p>
      <h1>SEO Regression Guard</h1>
      <p class="sub">One broken shared template can drop SEO across many retailer storefronts at once. This check runs before the build ships and sizes each break by how far it spreads.</p>
    </div>
    <span class="verdict ${report.passed ? "pass" : "fail"}">${status}${report.passed ? "" : ` · ${report.errorCount} blocking`}</span>
  </header>

  <section class="strip" aria-label="Scan summary">
    <div class="stat"><div class="n">${report.scannedPages}</div><div class="l">pages scanned</div></div>
    <div class="stat"><div class="n">${report.scannedRetailers}</div><div class="l">retailers</div></div>
    <div class="stat"><div class="n">${report.scannedTemplates}</div><div class="l">shared templates</div></div>
    <div class="stat ${worst > 0 ? "alarm" : ""}"><div class="n">${worst}</div><div class="l">worst blast radius</div></div>
  </section>

  ${renderBlast(report.templateRegressions)}

  ${renderLocalized(report)}

  <footer>
    <span>Generated ${esc(generatedAt.toISOString().replace("T", " ").slice(0, 16))} UTC</span>
    <span class="mono">Built by Ryan Scharfer and Claude Code</span>
  </footer>

</div>
</body>
</html>`;
}

function renderBlast(regs: TemplateRegression[]): string {
  const head = `<div class="sec-head"><h2>Template regressions</h2><span class="hint">sorted by blast radius — how many storefronts each break hits</span></div>`;
  if (!regs.length) {
    return `${head}<div class="empty">No template-level regressions. Shared layouts are emitting their required SEO elements.</div>`;
  }
  const cards = regs
    .map((t) => {
      const chips = t.affectedRetailers.map((r) => `<span class="chip">${esc(r)}</span>`).join("");
      return `
    <article class="reg ${t.severity === "warn" ? "warn" : ""}">
      <div class="reg-top">
        <div><span class="reg-template">${esc(t.template)}</span> <span class="reg-rule">${esc(t.label)}</span></div>
        <div class="radius"><span class="num">${t.blastRadius}</span><span class="lab">storefronts hit</span></div>
      </div>
      <p class="reg-detail">${esc(t.detail)}</p>
      <div class="chips"><span class="caption">spreads to:</span>${chips}</div>
    </article>`;
    })
    .join("");
  return `${head}<div class="blast">${cards}</div>`;
}

function renderLocalized(report: GuardReport): string {
  const head = `<div class="sec-head"><h2>Localized issues</h2><span class="hint">contained to a single page</span></div>`;
  if (!report.localizedIssues.length) {
    return `${head}<div class="empty">No page-level issues found.</div>`;
  }
  const rows = report.localizedIssues
    .map(
      (i) => `
    <div class="row">
      <span class="badge ${i.severity === "warn" ? "warn" : "fail"}">${i.severity === "warn" ? "WARN" : "FAIL"}</span>
      <div>
        <div class="what">${esc(i.label)}<span class="who">${esc(i.retailer)} · ${esc(i.url)}</span></div>
        <div class="why">${esc(i.detail)}</div>
      </div>
    </div>`
    )
    .join("");
  return `${head}<div class="local">${rows}</div>`;
}
