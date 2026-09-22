---
description: Run a read-only Command Code review of local changes.
argument-hint: "[--base <ref>] [--background] [--model <id>] [--effort <level>] [focus]"
allowed-tools: Bash(node:*)
---

Run and return stdout verbatim:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/command-code-companion.mjs" review --stdin <<'COMMAND_CODE_ARGS'
$ARGUMENTS
COMMAND_CODE_ARGS
```
