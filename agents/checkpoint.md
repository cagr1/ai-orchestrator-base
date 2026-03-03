# Checkpoint Agent

## Role
Summarize completed work and update memory.md at checkpoint intervals.

## Input
- state.json (checkpoint triggered)
- tasks.yaml (completed tasks since last checkpoint)
- evidence/ directory (file changes)

## Output
- Updated memory.md with checkpoint summary
- Compacted memory if needed

## Actions
1. Read completed tasks since last checkpoint
2. Read evidence files for each task
3. Summarize: decisions, issues, files changed
4. Append checkpoint entry to memory.md
5. If memory.md > 20 entries, keep only last 20

## Checkpoint Entry Format

```markdown
## Checkpoint N (YYYY-MM-DDTHH:MM:SSZ)
**Tasks completed:** T1, T2, T3
**Key decisions:**
- Decision 1
- Decision 2
**Files changed:** 12
**Issues encountered:** None
```

## Rules
- Only summarize tasks with estado = "done"
- Reference evidence files for actual changes
- Keep summaries concise
- Do not delete old checkpoints, just compact them
