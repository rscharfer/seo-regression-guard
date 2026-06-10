import type { HTMLElement } from "node-html-parser";
import type { PageRecord, Scope, Severity } from "./types.js";

/**
 * A rule inspects one rendered page and reports whether a required SEO
 * element is present and well-formed.
 *
 * `scope` declares where the element comes from:
 *   - "template": supplied by the shared layout/template. A failure here is the
 *     dangerous kind — it propagates to every storefront on that template.
 *   - "page": supplied by the page's own content. A failure is localized.
 */
export interface Rule {
  id: string;
  label: string;
  severity: Severity;
  scope: Scope;
  /** Returns null when the rule passes, or a reason string when it fails. */
  evaluate: (root: HTMLElement, page: PageRecord) => string | null;
}

const text = (el: HTMLElement | null): string => (el?.text ?? "").trim();

export const rules: Rule[] = [
  {
    id: "title",
    label: "Page title",
    severity: "error",
    scope: "page",
    evaluate: (root) => {
      const title = text(root.querySelector("title"));
      if (!title) return "Missing or empty <title>. Search results have nothing to show as the headline.";
      if (title.length < 10) return `<title> is only ${title.length} characters ("${title}") — almost certainly a truncated or placeholder title.`;
      if (title.length > 70) return `<title> is ${title.length} characters and will be cut off in search results.`;
      return null;
    },
  },
  {
    id: "meta-description",
    label: "Meta description",
    severity: "error",
    scope: "page",
    evaluate: (root) => {
      const desc = root.querySelector('meta[name="description"]')?.getAttribute("content")?.trim();
      if (!desc) return "Missing meta description. Search engines will improvise the snippet, usually badly.";
      if (desc.length < 50) return `Meta description is only ${desc.length} characters — too thin to earn a click.`;
      return null;
    },
  },
  {
    id: "canonical",
    label: "Canonical URL",
    severity: "error",
    scope: "template",
    evaluate: (root, page) => {
      const canonical = root.querySelector('link[rel="canonical"]')?.getAttribute("href")?.trim();
      if (!canonical) return "Missing <link rel=\"canonical\">. Duplicate storefront URLs will compete with each other in ranking.";
      if (canonical !== page.url) return `Canonical points to "${canonical}" but this page is "${page.url}" — link equity is leaking to the wrong URL.`;
      return null;
    },
  },
  {
    id: "robots-indexable",
    label: "Indexable (no stray noindex)",
    severity: "error",
    scope: "template",
    evaluate: (root) => {
      const robots = root.querySelector('meta[name="robots"]')?.getAttribute("content")?.toLowerCase() ?? "";
      if (robots.includes("noindex")) {
        return "Page is marked noindex. This is how a staging flag quietly removes a storefront from Google entirely.";
      }
      return null;
    },
  },
  {
    id: "html-lang",
    label: "Language declared",
    severity: "warn",
    scope: "template",
    evaluate: (root) => {
      const lang = root.querySelector("html")?.getAttribute("lang")?.trim();
      if (!lang) return "Missing lang attribute on <html>. Hurts accessibility and locale-aware indexing.";
      return null;
    },
  },
  {
    id: "single-h1",
    label: "Exactly one H1",
    severity: "warn",
    scope: "page",
    evaluate: (root) => {
      const h1s = root.querySelectorAll("h1");
      if (h1s.length === 0) return "No <h1> on the page. The primary heading is the strongest on-page relevance signal.";
      if (h1s.length > 1) return `${h1s.length} <h1> elements found. Multiple H1s dilute the page's main topic.`;
      return null;
    },
  },
  {
    id: "og-tags",
    label: "Open Graph (social previews)",
    severity: "warn",
    scope: "template",
    evaluate: (root) => {
      const need = ["og:title", "og:description", "og:image"];
      const missing = need.filter(
        (p) => !root.querySelector(`meta[property="${p}"]`)?.getAttribute("content")?.trim()
      );
      if (missing.length) return `Missing Open Graph tags: ${missing.join(", ")}. Shared links will render as bare URLs.`;
      return null;
    },
  },
  {
    id: "structured-data",
    label: "Structured data (JSON-LD)",
    severity: "error",
    scope: "page",
    evaluate: (root, page) => {
      // Product structured data is only expected on product pages.
      if (page.kind && page.kind !== "product") return null;
      const blocks = root.querySelectorAll('script[type="application/ld+json"]');
      if (blocks.length === 0) {
        return "No JSON-LD structured data. Rich results (product price, rating, availability) won't show in search.";
      }
      for (const block of blocks) {
        try {
          const data = JSON.parse(block.text);
          const type = Array.isArray(data) ? data[0]?.["@type"] : data?.["@type"];
          if (!type) return "JSON-LD block parsed but has no @type — search engines will ignore it.";
        } catch {
          return "JSON-LD block is present but is not valid JSON — a single trailing comma can silently disable rich results.";
        }
      }
      return null;
    },
  },
];
