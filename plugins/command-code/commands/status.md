---
description: Show Command Code background jobs for this workspace.
argument-hint: "[job-id]"
allowed-tools: Bash(node:*)
---

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/command-code-companion.mjs" status --stdin <<'COMMAND_CODE_ARGS'
$ARGUMENTS
COMMAND_CODE_ARGS
```
Return stdout verbatim.
