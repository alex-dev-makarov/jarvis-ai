---
description: Cross-branch overview — what's in flight on every branch at once. Read-only.
---

Run `node .jarvis/bin/jarvis.mjs overview` and print its output as-is.
Then, only for lines starting with ⚠ or ℹ, add at most one line each on
what the user might do next. No other reads, no file opened in full —
the script already counted everything.

If the script is missing: tell the user to re-run install.sh.
