---
description: List models reported by the installed Command Code CLI.
argument-hint: "[filter]"
allowed-tools: Bash(node:*)
---

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/command-code-companion.mjs" models --stdin <<'COMMAND_CODE_ARGS'
$ARGUMENTS
COMMAND_CODE_ARGS
```
Return stdout verbatim.
