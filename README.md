# SEO Regression Guard

A build-time check that stops a broken **shared template** from quietly breaking SEO
across many retailer storefronts at once.

![Sample report](docs/report-preview.png)

When one platform renders thousands of white-label storefronts from a handful of
shared templates, a single template change has leverage in both directions. Ship a
good change and every storefront improves. Drop a `<link rel="canonical">` or leave a
staging `noindex` flag in, and every storefront on that template loses search traffic —
often silently, and often not noticed until rankings dip weeks later.

This tool runs against your rendered pages **before they ship**, checks each one for the
SEO elements that matter, and — the important part — groups template-level failures and
reports their **blast radius**: how many storefronts a single break would take down.

```
Template regressions (these spread across storefronts):
  FAIL  search-v5 · Indexable (no stray noindex)   blast radius 5  (5 pages)
        Page is marked noindex. This is how a staging flag quietly removes a storefront from Google.
        affects: FreshMart, GreenGrocer, Cornerstone Foods, Bayou Market, Sunrise Co-op
  FAIL  home-v2 · Canonical URL                     blast radius 3  (3 pages)
        Missing <link rel="canonical">. Duplicate storefront URLs will compete in ranking.
        affects: FreshMart, GreenGrocer, Cornerstone Foods

FAIL — 4 blocking SEO regression(s). Build should not ship.
```

It exits non-zero when it finds a blocking regression, so it works as a CI gate.

## Quick start

```bash
npm install
npm run check          # console report; exits 1 if blocking regressions found
npm run report         # also writes a visual report to report.html
npm run check:json     # machine-readable output for dashboards
```

Open `report.html` in a browser for the visual view, including the blast-radius
breakdown. A sample is included via the fixtures under `fixtures/storefronts/`.

## How it decides blast radius

Every page in `fixtures/storefronts/manifest.json` declares the shared `template` it was
rendered from. Each rule is scoped as either:

- **`template`** — the element is supplied by the shared layout (canonical, `robots`,
  `lang`, Open Graph defaults). If it breaks, it breaks everywhere that template is used.
  These failures are grouped, and blast radius is the number of distinct storefronts hit.
- **`page`** — the element comes from the page's own content (title, meta description,
  product JSON-LD, a single `<h1>`). A failure here is real but **localized** to one page.

That single distinction is what turns a flat list of warnings into a prioritized one:
fix the break that hits five storefronts before the typo that hits one.

## Rules included

| Rule | Scope | Severity |
| --- | --- | --- |
| Page title (present, sane length) | page | error |
| Meta description | page | error |
| Canonical URL (present, matches page URL) | template | error |
| Indexable — no stray `noindex` | template | error |
| Product structured data (valid JSON-LD) | page (product only) | error |
| Language declared (`<html lang>`) | template | warn |
| Exactly one `<h1>` | page | warn |
| Open Graph tags (`og:title`/`description`/`image`) | template | warn |

Rules live in [`src/rules.ts`](src/rules.ts) and are easy to add to — each one is a small
function that returns `null` to pass or a plain-language reason to fail.

## Wiring it into CI

A ready-to-use GitHub Actions workflow is in
[`.github/workflows/seo-guard.yml`](.github/workflows/seo-guard.yml). It runs the check on
every pull request and fails the build if a blocking regression is found, so a broken
template is caught in review instead of in production.

## Project layout

```
src/
  rules.ts        SEO rule definitions (add your own here)
  checker.ts      runs rules, aggregates template failures into blast-radius groups
  report.ts       console (build-log) output
  htmlReport.ts   standalone visual report
  cli.ts          entry point + exit code
fixtures/
  storefronts/    sample rendered pages + manifest.json mapping pages to templates
```

## Notes

This is a focused demonstration, not a full crawler. It checks rendered HTML you point it
at; it doesn't fetch URLs or render JavaScript. The design goal was to make the
*template-blast-radius* idea concrete and runnable, since that's the failure mode unique
to large white-label storefront platforms.

---

Built by Ryan Scharfer and Claude Code · MIT licensed
