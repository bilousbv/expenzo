---
name: start-feature
description: Start a new feature - sync the trunk, cut a branch, write failing tests, then implement until green.
argument-hint: [task description]
---

Use the `feature-workflow` skill to run **Start feature** for this task:

$ARGUMENTS

Follow the skill exactly: detect repository state first, resolve anything the
decision table flags, announce the branch name before creating it, and write the
tests before the implementation.
