import type { GuardReport } from "./types.js";

// Minimal ANSI styling — no dependency, degrades fine in CI logs.
const c = {
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

/** Print a developer-facing summary to stdout. */
export function printReport(report: GuardReport): void {
  const { scannedPages, scannedRetailers, scannedTemplates } = report;
  console.log("");
  console.log(c.bold("SEO Regression Guard"));
  console.log(
    c.dim(
      `Scanned ${scannedPages} pages across ${scannedRetailers} retailers and ${scannedTemplates} templates.`
    )
  );
  console.log("");

  if (report.templateRegressions.length) {
    console.log(c.bold("Template regressions (these spread across storefronts):"));
    for (const t of report.templateRegressions) {
      const tag = t.severity === "error" ? c.red("FAIL") : c.yellow("WARN");
      console.log(
        `  ${tag}  ${c.cyan(t.template)} · ${t.label}  ` +
          c.bold(`blast radius ${t.blastRadius}`) +
          c.dim(` (${t.affectedPages} page${t.affectedPages === 1 ? "" : "s"})`)
      );
      console.log(`        ${c.dim(t.detail)}`);
      console.log(`        ${c.dim("affects: " + t.affectedRetailers.join(", "))}`);
    }
    console.log("");
  }

  if (report.localizedIssues.length) {
    console.log(c.bold("Localized issues (contained to one page):"));
    for (const i of report.localizedIssues) {
      const tag = i.severity === "error" ? c.red("FAIL") : c.yellow("WARN");
      console.log(`  ${tag}  ${i.retailer} · ${i.label}  ${c.dim(i.url)}`);
      console.log(`        ${c.dim(i.detail)}`);
    }
    console.log("");
  }

  if (report.passed) {
    console.log(c.green(`PASS — no blocking SEO regressions. ${report.warnCount} warning(s).`));
  } else {
    console.log(
      c.red(
        `FAIL — ${report.errorCount} blocking SEO regression(s). ` +
          `Build should not ship.`
      )
    );
  }
  console.log("");
}
