---
description: Delegate an investigation, fix, refactor, or implementation task to Command Code's native CLI harness.
argument-hint: "[--background|--wait] [--resume|--fresh] [--write|--read-only] [--model <id>] [--effort <level>] <task>"
context: fork
allowed-tools: Bash(node:*), AskUserQuestion
---

Delegate this request to the `command-code:command-code-rescue` subagent.

Raw user request:
$ARGUMENTS

Rules:
- Preserve `--model`, `--effort`, `--write`, and `--read-only`.
- `--resume` means resume the last native Command Code session for this workspace.
- `--fresh` means force a fresh native Command Code session.
- `--background` returns a job id immediately; `--wait` or no execution flag waits for completion.
- If no task text is supplied, ask what Command Code should do.
- Return the companion's output without rewriting it.
