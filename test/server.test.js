import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const here = dirname(fileURLToPath(import.meta.url));
const serverPath = join(here, "..", "src", "server.js");

test("MCP end-to-end: initialize, list tools, call a tool, list prompts", async () => {
  const transport = new StdioClientTransport({
    command: process.execPath, // absolute node binary: the reliable pattern on Windows
    args: [serverPath],
  });
  const client = new Client({ name: "content-qa-test", version: "1.0.0" });
  await client.connect(transport);

  try {
    const tools = await client.listTools();
    const names = tools.tools.map((t) => t.name).sort();
    assert.deepEqual(names, [
      "ai_tell_scan",
      "qa_full_report",
      "readability_check",
      "seo_onpage_check",
    ]);

    for (const tool of tools.tools) {
      assert.deepEqual(
        tool.annotations,
        { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
        `${tool.name} must declare all four tool annotations`
      );
    }

    const res = await client.callTool({
      name: "ai_tell_scan",
      arguments: { text: "In today's fast-paced world, we delve into espresso — deeply — and thoroughly." },
    });
    const payload = JSON.parse(res.content[0].text);
    assert.ok(payload.findings.length >= 2, "expected stock-phrase findings");
    assert.ok(payload.findings.every((f) => typeof f.fix === "string" && f.fix.length > 0));

    const prompts = await client.listPrompts();
    assert.equal(prompts.prompts.length, 1);
    assert.equal(prompts.prompts[0].name, "qa_review");
  } finally {
    await client.close();
  }
});
