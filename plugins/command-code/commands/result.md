---
description: Show the stored output and usage/cache telemetry for a Command Code job.
argument-hint: "<job-id>"
allowed-tools: Bash(node:*)
---

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/command-code-companion.mjs" result --stdin <<'COMMAND_CODE_ARGS'
$ARGUMENTS
COMMAND_CODE_ARGS
```
Return stdout verbatim.
