---
name: finish-feature
description: Finish the current feature - run the full gate, commit, then push and open a PR after confirming, and invite a /compact.
argument-hint: [optional note for the commit or PR]
---

Use the `feature-workflow` skill to run **Finish feature** on the current
branch.

$ARGUMENTS

Follow the skill exactly: the full gate must be green before anything is
committed, and both the push and the pull request need explicit confirmation
first. Degrade gracefully when there is no remote or no `gh`.

Close by inviting a `/compact`, which the user runs and you cannot. Skip that
line if the gate failed or if the next step already depends on this feature's
details.
