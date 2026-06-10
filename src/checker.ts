import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parse } from "node-html-parser";
import { rules } from "./rules.js";
import type {
  GuardReport,
  LocalizedIssue,
  Manifest,
  PageReport,
  RuleResult,
  TemplateRegression,
} from "./types.js";

/**
 * Run every rule against every page in the manifest, then aggregate the
 * template-scoped failures into blast-radius groups.
 */
export function runGuard(manifestPath: string): GuardReport {
  const absManifest = resolve(manifestPath);
  const baseDir = dirname(absManifest);
  const manifest = JSON.parse(readFileSync(absManifest, "utf8")) as Manifest;

  const pageReports: PageReport[] = manifest.pages.map((page) => {
    const html = readFileSync(resolve(baseDir, page.file), "utf8");
    const root = parse(html, { comment: false });

    const results: RuleResult[] = rules.map((rule) => {
      const reason = rule.evaluate(root, page);
      return {
        ruleId: rule.id,
        label: rule.label,
        severity: rule.severity,
        scope: rule.scope,
        passed: reason === null,
        detail: reason ?? "OK",
      };
    });

    const failed = results.some((r) => !r.passed && r.severity === "error");
    return { page, results, failed };
  });

  // --- Aggregate template-scoped failures into blast-radius groups ---------
  // Key on (template + rule): a single broken thing in a shared template shows
  // up as the same rule failing across many storefronts. That's the regression
  // we want to surface as one finding, sized by how many retailers it hits.
  const groups = new Map<string, TemplateRegression>();

  for (const report of pageReports) {
    for (const result of report.results) {
      if (result.passed || result.scope !== "template") continue;
      const key = `${report.page.template}::${result.ruleId}`;
      const existing = groups.get(key);
      if (existing) {
        existing.affectedPages += 1;
        if (!existing.affectedRetailers.includes(report.page.retailer)) {
          existing.affectedRetailers.push(report.page.retailer);
        }
      } else {
        groups.set(key, {
          template: report.page.template,
          ruleId: result.ruleId,
          label: result.label,
          severity: result.severity,
          detail: result.detail,
          affectedRetailers: [report.page.retailer],
          affectedPages: 1,
          blastRadius: 0,
        });
      }
    }
  }

  const templateRegressions = [...groups.values()]
    .map((g) => ({ ...g, blastRadius: g.affectedRetailers.length }))
    .sort((a, b) => b.blastRadius - a.blastRadius || severityRank(b) - severityRank(a));

  // --- Page-scoped failures: real, but contained to one page ---------------
  const localizedIssues: LocalizedIssue[] = [];
  for (const report of pageReports) {
    for (const result of report.results) {
      if (result.passed || result.scope !== "page") continue;
      localizedIssues.push({
        ruleId: result.ruleId,
        label: result.label,
        severity: result.severity,
        detail: result.detail,
        retailer: report.page.retailer,
        template: report.page.template,
        url: report.page.url,
        file: report.page.file,
      });
    }
  }

  const errorCount =
    templateRegressions.filter((t) => t.severity === "error").length +
    localizedIssues.filter((i) => i.severity === "error").length;
  const warnCount =
    templateRegressions.filter((t) => t.severity === "warn").length +
    localizedIssues.filter((i) => i.severity === "warn").length;

  return {
    scannedPages: pageReports.length,
    scannedRetailers: new Set(manifest.pages.map((p) => p.retailer)).size,
    scannedTemplates: new Set(manifest.pages.map((p) => p.template)).size,
    passed: errorCount === 0,
    errorCount,
    warnCount,
    templateRegressions,
    localizedIssues,
    pageReports,
  };
}

function severityRank(t: { severity: string }): number {
  return t.severity === "error" ? 1 : 0;
}
