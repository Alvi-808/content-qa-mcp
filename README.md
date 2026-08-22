# content-qa-mcp

An MCP (Model Context Protocol) server for editorial content QA. Point Claude at an article and get a findings report where **every finding comes with the fix attached**, so the report is usable instead of only correct.

That findings-with-fixes contract is enforced by the test suite: a check that emits a finding without an actionable fix fails the suite.

## What it does

Four tools, one prompt, zero API keys. Everything runs locally.

| Tool | Input | What it checks |
|---|---|---|
| `qa_full_report` | HTML or plain text, optional focus keyword | Runs all checks below, merges findings, sorts by severity, returns a publish/fix/block verdict |
| `readability_check` | plain text | Flesch-Kincaid grade, long sentences, passive-voice share |
| `ai_tell_scan` | plain text | Stock phrases ("delve into", "in today's fast-paced world", 15 patterns total), em/en-dash density, arrow glyphs, emoji in body prose |
| `seo_onpage_check` | article HTML, optional focus keyword | Title and meta length, H1/H2 structure, image alt coverage, internal links, keyword presence and density |

Plus a `qa_review` prompt that drives the full report and asks the model for an editorial verdict without softening or inventing findings.

Every finding is one object:

```json
{
  "check": "seo-onpage",
  "severity": "high",
  "excerpt": null,
  "finding": "No meta description.",
  "fix": "Add a 120-155 character meta description that states the article's payoff and includes the keyword once."
}
```

See a full run in [`samples/sample-report.md`](samples/sample-report.md): 22 findings on the deliberately broken fixture article, regenerable with `npm run sample`.

## Install and register in Claude Code

```bash
git clone <this repo>
cd content-qa-mcp
npm install
npm test        # 14 tests, includes a real MCP client/server handshake
```

Register (Claude Code CLI):

```bash
claude mcp add content-qa -- node /absolute/path/to/content-qa-mcp/src/server.js
```

Verified working:

```
content-qa: C:\Program Files\nodejs\node.exe C:\...\content-qa-mcp\src\server.js - √ Connected
```

Then, in a Claude Code session: "run qa_full_report on this article" or use the `qa_review` prompt.

Remove with `claude mcp remove content-qa`.

### Windows note (the part most tutorials skip)

On Windows, register stdio MCP servers with the **absolute path to `node.exe`** and the script:

```bash
claude mcp add content-qa -- "C:\Program Files\nodejs\node.exe" "C:\path\to\content-qa-mcp\src\server.js"
```

Registrations that go through `npx` or a `.cmd` shim routinely fail to connect on Windows because the spawned process never attaches stdio correctly, and the failure is silent. Absolute `node.exe` plus the script path works every time. The end-to-end test in this repo uses the same pattern (`process.execPath`).

## Design notes

- **Checks are pure functions** in `src/checks/`, importable without MCP. The server is a thin protocol layer over them, so the same checks can run in CI, a git hook, or a pipeline.
- **The SEO check is scoped on purpose.** It parses well-formed CMS article output (WordPress, Ghost, static-site generators) with regex extraction. It is not a general HTML parser and does not try to survive adversarial markup. Naming the boundary beats pretending there isn't one.
- **Plain-text input skips the SEO check** instead of reporting fake "missing tag" findings.
- **The stock-phrase list bans classes, not strings.** Each entry is a pattern, so one-word rewrites of a cliche still get caught.

## Why this exists

This is the working method behind my paid editorial QA work, packaged as tools an agent can call. The rule it encodes: a QA report that says what is wrong without saying what to do next just moves the work to someone else's desk. Findings ship with fixes or they don't ship.

## License

MIT
