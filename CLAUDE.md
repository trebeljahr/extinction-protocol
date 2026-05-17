# Mesozoic Protocol — Agent Notes

Tower defense game. Worktrees under `.claude/worktrees/<name>`.

## Playtest Todo Source

Manual playtest notes for this project live in the **ricos.site Obsidian vault**, NOT in this repo:

```
/Users/rico/projects/ricos.site/src/content/Notes/texts/misc/claude-chat-gpt-generated/mesozoic-protocol/
```

Files are numbered `N-mesozoic-protocol-manual-(testing-)notes.md`. Highest N = newest list.
Older numbered files (`1-…` through `9-…`) are historical; check the latest one for active todos.

Format: GitHub task list. `- [ ]` open, `- [x] … → resolution summary` done.

## Sub-Task Spawning Workflow

When Rico says "spawn sub-tasks from the new todos":

1. Read the highest-N file in the mesozoic-protocol folder above.
2. For each `- [ ]` item, call `mcp__ccd_session__spawn_task` with:
   - Self-contained prompt (no reference to this conversation).
   - Repo root `/Users/rico/projects/mesozoic-protocol`.
   - Verbatim problem statement from the note + file/system pointers.
3. Do NOT tick the items yet — only after they ship to `main`.

## Done → Integrate → Tick (strict order)

After a spawned sub-task finishes implementation:

1. Commit on the worktree branch.
2. Rebase the worktree branch onto `main` (`git rebase main` from inside the worktree).
3. Fast-forward merge into `main` (`git merge --ff-only <branch>` from the main worktree).
   - Never create a merge commit.
   - Resolve conflicts in place during the rebase; do not sidestep with a merge commit.
   - If main worktree has WIP blocking the ff merge: stash → ff-merge → pop, preserving WIP.
4. ONLY after the merge lands on `main`, edit the vault file in `ricos.site` and tick the corresponding `- [x]` checkbox (optionally append `→ resolution summary`).
5. Commit the vault edit in the ricos.site repo (separate commit from the project code).

If integration fails (conflicts, broken build, failing tests), fix before ticking. The vault must never claim done work that isn't on `main`.

## Repo Layout (high-level)

- `src/sim/` — game simulation (path, waves, enemies, towers, heroes)
- `src/canvas/` — render layer
- `src/components/` — UI / overlays
- `src/scripts/` — tooling
- `HERO_KITS_PLAN.md`, `DESIGN.md` — design docs

## Conventions

- No Co-Authored-By / AI attribution in commit messages.
- Commit messages: concise, focus on "why".
- Never `git pull` (merges by default). Use `git fetch` + `git rebase`.
- Don't push to remote / open PRs unless explicitly asked.
