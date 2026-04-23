---
name: project-log-update
description: Weekly maintenance routine for HISTORY.md and PROJECT_LOG.md using git, code, tests, and the current project state docs.
---

# Project Log Update Skill

Use this skill when updating project memory for the last 7 days of work.

## Goal

Keep `HISTORY.md` and `PROJECT_LOG.md` accurate without inventing facts.

## Inputs To Read First

1. `HISTORY.md`
2. `PROJECT_LOG.md`
3. `NEXT_ACTIONS.md`
4. `PROJECT_STATE.md`
5. Relevant files under `tests/`

## Required Commands

Run these commands before editing:

```powershell
git log --format="%ad %H %s" --date=short --since="7 days ago"
```

For any commit that looks significant, inspect it with:

```powershell
git show --stat --summary <hash>
```

If you need exact line references before citing them:

```powershell
rg -n "<symbol|text>" <file>
```

## Update Rules

1. Read the current `HISTORY.md` and `PROJECT_LOG.md` so you do not rewrite or duplicate old material.
2. Identify only resolved work from the last 7 days.
3. For each resolved item added to `HISTORY.md`, include:
   - exact date from git
   - symptom
   - root cause
   - what changed
   - validation
4. Use `file:line` only when you verified the line number with `rg -n`.
5. If a commit message is vague and the diff does not preserve enough detail, write:
   - `details not recoverable from git`
6. Do not invent browser validations, test outcomes, or root causes.
7. Preserve the existing phase structure in `PROJECT_LOG.md`.
8. Update only the parts of `PROJECT_LOG.md` that changed:
   - new events in the relevant phase
   - the `Current state and open work` section

## Editing Procedure

1. Append new entries to `HISTORY.md` in chronological order.
2. Update the narrative in `PROJECT_LOG.md` to reflect the latest week.
3. Keep the tone honest. This is institutional memory, not marketing.
4. Do not delete older history unless it is duplicated and the replacement is strictly more accurate.

## Output

After editing, provide a short diff-style summary with:

- new dates or commits added to `HISTORY.md`
- what changed in `PROJECT_LOG.md`
- any items you deliberately left as `details not recoverable from git`

## Definition Of Done

- `HISTORY.md` includes all newly resolved items from the last 7 days
- `PROJECT_LOG.md` reflects the latest current state
- all cited line references were verified
- no invented facts were added
