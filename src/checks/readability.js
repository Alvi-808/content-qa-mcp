import { sentences, words, fkGrade, excerpt } from "./textstats.js";

const LONG_SENTENCE_WORDS = 28;
const PASSIVE_RE = /\b(?:was|were|been|being|is|are|be)\s+(?:\w+ed|born|done|made|seen|known|given|taken|shown|found|held|kept|left|lost|met|paid|put|read|said|sent|set|sold|told|won)\b/i;

/**
 * Readability report for article prose.
 * Returns { metrics, findings } where every finding has a concrete fix.
 */
export function readabilityCheck(text) {
  const sents = sentences(text);
  const allWords = words(text);
  const grade = fkGrade(text);

  const longOnes = sents.filter((s) => words(s).length > LONG_SENTENCE_WORDS);
  const passives = sents.filter((s) => PASSIVE_RE.test(s));

  const findings = [];

  if (grade > 12) {
    findings.push({
      check: "readability",
      severity: "medium",
      excerpt: null,
      finding: `Flesch-Kincaid grade is ${grade}; general web audiences read comfortably at grade 8-10.`,
      fix: "Split long sentences and swap multi-syllable words for shorter ones until the grade lands under 12. Target the longest sentences first; they move the score fastest.",
    });
  }

  for (const s of longOnes.slice(0, 10)) {
    findings.push({
      check: "readability",
      severity: "low",
      excerpt: excerpt(s),
      finding: `Sentence runs ${words(s).length} words (threshold ${LONG_SENTENCE_WORDS}).`,
      fix: "Break it at the conjunction or relative clause into two sentences; keep one idea per sentence.",
    });
  }

  const passiveShare = sents.length ? passives.length / sents.length : 0;
  if (passiveShare > 0.2 && passives.length >= 3) {
    findings.push({
      check: "readability",
      severity: "low",
      excerpt: excerpt(passives[0]),
      finding: `${passives.length} of ${sents.length} sentences read as passive voice (${Math.round(passiveShare * 100)}%).`,
      fix: "Rewrite the flagged sentences with the actor as the subject: 'the migration broke the redirects', not 'the redirects were broken by the migration'.",
    });
  }

  return {
    metrics: {
      sentences: sents.length,
      words: allWords.length,
      fleschKincaidGrade: grade,
      longSentences: longOnes.length,
      passiveSentences: passives.length,
    },
    findings,
  };
}
