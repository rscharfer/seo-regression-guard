/**
 * Shared types for the SEO regression guard.
 *
 * The mental model:
 *  - A "page" is one rendered storefront URL. In a white-label setup, many
 *    retailers' pages are produced from the same shared *template*.
 *  - A "rule" checks one required SEO element on a page.
 *  - A rule is scoped either to the `template` (the element is supplied by the
 *    shared template, so if it breaks it breaks everywhere that template is used)
 *    or to the `page` (the element is page-specific, so a failure is localized).
 *
 * The whole point of the tool is the first case: catch a template-level
 * regression at build time and report its *blast radius* — how many retailer
 * storefronts a single broken template would take down at once.
 */

export type Severity = "error" | "warn";
export type Scope = "template" | "page";

/** One rendered page, as declared in the build manifest. */
export interface PageRecord {
  /** Path to the rendered HTML, relative to the manifest. */
  file: string;
  /** The retailer / storefront this page belongs to. */
  retailer: string;
  /** The shared template this page was rendered from. */
  template: string;
  /** The canonical URL this page is expected to advertise. */
  url: string;
  /** What kind of page this is — lets rules apply only where they're relevant. */
  kind?: "home" | "search" | "product" | string;
}

export interface Manifest {
  pages: PageRecord[];
}

/** The result of running one rule against one page. */
export interface RuleResult {
  ruleId: string;
  label: string;
  severity: Severity;
  scope: Scope;
  passed: boolean;
  /** Plain-language statement of what was found and why it matters. */
  detail: string;
}

/** All rule results for a single page. */
export interface PageReport {
  page: PageRecord;
  results: RuleResult[];
  /** True if any `error`-severity rule failed. */
  failed: boolean;
}

/**
 * A template-scoped failure, aggregated across every storefront it hit.
 * This is the headline unit of the report.
 */
export interface TemplateRegression {
  template: string;
  ruleId: string;
  label: string;
  severity: Severity;
  detail: string;
  /** Distinct retailers affected by this single template-level break. */
  affectedRetailers: string[];
  /** Total pages affected (can exceed retailer count). */
  affectedPages: number;
  /** affectedRetailers.length — the number that should make people nervous. */
  blastRadius: number;
}

/** A page-scoped failure: real, but contained to one page. */
export interface LocalizedIssue {
  ruleId: string;
  label: string;
  severity: Severity;
  detail: string;
  retailer: string;
  template: string;
  url: string;
  file: string;
}

export interface GuardReport {
  scannedPages: number;
  scannedRetailers: number;
  scannedTemplates: number;
  passed: boolean;
  errorCount: number;
  warnCount: number;
  templateRegressions: TemplateRegression[];
  localizedIssues: LocalizedIssue[];
  pageReports: PageReport[];
}
