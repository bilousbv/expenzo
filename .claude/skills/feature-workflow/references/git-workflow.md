# Git workflow reference

Everything the feature workflow needs to know about repository state, told from
git rather than from a state file. A state file would be a second source of
truth and would go stale the moment someone switches branches outside a Claude
session; git already records every fact needed except "does a PR exist", which
`gh pr view` answers when `gh` is available.

## Detecting state

Run these individually rather than as a script, so each result is visible on its
own when something disagrees.

```bash
git rev-parse --is-inside-work-tree                     # 1 sanity check
git symbolic-ref --quiet --short HEAD                   # 2 branch; fails when detached
git status --porcelain                                  # 3 empty means clean
git rev-parse --verify --quiet refs/heads/master        # 4 trunk exists locally
git log --oneline master..HEAD                          # 5 commits ahead of trunk
git remote                                              # 6 empty means no remote
git rev-parse --abbrev-ref --symbolic-full-name '@{u}'  # 7 fails when no upstream
git log --oneline '@{u}..HEAD'                          # 8 only when 7 succeeded
```

### Finding the trunk branch

Do not hardcode `master`. In order:

1. `git symbolic-ref --quiet --short refs/remotes/origin/HEAD` when a remote
   exists — strip the `origin/` prefix.
2. `git rev-parse --verify --quiet refs/heads/master`
3. `git rev-parse --verify --quiet refs/heads/main`

This repo uses `master` today; detecting it keeps the workflow working through a
future rename.

## Decision table

| Branch (2) | Worktree (3) | Ahead (5) | Upstream (7/8)              | State                     | Action                                                                                                                                                          |
| ---------- | ------------ | --------- | --------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| detached   | any          | —         | —                           | Detached HEAD             | **Stop.** Report and ask. Never check out on your own.                                                                                                          |
| trunk      | clean        | —         | —                           | Idle                      | Proceed with Start feature.                                                                                                                                     |
| trunk      | dirty        | —         | —                           | Stray edits on trunk      | **Ask** before touching them: carry them onto the new branch (`git switch -c` keeps them), stash them, or abort. Carrying them is usually right. Never discard. |
| feature    | clean        | 0         | —                           | Empty branch              | Cut but nothing done. Continue it, or ask whether to delete and start fresh.                                                                                    |
| feature    | dirty        | any       | —                           | **In progress**           | **Ask:** "`branch` has uncommitted work. Finish that feature first, or park it and start the new one?"                                                          |
| feature    | clean        | > 0       | no remote                   | Committed, no PR possible | **Ask:** "`branch` has N commits and there is no remote, so no PR was opened. Start the new feature anyway?"                                                    |
| feature    | clean        | > 0       | upstream set, (8) empty     | Pushed                    | Likely already has a PR — confirm with `gh pr view --json state,url` when `gh` exists. Safe to start something new; mention it in one line.                     |
| feature    | clean        | > 0       | upstream set, (8) non-empty | Committed but unpushed    | **Ask:** "`branch` has N unpushed commits. Push and open the PR first?"                                                                                         |

## Capability detection

Run once at the top of both commands. Skip the `gh` probes entirely when there
is no remote — they are pointless and slow.

```bash
git remote                    # empty stdout  -> no remote
git remote get-url origin     # the URL, when origin exists
gh --version                  # non-zero exit -> gh not installed
gh auth status                # non-zero exit -> gh not authenticated
```

## The four modes

The same instructions cover all four. Nothing needs editing when a remote or
`gh` appears — the detection simply lands on a different row.

### Mode A — no remote (the current state of this repo)

- **Start feature:** skip the fetch. `git switch master && git switch -c branch`.
  Say that the sync was skipped and why.
- **Finish feature:** run the gate, `git add`, `git commit`, then **stop**.
- **Tell the user:** "No git remote is configured, so I committed on `branch`
  and stopped there. Once you run `git remote add origin URL`, say 'finish
  feature' again and I'll push and open the PR." Then print the PR title and
  body that would have been used, so nothing is lost.

### Mode B — remote present, `gh` missing

- **Start feature:** `git fetch origin`, `git switch master`,
  `git merge --ff-only origin/master`, `git switch -c branch`.
- **Finish feature:** gate, commit, ask, `git push -u origin branch`, then
  derive and print the compare URL.
- **Tell the user:** "Pushed. `gh` isn't installed, so open the PR here:
  `COMPARE_URL` — or install it with `winget install --id GitHub.cli` and say
  'finish feature' again."

### Mode C — `gh` present but not authenticated

Same as B through the push, then: "Pushed. `gh` is installed but not
authenticated. Run `gh auth login`, then say 'finish feature' and I'll open the
PR. Or use `COMPARE_URL`."

Never run `gh auth login` on the user's behalf.

### Mode D — remote and authenticated `gh`

Gate, commit, ask, push, then show the exact title, base, head and body and ask
before running:

```bash
gh pr create --base master --head branch --title "..." --body "..."
```

Print the resulting PR URL. Never open a draft PR as a way of skipping the
confirmation.

## Deriving the compare URL

Parse `git remote get-url origin`, handling both forms:

- `git@github.com:owner/repo.git`
- `https://github.com/owner/repo.git`

Strip the `.git` suffix, then build:

```
https://github.com/owner/repo/compare/master...branch?expand=1
```

When the host is not `github.com`, say so and skip the URL rather than emitting
a wrong one.

## Pull semantics

Only `git fetch` followed by `git merge --ff-only`. Never `git pull` with an
implicit merge or rebase on the trunk. When the fast-forward fails, the trunk has
diverged from the remote — stop and report it. Reconciling that is the user's
call, not the workflow's.

## Commit message format

```
type(scope): imperative subject, at most 72 characters

What changed and why, wrapped at 100 columns.

No test: reason          # only when the config-only hatch was used
```

Scope is the workspace touched: `ui`, `web`, `mobile`, or `repo` for changes
that span the monorepo itself.
