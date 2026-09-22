---
description: Cancel a running Command Code background job.
argument-hint: "<job-id>"
allowed-tools: Bash(node:*)
---

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/command-code-companion.mjs" cancel --stdin <<'COMMAND_CODE_ARGS'
$ARGUMENTS
COMMAND_CODE_ARGS
```
Return stdout verbatim.
