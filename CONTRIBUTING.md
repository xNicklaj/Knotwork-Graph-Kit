# Contributing

Knotwork is licensed under [MPL-2.0](LICENSE). By contributing you agree your changes are released under it.

## Sign off your commits (DCO)

Every commit in a contribution must carry a `Signed-off-by` line, which certifies the [Developer Certificate of Origin](https://developercertificate.org/): you wrote the change or have the right to submit it under this project's license.

```
git commit -s -m "fix: ..."
```

adds `Signed-off-by: Your Name <you@example.com>` using your git `user.name` and `user.email`. Forgot? `git rebase --signoff main` (or `git commit --amend -s` for the last commit), then force-push your own branch. A CI check (`.github/workflows/dco.yml`) fails a pull request that has an unsigned commit.

## Before you open a pull request

Read [CLAUDE.md](CLAUDE.md) (the rules that are easy to break), then run `npm run typecheck`, `npm test` and `npm run build`. New source files start with the MPL notice used in the existing ones.
