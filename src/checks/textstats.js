// Shared text statistics. Pure functions, no I/O, no dependencies.

/** Split prose into sentences. Handles common abbreviations poorly on purpose:
 *  editorial QA cares about the distribution, not a perfect parse. */
export function sentences(text) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function words(text) {
  return (text.match(/[A-Za-z0-9'-]+/g) || []).filter((w) => /[A-Za-z0-9]/.test(w));
}

/** Heuristic syllable count: vowel groups, silent-e adjustment, floor of 1. */
export function syllables(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length === 0) return 0;
  if (w.length <= 3) return 1;
  let count = (w.replace(/e\b/, "").match(/[aeiouy]{1,2}/g) || []).length;
  return Math.max(1, count);
}

/** Flesch-Kincaid grade level. */
export function fkGrade(text) {
  const s = sentences(text);
  const w = words(text);
  if (s.length === 0 || w.length === 0) return 0;
  const syl = w.reduce((n, word) => n + syllables(word), 0);
  const grade = 0.39 * (w.length / s.length) + 11.8 * (syl / w.length) - 15.59;
  return Math.round(grade * 10) / 10;
}

/** First ~90 chars of a sentence, for use as a finding excerpt. */
export function excerpt(s, max = 90) {
  return s.length <= max ? s : s.slice(0, max - 3) + "...";
}
