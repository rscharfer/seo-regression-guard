#!/usr/bin/env -S npx tsx
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { runGuard } from "./checker.js";
import { printReport } from "./report.js";
import { renderHtml } from "./htmlReport.js";

/**
 * Usage:
 *   tsx src/cli.ts <storefronts-dir>            # console report, sets exit code
 *   tsx src/cli.ts <storefronts-dir> --html out.html
 *   tsx src/cli.ts <storefronts-dir> --json
 *
 * Exit code is 1 when any blocking (error) regression is found, so the tool
 * works as a CI gate: a broken template fails the build instead of shipping.
 */
function main(): void {
  const args = process.argv.slice(2);
  const dir = args.find((a) => !a.startsWith("--"));
  if (!dir) {
    console.error("Usage: tsx src/cli.ts <storefronts-dir> [--html out.html] [--json]");
    process.exit(2);
  }

  const manifestPath = resolve(dir, "manifest.json");
  const report = runGuard(manifestPath);

  const htmlFlagIdx = args.indexOf("--html");
  if (htmlFlagIdx !== -1) {
    const out = args[htmlFlagIdx + 1] ?? "report.html";
    writeFileSync(out, renderHtml(report), "utf8");
    console.log(`HTML report written to ${out}`);
  }

  if (args.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printReport(report);
  }

  process.exit(report.passed ? 0 : 1);
}

main();
