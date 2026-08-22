import { readabilityCheck } from "./readability.js";
import { aiTellScan } from "./aiTells.js";
import { seoOnpageCheck } from "./seoOnpage.js";

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };

function stripForProse(html) {
  return html
    .replace(/<head[\s\S]*?<\/head>/gi, " ") // title/meta text is not body prose
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Run every check on one article and return a single editorial report.
 * Accepts raw HTML (preferred) or plain text; if the input contains no tags
 * the SEO check is skipped rather than reporting false missing-tag findings.
 */
export function fullReport(input, focusKeyword = null) {
  // Real markup means a closing tag, a void element, or a doctype. A bare
  // "<" and ">" in prose (x<y and z>w) must NOT trigger the SEO check.
  const isHtml =
    /<\/[a-z][a-z0-9-]*\s*>/i.test(input) ||
    /<(?:img|meta|br|hr|input|link)\b[^<>]*>/i.test(input) ||
    /<!doctype\s+html/i.test(input);
  const prose = isHtml ? stripForProse(input) : input;

  if (prose.trim().length === 0) {
    return {
      summary: {
        findings: 1,
        bySeverity: { high: 1, medium: 0, low: 0 },
        verdict: "NOT READY: no prose found in the input.",
        seoCheckRan: false,
      },
      metrics: { readability: null, aiTells: null, seo: null },
      findings: [{
        check: "input",
        severity: "high",
        excerpt: null,
        finding: "The input contains no readable prose.",
        fix: "Pass the article body (HTML or plain text); an empty document cannot be QA'd, only rejected.",
      }],
    };
  }

  const readability = readabilityCheck(prose);
  const aiTells = aiTellScan(prose);
  const seo = isHtml ? seoOnpageCheck(input, focusKeyword) : null;

  const findings = [
    ...readability.findings,
    ...aiTells.findings,
    ...(seo ? seo.findings : []),
  ].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  const counts = { high: 0, medium: 0, low: 0 };
  for (const f of findings) counts[f.severity]++;

  return {
    summary: {
      findings: findings.length,
      bySeverity: counts,
      verdict:
        counts.high > 0
          ? "NOT READY: high-severity findings block publish."
          : counts.medium > 0
            ? "FIXABLE: no blockers, apply the medium fixes before publish."
            : "CLEAN: publishable as-is.",
      seoCheckRan: Boolean(seo),
    },
    metrics: {
      readability: readability.metrics,
      aiTells: aiTells.metrics,
      seo: seo ? seo.metrics : null,
    },
    findings,
  };
}
