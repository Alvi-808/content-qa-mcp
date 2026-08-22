#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readabilityCheck } from "./checks/readability.js";
import { aiTellScan } from "./checks/aiTells.js";
import { seoOnpageCheck } from "./checks/seoOnpage.js";
import { fullReport } from "./checks/fullReport.js";

const server = new McpServer({
  name: "content-qa",
  version: "1.0.0",
});

const asText = (obj) => ({
  content: [{ type: "text", text: JSON.stringify(obj, null, 2) }],
});

server.registerTool(
  "qa_full_report",
  {
    title: "Full editorial QA report",
    description:
      "Run every check (readability, AI-writing tells, on-page SEO) on one article and return a single report. Every finding comes with the fix attached. Accepts raw HTML (preferred) or plain text; the SEO check only runs on HTML input.",
    inputSchema: {
      input: z.string().describe("The article: raw HTML (preferred) or plain text"),
      focusKeyword: z.string().optional().describe("Primary keyword the article targets"),
    },
  },
  async ({ input, focusKeyword }) => asText(fullReport(input, focusKeyword ?? null))
);

server.registerTool(
  "readability_check",
  {
    title: "Readability check",
    description:
      "Flesch-Kincaid grade, long-sentence and passive-voice findings for article prose. Plain text in; findings with fixes out.",
    inputSchema: {
      text: z.string().describe("Article prose, plain text"),
    },
  },
  async ({ text }) => asText(readabilityCheck(text))
);

server.registerTool(
  "ai_tell_scan",
  {
    title: "AI-writing tell scan",
    description:
      "Scan prose for machine-writing tells: stock phrases (delve into, in today's fast-paced world, ...), em/en-dash density, arrow glyphs, emoji. Findings with fixes.",
    inputSchema: {
      text: z.string().describe("Article prose, plain text"),
    },
  },
  async ({ text }) => asText(aiTellScan(text))
);

server.registerTool(
  "seo_onpage_check",
  {
    title: "On-page SEO check",
    description:
      "Title, meta description, heading structure, image alt coverage, internal links, and keyword usage for one article's HTML. Built for well-formed CMS article output (WordPress, Ghost, static sites), not adversarial markup.",
    inputSchema: {
      html: z.string().describe("The article page HTML"),
      focusKeyword: z.string().optional().describe("Primary keyword the article targets"),
    },
  },
  async ({ html, focusKeyword }) => asText(seoOnpageCheck(html, focusKeyword ?? null))
);

server.registerPrompt(
  "qa_review",
  {
    title: "Editorial QA review",
    description: "Review an article with the QA tools and write the editorial verdict a client can act on.",
    argsSchema: {
      article: z.string().describe("The article HTML or text to review"),
    },
  },
  ({ article }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text:
            "Run qa_full_report on the article below, then write a short editorial verdict: lead with publish/fix/block, list the findings in severity order, and keep each finding paired with its fix. Do not soften findings and do not invent findings the tools did not report.\n\n" +
            article,
        },
      },
    ],
  })
);

const transport = new StdioServerTransport();
await server.connect(transport);
