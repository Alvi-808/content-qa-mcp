import { words, sentences, excerpt } from "./textstats.js";

/** Stock phrases that read as unedited LLM output in 2025-26 editorial work.
 *  The list bans the CLASS (each entry is a regex), so single-word rewrites
 *  don't slip past it. */
const STOCK_PHRASES = [
  { re: /\bdelve(?:s|d)? into\b/i, name: "delve into" },
  { re: /\bin today'?s (?:fast-paced|digital|ever-changing|modern) (?:world|landscape|age|era)\b/i, name: "in today's fast-paced world" },
  { re: /\bunlock(?:s|ing)? the (?:power|potential|secrets?)\b/i, name: "unlock the power/potential" },
  { re: /\bgame[- ]changer\b/i, name: "game-changer" },
  { re: /\bseamless(?:ly)? integrat/i, name: "seamlessly integrate" },
  { re: /\bit'?s (?:important|worth) (?:to note|noting) that\b/i, name: "it's worth noting that" },
  { re: /\bwhether you'?re a\b[^.]{0,80}\bor a\b/i, name: "whether you're an X or a Y" },
  { re: /\b(?:navigate|navigating) the (?:complex|ever-evolving|changing) (?:world|landscape)\b/i, name: "navigating the landscape" },
  { re: /\belevate your\b/i, name: "elevate your" },
  { re: /\bharness(?:es|ing)? the power\b/i, name: "harness the power" },
  { re: /\bdive deep(?:er)? into\b/i, name: "dive deep into" },
  { re: /\brobust (?:solution|framework|approach)s?\b/i, name: "robust solution" },
  { re: /\bnot (?:just|only) [^.]{3,60}, but\b/i, name: "not just X, but Y" },
  { re: /\bin conclusion\b/i, name: "in conclusion" },
  { re: /\blook no further\b/i, name: "look no further" },
];

/**
 * Scan prose for machine-writing tells: stock phrases, em/en-dash density,
 * arrow characters, and emoji. Returns { metrics, findings }; every finding
 * carries the fix.
 */
export function aiTellScan(text) {
  const findings = [];
  const wordCount = words(text).length || 1;
  const sents = sentences(text);

  for (const phrase of STOCK_PHRASES) {
    const hit = sents.find((s) => phrase.re.test(s));
    if (hit) {
      const count = sents.filter((s) => phrase.re.test(s)).length;
      findings.push({
        check: "ai-tells",
        severity: "medium",
        excerpt: excerpt(hit),
        finding: `Stock phrase "${phrase.name}" appears ${count} time(s). Readers and editors pattern-match it to unedited AI output.`,
        fix: "Replace it with the specific claim it is standing in for. If the sentence says nothing once the phrase is gone, cut the sentence.",
      });
    }
  }

  const emDashes = (text.match(/[—–]/g) || []).length;
  const dashDensity = (emDashes / wordCount) * 1000;
  if (emDashes >= 3 && dashDensity > 4) {
    findings.push({
      check: "ai-tells",
      severity: "medium",
      excerpt: null,
      finding: `${emDashes} em/en dashes in ${wordCount} words (${dashDensity.toFixed(1)} per 1,000). Heavy dash use is a strong machine-writing tell.`,
      fix: "Rewrite dash-spliced sentences with commas, colons, or two sentences. Keep dashes only where a deliberate interruption earns one.",
    });
  }

  const arrows = (text.match(/[→←⇒]|->|=>/g) || []).length;
  if (arrows > 0) {
    findings.push({
      check: "ai-tells",
      severity: "low",
      excerpt: null,
      finding: `${arrows} arrow glyph(s) in prose. Arrows belong in diagrams, not sentences.`,
      fix: "Spell the relationship out: 'X leads to Y' or 'X becomes Y'.",
    });
  }

  const emoji = (text.match(/\p{Extended_Pictographic}/gu) || []).length;
  if (emoji > 0) {
    findings.push({
      check: "ai-tells",
      severity: "low",
      excerpt: null,
      finding: `${emoji} emoji in body prose.`,
      fix: "Cut them from editorial copy; clients read emoji in articles as filler.",
    });
  }

  return {
    metrics: { stockPhraseHits: findings.filter((f) => f.finding.startsWith("Stock")).length, emDashes, arrows, emoji },
    findings,
  };
}
