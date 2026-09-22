---
description: View or update Command Code Companion defaults.
argument-hint: "[--model <id>|--clear-model] [--effort <level>|--clear-effort] [--review-gate on|off]"
allowed-tools: Bash(node:*)
---

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/command-code-companion.mjs" config --stdin <<'COMMAND_CODE_ARGS'
$ARGUMENTS
COMMAND_CODE_ARGS
```
Return stdout verbatim.
