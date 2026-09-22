---
description: Show usage and prompt-cache telemetry from the most recent Command Code run or a specific job.
argument-hint: "[job-id]"
allowed-tools: Bash(node:*)
---

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/command-code-companion.mjs" usage --stdin <<'COMMAND_CODE_ARGS'
$ARGUMENTS
COMMAND_CODE_ARGS
```
Return stdout verbatim.
