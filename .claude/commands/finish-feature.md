---
name: finish-feature
description: Finish the current feature - run the full gate, commit, then push and open a PR after confirming.
argument-hint: [optional note for the commit or PR]
---

Use the `feature-workflow` skill to run **Finish feature** on the current
branch.

$ARGUMENTS

Follow the skill exactly: the full gate must be green before anything is
committed, and both the push and the pull request need explicit confirmation
first. Degrade gracefully when there is no remote or no `gh`.
