import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { readabilityCheck } from "../src/checks/readability.js";
import { aiTellScan } from "../src/checks/aiTells.js";
import { seoOnpageCheck } from "../src/checks/seoOnpage.js";
import { fullReport } from "../src/checks/fullReport.js";
import { fkGrade, sentences } from "../src/checks/textstats.js";

const here = dirname(fileURLToPath(import.meta.url));
const badHtml = readFileSync(join(here, "fixtures", "bad-article.html"), "utf8");

const CLEAN_TEXT =
  "Descale the boiler every three months. Hard water leaves scale on the heating element. " +
  "Scale makes the pump work harder and the shots run cooler. A citric acid soak removes it in twenty minutes.";

test("textstats: sentence split and FK grade behave sanely", () => {
  assert.equal(sentences(CLEAN_TEXT).length, 4);
  const grade = fkGrade(CLEAN_TEXT);
  assert.ok(grade > 0 && grade < 12, `grade ${grade} out of expected band`);
});

test("readability: flags the long passive sentence in the fixture", () => {
  const prose = badHtml.replace(/<[^>]+>/g, " ");
  const r = readabilityCheck(prose);
  assert.ok(r.metrics.longSentences >= 1, "long sentence not counted");
  assert.ok(r.findings.some((f) => f.finding.includes("words (threshold")), "no long-sentence finding");
});

test("readability: clean short prose produces no findings", () => {
  const r = readabilityCheck(CLEAN_TEXT);
  assert.equal(r.findings.length, 0);
});

test("ai-tells: catches stock phrases, dashes, arrows, emoji in the fixture", () => {
  const prose = badHtml.replace(/<[^>]+>/g, " ");
  const r = aiTellScan(prose);
  const names = r.findings.map((f) => f.finding);
  assert.ok(names.some((n) => n.includes("delve into")), "missed 'delve into'");
  assert.ok(names.some((n) => n.includes("in today's fast-paced world")), "missed fast-paced world");
  assert.ok(names.some((n) => n.includes("game-changer")), "missed game-changer");
  assert.ok(r.metrics.emDashes >= 3, "em dashes not counted");
  assert.ok(r.metrics.arrows >= 1, "arrow not counted");
  assert.ok(r.metrics.emoji >= 1, "emoji not counted");
});

test("ai-tells: clean prose returns zero findings", () => {
  const r = aiTellScan(CLEAN_TEXT);
  assert.equal(r.findings.length, 0);
});

test("seo-onpage: fixture yields missing meta, double h1, missing alt, long title", () => {
  const r = seoOnpageCheck(badHtml, "espresso descaling");
  const kinds = r.findings.map((f) => f.finding);
  assert.ok(kinds.some((k) => k.includes("No meta description")), "missed missing meta");
  assert.ok(kinds.some((k) => k.includes("<h1> tags")), "missed double h1");
  assert.ok(kinds.some((k) => k.includes("no alt text")), "missed missing alt");
  assert.ok(kinds.some((k) => k.includes("Title is")), "missed long title");
  assert.equal(r.metrics.h1Count, 2);
  assert.equal(r.metrics.imagesMissingAlt, 2);
});

test("seo-onpage: keyword absent from body is a high-severity finding", () => {
  const r = seoOnpageCheck(badHtml, "quantum flux capacitors");
  const f = r.findings.find((x) => x.finding.includes("never appears in the body"));
  assert.ok(f, "missing-keyword finding absent");
  assert.equal(f.severity, "high");
});

test("full report: severity ordering, verdict, and seo flag", () => {
  const r = fullReport(badHtml, "espresso descaling");
  assert.ok(r.summary.findings > 5, "expected a pile of findings on the bad fixture");
  assert.ok(r.summary.verdict.startsWith("NOT READY") || r.summary.verdict.startsWith("FIXABLE"));
  assert.equal(r.summary.seoCheckRan, true);
  const sevs = r.findings.map((f) => ({ high: 0, medium: 1, low: 2 })[f.severity]);
  const sorted = [...sevs].sort((a, b) => a - b);
  assert.deepEqual(sevs, sorted, "findings not sorted by severity");
});

test("full report: plain text input skips the SEO check instead of faking findings", () => {
  const r = fullReport(CLEAN_TEXT, "espresso");
  assert.equal(r.summary.seoCheckRan, false);
  assert.equal(r.metrics.seo, null);
  assert.ok(!r.findings.some((f) => f.check === "seo-onpage"));
});

test("REGRESSION: bare angle brackets in prose do not trigger the SEO check", () => {
  const r = fullReport("The price rule is simple: if x<y and z>w then buy. Hold otherwise and wait for the signal.");
  assert.equal(r.summary.seoCheckRan, false, "x<y prose misread as HTML");
  assert.ok(!r.findings.some((f) => f.check === "seo-onpage"));
});

test("REGRESSION: keyword counting respects word boundaries", () => {
  const html = "<html><head><title>Descaling guide for espresso descaling</title></head><body><h1>Guide</h1>" +
    "<p>descaling descaling descalingdescaling DESCALING.</p></body></html>";
  const r = seoOnpageCheck(html, "descaling");
  assert.equal(r.metrics.keyword.occurrences, 3, "substring matches inflated the count");
});

test("empty input returns a no-prose finding, never CLEAN", () => {
  const r = fullReport("   ");
  assert.ok(r.summary.verdict.startsWith("NOT READY"));
  assert.equal(r.findings[0].check, "input");
  assert.ok(r.findings[0].fix.length >= 20);
});

test("CONTRACT: every finding from every check carries a non-empty fix", () => {
  const prose = badHtml.replace(/<[^>]+>/g, " ");
  const all = [
    ...readabilityCheck(prose).findings,
    ...aiTellScan(prose).findings,
    ...seoOnpageCheck(badHtml, "espresso descaling").findings,
    ...fullReport(badHtml, "espresso descaling").findings,
  ];
  assert.ok(all.length >= 15, `expected a rich finding set, got ${all.length}`);
  for (const f of all) {
    assert.equal(typeof f.fix, "string", `finding without fix: ${f.finding}`);
    assert.ok(f.fix.length >= 20, `fix too thin to act on: "${f.fix}"`);
    assert.ok(["high", "medium", "low"].includes(f.severity));
    assert.ok(typeof f.finding === "string" && f.finding.length > 0);
  }
});
