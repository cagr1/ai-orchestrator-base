---
type: workflow-rules
updated: 2026-04-21
---

# WORKFLOW_RULES.md

These rules are not guidelines. Violations are invalid regardless of outcome.

---

## Rule 1 — Clean Rerun Is the Only Valid Test

**A run result is accepted only if the loop closes from a wiped state.**

Procedure:
1. Delete all files inside `C:\Users\Windows\Documents\demo2` (or confirm they are absent).
2. Run `node runner.js init "<goal>" --root "C:\Users\Windows\Documents\demo2"` via dashboard or CLI.
3. Run `node runner.js run --root "C:\Users\Windows\Documents\demo2"` (or trigger via dashboard).
4. The run must reach `all_tasks_completed` without human intervention.
5. Inspect `ROOT_DIR/system/evidence/` — every `done` task must have a corresponding JSON file with at least one `files_changed` path inside `C:\Users\Windows\Documents\demo2`.

A run that passes only because state was preserved from a prior run is REJECTED.  
A run that passes only for one specific goal type and fails on others is REJECTED.

---

## Rule 2 — Verify the File Write Root Before Any Run

Before triggering execution:
1. Confirm `system/dashboard.json → project_root` equals `C:\Users\Windows\Documents\demo2`.
2. Confirm the runner is invoked with `--root "C:\Users\Windows\Documents\demo2"` (via dashboard or explicitly in CLI).
3. After a run, confirm at least one output file physically exists under `C:\Users\Windows\Documents\demo2`.

`config.json → evidence.project_root` is NOT the write-root gate. Do not use it for this check.  
If `project_root` in `dashboard.json` is empty or wrong: STOP. Fix it before any run.

---

## Rule 3 — No Task Weakening

Tasks must not be modified to pass a stuck run. Prohibited without a logged diagnosis:
- Removing or reducing acceptance criteria or declared outputs
- Marking a task `done` without corresponding evidence
- Splitting a blocked task to bypass an undiagnosed blocker
- Adding a `_fix` task to route around a failed task without explaining why the original failed

Any task change requires an entry in `CHANGELOG_EXECUTION.md` with the reason.

---

## Rule 4 — Read Memory Before Any Change

Before modifying any of these files, read `PROJECT_STATE.md` and `NEXT_ACTIONS.md`:
- `C:\Users\Windows\Documents\demo2\system\tasks.yaml`
- `system/config.json` or `system/dashboard.json`
- `runner.js`
- Any file in `agents/*.md` or `providers/`

Purpose: prevent reintroducing diagnosed problems and repeating failed approaches.

---

## Rule 5 — No Patch Without Diagnosis

Sequence before any code change:
1. Observe the symptom (exact halt code, log line, or behavior).
2. Trace the execution path to the specific function or condition in runner.js.
3. Record the root cause in `CHANGELOG_EXECUTION.md`.
4. Write the minimal targeted change.
5. Validate with clean rerun (Rule 1).

Skipping steps 2–3 is a violation. Structural debt items (listed in PROJECT_STATE.md) do not bypass this sequence.

---

## Rule 6 — One Active Goal, Always Set

`system/dashboard.json → prompt` must be non-empty before any run.  
An empty `prompt` produces undefined planner behavior. Set the goal explicitly, always.

---

## Rule 7 — Generalize, Do Not Optimize for One Task

The control system applies to any goal on any task set.  
Fixes must not assume a specific task count, task ID, or goal type.  
If a fix only works for the landing page goal, it is not a fix — it is a workaround.

---

## Rule 8 — Session Discipline

Every Claude Code session with the architect follows this protocol:

**At session start** — read before acting:
1. `PROJECT_STATE.md` — where are we
2. `NEXT_ACTIONS.md` — what is the active blocker
3. Do NOT assume state from conversation memory alone

**During session** — one blocker at a time:
- Fix the P1 item in NEXT_ACTIONS before touching P2+
- Any runner.js structural change must go through `arch-reviewer` agent
- Any targeted fix with known location → use `patch-worker` agent

**At session end** — always update:
1. `CHANGELOG_EXECUTION.md` — what changed and why
2. `PROJECT_STATE.md` — update "Confirmed Working" and "Known Issues"
3. `NEXT_ACTIONS.md` — close resolved items, promote next P1

This protocol is what prevents context loss between sessions. The docs ARE the memory.

---

## Rule 9 — LLM Assignment

| Task type | LLM |
|-----------|-----|
| Code generation (frontend/backend) | Codex |
| Draft / prototype | minimax/minimax-m2.7 |
| Architectural review | Claude Code (architect) |
| Planner / QA / Reviewer agents | configured per skill in config.json |

Do not run production code-generation tasks on minimax. It generates verbose output that triggers truncation retries and degrades quality.

---

## Enforcement

The architect role owns these rules.  
Violations must be logged in `CHANGELOG_EXECUTION.md` under a `VIOLATION` entry before work continues.
