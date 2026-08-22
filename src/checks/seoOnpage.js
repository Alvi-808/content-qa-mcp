import { words } from "./textstats.js";

// Regex-based extraction, scoped on purpose: this parses well-formed CMS
// article HTML (WordPress, Ghost, static-site output). It is not a general
// HTML parser and does not try to survive adversarial markup. The README
// states the same boundary.

function extract(re, html) {
  const m = html.match(re);
  return m ? m[1].replace(/<[^>]+>/g, "").trim() : null;
}

function extractAll(re, html) {
  return [...html.matchAll(re)].map((m) => m[1].replace(/<[^>]+>/g, "").trim());
}

function stripTags(html) {
  return html
    .replace(/<head[\s\S]*?<\/head>/gi, " ") // title/meta text is not body prose
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ");
}

/**
 * On-page SEO check for one article's HTML.
 * Returns { metrics, findings }; every finding carries the fix.
 */
export function seoOnpageCheck(html, focusKeyword = null) {
  const findings = [];

  const title = extract(/<title[^>]*>([\s\S]*?)<\/title>/i, html);
  const metaDesc = extract(/<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']/i, html)
    ?? extract(/<meta\s+content=["']([\s\S]*?)["']\s+name=["']description["']/i, html);
  const h1s = extractAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, html);
  const h2s = extractAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, html);
  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const imgsNoAlt = imgs.filter((tag) => !/\balt=["'][^"']+["']/i.test(tag));
  const links = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)].map((m) => m[1]);
  const internal = links.filter((h) => h.startsWith("/") || h.startsWith("#"));
  const bodyText = stripTags(html);
  const bodyWords = words(bodyText).length;

  if (!title) {
    findings.push({ check: "seo-onpage", severity: "high", excerpt: null,
      finding: "No <title> tag found.",
      fix: "Add a title of 50-60 characters that leads with the primary keyword." });
  } else if (title.length > 60 || title.length < 30) {
    findings.push({ check: "seo-onpage", severity: "medium", excerpt: title,
      finding: `Title is ${title.length} characters; search results truncate outside roughly 30-60.`,
      fix: title.length > 60
        ? "Trim the title to under 60 characters; cut qualifiers, keep the keyword at the front."
        : "Lengthen the title toward 50-60 characters with a concrete benefit or qualifier." });
  }

  if (!metaDesc) {
    findings.push({ check: "seo-onpage", severity: "high", excerpt: null,
      finding: "No meta description.",
      fix: "Add a 120-155 character meta description that states the article's payoff and includes the keyword once." });
  } else if (metaDesc.length > 160 || metaDesc.length < 70) {
    findings.push({ check: "seo-onpage", severity: "low", excerpt: metaDesc.slice(0, 90),
      finding: `Meta description is ${metaDesc.length} characters; the display window is roughly 120-155.`,
      fix: "Rewrite to 120-155 characters: one sentence of payoff, keyword once, no ellipsis bait." });
  }

  if (h1s.length === 0) {
    findings.push({ check: "seo-onpage", severity: "high", excerpt: null,
      finding: "No <h1> on the page.",
      fix: "Add exactly one <h1> carrying the primary keyword; promote the current top heading if one exists." });
  } else if (h1s.length > 1) {
    findings.push({ check: "seo-onpage", severity: "medium", excerpt: h1s[1],
      finding: `${h1s.length} <h1> tags; an article should carry exactly one.`,
      fix: "Keep the first <h1>, demote the rest to <h2>." });
  }

  if (bodyWords > 500 && h2s.length === 0) {
    findings.push({ check: "seo-onpage", severity: "medium", excerpt: null,
      finding: `${bodyWords} words of body with zero <h2> subheadings.`,
      fix: "Break the body into sections with descriptive <h2>s every 200-300 words; readers and crawlers both use them." });
  }

  if (imgsNoAlt.length > 0) {
    findings.push({ check: "seo-onpage", severity: "medium", excerpt: imgsNoAlt[0].slice(0, 90),
      finding: `${imgsNoAlt.length} of ${imgs.length} images have no alt text.`,
      fix: "Write alt text that describes the image content in one clause; name the keyword only where the image genuinely shows it." });
  }

  if (bodyWords > 800 && internal.length === 0) {
    findings.push({ check: "seo-onpage", severity: "low", excerpt: null,
      finding: "No internal links in the body.",
      fix: "Link 2-4 related articles or category pages with descriptive anchors; orphan pages rank worse and convert worse." });
  }

  let keywordStats = null;
  if (focusKeyword) {
    const kw = focusKeyword.toLowerCase();
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const kwRe = new RegExp(`\\b${escaped.replace(/\s+/g, "\\s+")}\\b`, "gi");
    const count = (bodyText.match(kwRe) || []).length;
    const density = bodyWords ? (count * words(kw).length / bodyWords) * 100 : 0;
    keywordStats = { keyword: focusKeyword, occurrences: count, densityPct: Math.round(density * 100) / 100 };

    if (count === 0) {
      findings.push({ check: "seo-onpage", severity: "high", excerpt: null,
        finding: `Focus keyword "${focusKeyword}" never appears in the body.`,
        fix: "Work the keyword into the first 100 words, one H2, and the conclusion, in natural phrasing." });
    } else if (density > 2.5) {
      findings.push({ check: "seo-onpage", severity: "medium", excerpt: null,
        finding: `Keyword density is ${density.toFixed(1)}% (${count} occurrences); above ~2.5% reads as stuffing.`,
        fix: "Replace repeated exact-match uses with synonyms and pronouns; keep exact match in title, one H2, and the intro." });
    }
    kwRe.lastIndex = 0;
    if (title && !kwRe.test(title)) {
      findings.push({ check: "seo-onpage", severity: "medium", excerpt: title,
        finding: "Focus keyword is missing from the title.",
        fix: "Move the keyword into the title, as close to the front as the phrasing allows." });
    }
  }

  return {
    metrics: {
      titleLength: title ? title.length : 0,
      metaDescriptionLength: metaDesc ? metaDesc.length : 0,
      h1Count: h1s.length,
      h2Count: h2s.length,
      images: imgs.length,
      imagesMissingAlt: imgsNoAlt.length,
      links: links.length,
      internalLinks: internal.length,
      bodyWords,
      keyword: keywordStats,
    },
    findings,
  };
}
