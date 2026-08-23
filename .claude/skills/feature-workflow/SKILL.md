---
name: feature-workflow
description: >-
  Branch-per-feature TDD workflow for the Expenzo monorepo. Use whenever the
  user says "start feature", "start a feature", "new feature", "finish feature",
  "finish the feature", "ship it", "wrap this up", or asks to open a PR for work
  in progress. Also use it automatically, without being asked, the moment you
  begin executing an approved implementation plan in this repo, before writing
  the first line of code. Start feature means sync master, cut a short-named
  branch, write failing unit and e2e tests, then implement until green. Finish
  feature means run format, lint, types and tests, then commit and open a pull
  request, degrading gracefully when there is no git remote or no gh CLI. Do not
  use for read-only questions, code explanation, code review, debugging without
  a code change, or a single edit the user did not frame as a feature or a plan.
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
metadata:
  repo: expenzo
---

# Feature workflow

Two commands drive all feature work in this repo: **Start feature** and
**Finish feature**. Nothing is committed until the full verification gate is
green, and nothing is pushed or opened as a PR without asking first.

## Automatic triggers

- **Beginning execution of an approved plan** runs Start feature first, before
  the first edit. Derive the branch name from the plan's title.
- **An unfinished feature detected** means asking about it before starting a new
  one. Never branch off a feature branch.

## Read the repo state first

Run these before the first git command in a session. Read
`references/git-workflow.md` for the full decision table.

```bash
git rev-parse --is-inside-work-tree
git symbolic-ref --quiet --short HEAD      # fails when HEAD is detached
git status --porcelain                     # empty means a clean worktree
git log --oneline master..HEAD             # commits ahead of master
git remote                                 # empty means no remote at all
```

The short version of the decision table:

| State                              | Do this                                            |
| ---------------------------------- | -------------------------------------------------- |
| Detached HEAD                      | Stop, report, ask. Never check out on your own.    |
| On master, clean                   | Proceed.                                           |
| On master, dirty                   | Ask before touching the edits. Never discard them. |
| On a feature branch, dirty         | Ask: finish that feature first, or park it?        |
| On a feature branch, commits ahead | Say so, and ask before starting another.           |

Derive the trunk branch name rather than assuming `master` — check
`refs/heads/master`, then `refs/heads/main`.

## Start feature

1. State the task in one sentence and confirm that understanding matches.
2. Detect state as above. Resolve anything the table flags.
3. Sync the trunk. With a remote: `git fetch origin`, then
   `git merge --ff-only origin/master`. Without one, skip this step and say so.
   Never `git pull` with an implicit merge or rebase; if the fast-forward
   fails, master has diverged and that is the user's call.
4. Cut the branch as `type/slug` — see the naming rules below. Announce the
   name before creating it: _"Branching `feat/monthly-budget-cap` off master."_
5. **Write the tests first.** Read `references/testing-patterns.md` to pick the
   layers. Run them and quote the failing test name and assertion back to the
   user. A test that passes before the implementation exists is not testing the
   new behaviour — rewrite it.
6. Implement the smallest change that turns those tests green.
7. Re-run the affected workspace's tests, report status, and **stop**. Do not
   commit; that is Finish feature's job.

### Branch naming

`type/slug`, where type is one of `feat`, `fix`, `chore`, `refactor`, `test`,
`docs`, `perf` — matching the Conventional Commits style already in the history.

The slug is the task's verb and object with everything else dropped: lowercase,
hyphen-separated, two to four words, at most 32 characters. No issue numbers, no
dates, no author names. If the branch already exists, append `-2`, `-3`.

| Task                                         | Branch                             |
| -------------------------------------------- | ---------------------------------- |
| Add a monthly budget cap to the expense list | `feat/monthly-budget-cap`          |
| The total doesn't reset on mobile            | `fix/mobile-total-reset`           |
| Pull the currency picker out of the card     | `refactor/extract-currency-picker` |

## Finish feature

1. Refuse when on master, or when the worktree is clean and nothing is ahead of
   master — there is nothing to finish.
2. Run the gate from the repo root, in this order, stopping at the first
   failure:

   ```bash
   pnpm format:check
   pnpm lint
   pnpm check-types
   pnpm test
   pnpm test:e2e      # only when apps/web or packages/ui changed
   ```

   `references/verification.md` has the per-step remedies and the known
   failures worth recognising on sight.

3. Commit. Print the staged file list and the full proposed message first, then
   commit. Conventional Commits, subject at most 72 characters, scope being the
   workspace touched (`ui`, `web`, `mobile`, `repo`).
4. Push — **ask first**, naming the branch, the remote and the commit count.
5. Open the PR — **ask first**, showing the exact title, base, head and body.

Steps 4 and 5 degrade based on what is available. With no remote, stop after the
commit and print the PR title and body you would have used. See
`references/git-workflow.md` for all four modes; the same instructions cover
every one, so nothing here needs editing once a remote and `gh` exist.

### When the gate fails

Stop immediately and do not commit. Report which command, which workspace, and
the first error verbatim rather than paraphrased. Fix it, then **re-run the gate
from the top** — a lint fix can break formatting and a type fix can break a
test.

`pnpm format:check` is the one auto-fixable step: run `pnpm format` and re-run.
That does not count as an attempt.

Budget three full gate attempts. After the third, stop and hand back with a
summary of what still fails and what was tried.

Never reach for `--no-verify`, `.skip`, `.only`, `test.fixme`, a deleted
assertion, a loosened matcher, `@ts-expect-error`, `any`, or a blanket
`eslint-disable` to reach green. If a pre-existing unrelated test fails, say so
and ask whether to fix it here or park it.

## Test-first rule

Tests come before implementation, and they must fail first.

Which layers apply:

- **Unit test: always**, for any change under `packages/ui/src`, `apps/web/src`,
  or `apps/mobile`.
- **E2E test: when web-visible behaviour changes** — a new screen, a new
  interaction, a changed rendered value.
- **Native test: when a `.native.tsx` variant changes**, or a shared
  `*.styles.ts` that one depends on.

A change may skip tests only when **every** file it touches is configuration or
documentation:

```
*.config.*   turbo.json   tsconfig*.json   package.json
pnpm-workspace.yaml   .gitignore   .prettierignore
*.md   .claude/**   .github/**
```

One file under `src/` and tests are mandatory — there is no "too trivial to
test" exception. When the hatch is used, say so in chat and add a
`No test: reason` trailer to the commit, so the decision is auditable rather
than silent.

## Safety

| Action                                              | Confirm first?                                                                                                                                    |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `git fetch`, `git merge --ff-only`, `git switch -c` | No, but announce the branch name before creating it                                                                                               |
| `git add` and `git commit`                          | No — asking to finish the feature _is_ the consent. Show staged files and the full message first. Never commit if the user did not ask to finish. |
| `git push`                                          | **Always ask.** Name the branch, remote and commit count.                                                                                         |
| `gh pr create`                                      | **Always ask.** Show the exact title, base, head and body.                                                                                        |
| `playwright install chromium`                       | No. Local, idempotent, and only when Playwright reports missing browsers.                                                                         |

Never do any of these:

- `git push --force` or `--force-with-lease`
- `git reset --hard`, `git clean -fd`, `git checkout -- .`, `git stash drop`
- `git commit --no-verify`, or `--amend` on a commit that has been pushed
- delete a branch, local or remote
- commit directly on master
- edit `.git/config`, add or change a remote, or run `gh auth login` — tell the
  user the command and let them run it
- merge a PR

If parking work is genuinely right, use
`git stash push -u -m "branch: parked by feature-workflow"`, only after asking,
and tell the user the exact `git stash pop` that restores it.

## Repo facts

- Verify with `pnpm format:check`, `pnpm lint`, `pnpm check-types`, `pnpm test`,
  `pnpm test:e2e`.
- One-time per machine:
  `pnpm --filter @expenzo/web exec playwright install chromium`.
- ESLint is pinned to 9.x because `eslint-config-next` ships a parser that
  crashes on 10, and the shared config carries no type-aware rules because that
  same parser drops `parserOptions.project`. Do not "fix" either.
- Never add `@types/jest`; the hoisted linker leaks it into every program and it
  collides with Vitest. Mobile tests import from `@jest/globals`.
- Mobile native dependencies must match Expo SDK 57 exactly. After touching
  them: `pnpm --filter @expenzo/mobile exec expo install --check`.
- Shared components are split `foo.tsx` (web) and `foo.native.tsx` (native)
  around a common `foo.styles.ts`. Adding one means adding both halves **and**
  both tests.
