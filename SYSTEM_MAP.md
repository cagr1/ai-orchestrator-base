---
type: system-map
updated: 2026-04-21
---

# SYSTEM_MAP.md

---

## Execution Flow

```
User sets goal + project_root in dashboard UI
       │
       ▼
dashboard-service.js: getActiveRoot() → reads system/dashboard.json → project_root
       │
       ├── project_root empty → reject, do not run
       │
       ▼
dashboard-service.js: triggerRun()
  → spawn: node runner.js run --root "C:\Users\Windows\Documents\demo2"
       │
       ▼
runner.js: ACTIVE_ROOT = --root arg → ROOT_DIR = ACTIVE_ROOT
  All paths anchored to ROOT_DIR from this point forward.
       │
       ▼
  Read ROOT_DIR/system/config.json      ← models, evidence rules, limits
  Read ROOT_DIR/system/state.json       ← run lock, phase, iteration counter
  Read ROOT_DIR/system/tasks.yaml       ← task list (created by init/planner)
       │
       ├── tasks.yaml missing or empty → halt: no_tasks_planned
       │
       ▼
  recalculateTaskStates(tasks)
    → For each non-done task: check depends_on all in completedIds
    → blocked if not; pending if was blocked and now resolved
       │
       ▼
  Select executable batch
    → pending tasks with resolved deps, within batch size limits
       │
       ├── none found → halt: no_executable_tasks
       │
       ▼
  For each task in batch:
    ├── Hash ROOT_DIR/system/tasks.yaml (for write-lock: expectedHash)
    ├── Build LLM prompt (agent role + skill file + task spec)
    ├── Call OpenRouter → raw text response
    ├── Parse response → {files: [{path, content}]}
    ├── For each file: write to path.join(ROOT_DIR, file.path)
    ├── Snapshot declared output hashes before/after → detect real changes
    ├── If no declared outputs changed → throw (task not accepted)
    ├── Write ROOT_DIR/system/evidence/{task_id}.json
    ├── Mark task done in tasksDoc (in-memory)
    └── saveTasksWithLock(tasksDoc, expectedHash)
          → if tasks.yaml hash changed since read → halt: tasks_yaml_conflict
       │
       ▼
  recalculateTaskStates again after completions
  updateTaskMetadata
       │
       ▼
  Check if all tasks done → halt: all_tasks_completed  ← TARGET STATE
  Check if max iterations reached → halt: max_iterations_reached
  Otherwise → next iteration
       │
       ▼
  Append ROOT_DIR/system/runs/{run_id}/history.log
  Append ROOT_DIR/system/events.log
```

---

## Key Files

| File | Location | Role |
|------|----------|------|
| `runner.js` | orchestrator root | Orchestration engine — all logic |
| `dashboard-service.js` | `src/web/services/` | Reads dashboard.json, spawns runner with `--root` |
| `system/dashboard.json` | orchestrator `system/` | Stores `project_root` and active `prompt` |
| `system/config.json` | orchestrator `system/` | Models, evidence rules, provider config |
| `{ROOT_DIR}/system/tasks.yaml` | **project root** | Task list, statuses, deps — source of truth |
| `{ROOT_DIR}/system/state.json` | **project root** | Run lock, phase, iteration, halt_reason |
| `{ROOT_DIR}/system/evidence/{task_id}.json` | **project root** | Proof of real file changes per task |
| `{ROOT_DIR}/system/events.log` | **project root** | Full event log |
| `{ROOT_DIR}/system/runs/{run_id}/history.log` | **project root** | Per-run phase/status snapshots |
| `providers/openrouter.js` | orchestrator root | LLM API bridge |
| `agents/*.md` | orchestrator root | Agent role prompts (planner, executor, qa, reviewer) |
| `PROJECT_STATE.md` | orchestrator root | Current system state — architect truth |
| `WORKFLOW_RULES.md` | orchestrator root | Non-negotiable rules |
| `CHANGELOG_EXECUTION.md` | orchestrator root | Attempt log with decisions |
| `NEXT_ACTIONS.md` | orchestrator root | One blocker, one next step |

**Important**: Files under `{ROOT_DIR}/system/` live in the **project directory** (`C:\Users\Windows\Documents\demo2\system\`), NOT in the orchestrator directory. They are wiped when the user clears the project root. The orchestrator's own `system/` dir (`e:\Carlos\...\ai-orchestrator-base\system\`) is a separate namespace.

---

## Module Responsibilities

### runner.js
- Sets `ROOT_DIR` from `--root` CLI flag; falls back to `__dirname` if absent.
- Reads tasks from `ROOT_DIR/system/tasks.yaml`.
- Selects executable batch; calls LLM per task.
- Writes output files to `path.join(ROOT_DIR, file.path)`.
- Hash-guards tasks.yaml writes via `saveTasksWithLock` (conflict detection at line 837).
- Does NOT enforce that `file.path` values stay within declared `task.outputs` boundaries — warns only (line 2245).
- Does NOT enforce that `file.path` values stay within `ROOT_DIR` — no path escape check.

### dashboard-service.js
- Reads `system/dashboard.json` for `project_root` and `prompt`.
- Passes `project_root` to runner as `--root` flag.
- Is the correct invocation path when running via web UI.
- Direct CLI invocations without `--root` will use `__dirname` as root — wrong for production use.

### providers/openrouter.js
- Wraps OpenRouter API call.
- Maps task `skill` to model via `config.json → model_mapping`.
- Returns raw LLM text.

### system/tasks.yaml (in project root)
- Authoritative task state for the active run.
- Fields per task: `id`, `estado`, `skill`, `depends_on`, `outputs`, `acceptance_criteria`.
- Valid estados: `pending`, `in_progress`, `done`, `failed`, `blocked`, `split_required`.
- Does not persist across user wipes of `project_root` — by design.

### system/dashboard.json (in orchestrator)
- `project_root`: absolute path to the project being built.
- `prompt`: active goal text. Must be non-empty before init or run.
- Persists across project wipes (it's in the orchestrator, not the project).

### agents/*.md
- Injected as system context into LLM calls.
- `executor.md` defines output format: `{files: [{path, content}]}`.

---

## buildExecutionPrompt — Context Injection (added 2026-04-21)

The prompt builder now injects three types of context:

1. **Existing output context**: If the task's output files already exist (e.g., retry), reads up to 500 chars as "modify rather than recreate" hint.
2. **Input file content** (new): Reads and embeds the FULL content of every file listed in `task.input`. This allows downstream tasks (e.g., T4 script.js) to see the actual HTML and CSS they must integrate with.
3. **Truncation retry hint**: If `task.truncation_retry = true`, instructs LLM to keep response under 120 lines.

This resolves the "isolated artifact" problem where each file was generated without knowledge of sibling files.

---

## Known Gaps

| # | Gap | Severity | Status |
|---|-----|----------|--------|
| 1 | `tasks_yaml_conflict` fires within a single run iteration — root cause untraced | High | Open |
| 2 | Runner does not verify that `file.path` values from LLM stay inside `ROOT_DIR` | Medium | Open |
| 3 | Runner warns but does not block when LLM outputs files not in declared `task.outputs` | Medium | Open |
| 4 | No automated clean-rerun gate — validation is entirely manual | High | Open |
| 5 | Direct CLI runs without `--root` silently use orchestrator dir as ROOT_DIR | High | Open |
| 6 | No Resume button in dashboard UI — must use CLI when paused | Low | Open |
| 7 | `refreshSkills`/`detectSkills` in dashboard-service.js missing `--root` | Low | Open |

These gaps are structural debt. Do not patch without diagnosis (WORKFLOW_RULES Rule 5).
