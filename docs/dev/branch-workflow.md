# Branch workflow

This repository uses a two-stage release flow:

- `dev` is staging.
- `main` is production.
- Feature branches start from `dev`.
- Feature branches merge into `dev`.
- Only `dev` merges into `main`.

The goal is to keep production protected while avoiding confusing branch drift.

## Feature to dev

Start from an updated `dev`:

```powershell
git switch dev
git pull --ff-only origin dev
```

Create a feature branch:

```powershell
git switch -c feature/my-feature
```

Or create a worktree:

```powershell
git worktree add .worktrees/feature-my-feature -b feature/my-feature dev
cd .worktrees/feature-my-feature
```

Commit and push the feature branch:

```powershell
git add .
git commit -m "feat: my feature"
git push -u origin feature/my-feature
```

Open a pull request:

```text
feature/my-feature -> dev
```

After the pull request is merged, update local `dev`:

```powershell
git switch dev
git pull --ff-only origin dev
```

## Dev to main

When staging is ready for production, open a pull request:

```text
dev -> main
```

Do not open production pull requests from feature branches. The `branch-flow` GitHub workflow fails any pull request into `main` unless the source branch is `dev`.

After the production pull request is merged, GitHub may create a merge commit on `main`. That can make GitHub say `main` is one commit ahead of `dev`, even when there is no file difference.

The `sync-dev-after-main` GitHub workflow fixes that automatically. On every push to `main`, it checks whether `dev` is an ancestor of `main`. If it is, it fast-forwards `dev` to the same commit as `main`.

If the workflow reports that `dev` has commits not included in `main`, leave the branches alone and open a new `dev -> main` pull request after staging is ready again.

## Manual sync fallback

Use this only when the automatic workflow did not run or was blocked by GitHub branch settings:

```powershell
git fetch origin
git switch dev
git pull --ff-only origin dev
git merge --ff-only origin/main
git push origin dev
```

The `--ff-only` flag is intentional. It refuses to create a new merge commit and only moves `dev` forward when that is safe.

## Worktree note

Git allows a branch to be checked out in only one worktree at a time. If Git says a feature branch is already used by a worktree, use that folder instead of switching the main checkout:

```powershell
cd "D:\Royal Glass Dev\rgtools\.worktrees\feature-my-feature"
```
