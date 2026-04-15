BATCH 1
Root cause: RC2
Objective: Eliminate deterministic tasks_yaml_conflict caused by stale tasksHash reuse during a single run.
Files: runner.js
Functions:
saveTasksWithLock
main (run/resume branch)
Exact change:
In run flow, stop reusing one tasksHash captured once before execution for all later saves.
Before each saveTasksWithLock(...) call in the same run branch, compute a fresh expected hash from current TASKS_FILE, or update the expected hash immediately after a successful save and use the updated value for next save.
Apply this to both save points in the AUTO_EXECUTE path:
post-task-update save block
final save block before batch_ready/exit
Keep conflict detection logic intact; only fix hash lifecycle usage.
Do not touch:
Lock acquisition/release semantics (acquireLock, releaseLock)
Evidence generation/writes
Task selection/execution logic
Manual validation:
Start a run where at least one task is executed and marked done.
Confirm no log: Could not save tasks (lock expired or hash mismatch) for normal single-run execution.
Confirm no automatic needs_review caused by tasks_yaml_conflict.
Confirm tasks.yaml persists estado: done for executed task(s).

BATCH 2
Root cause: RC1
Objective: Ensure runtime always executes against a valid, usable target workspace root (not repo-relative folder-name/. fallback from UI capture).
Files:
src/web/public/dashboard/index.html
src/web/services/dashboard-service.js
Functions:
Frontend handlers:
browseFolderBtn click handler
projectSaveBtn click handler
createProjectBtn click handler
Backend:
updateDashboardConfig
initProject
getActiveRoot / getPaths
Exact change:
Remove folder-upload-name capture as authoritative project_root source in frontend flow.
Require project_root passed to backend to be explicit usable path (no implicit '.' fallback on create/start request).
In backend config write/init path, normalize and persist resolved project root path once, and keep getActiveRoot/getPaths consuming that persisted value.
Keep current dashboard.json storage location; only correct value semantics and request flow usage.
Do not touch:
Planner prompt/task generation behavior
Runner --root contract
API route shapes/endpoints
Manual validation:
Set target project root and save.
Reload dashboard and confirm same root value is shown.
Click Create Project and verify generated files/state/evidence appear under target root, not OrchestOS repo.
Trigger run and verify runner uses that same target root.

BATCH 3
Root cause: RC3
Objective: Remove UI state divergence by making header, kanban, and execution/history refresh from their sources in a consistent post-run/event cycle.
Files:
src/web/public/dashboard/index.html
src/web/services/dashboard-service.js
Functions:
Frontend:
connectRealtime
loadRunHistory
setActiveTab
run/create handlers (runBtn, createProjectBtn)
Backend:
triggerRun event broadcasts (status:updated, tasks:updated, terminal close/error events)
Exact change:
Keep existing data sources (state.json, tasks.yaml, runs/*) but unify refresh timing:
On terminal close/error and on run-trigger completion path, force synchronized UI refresh of status + tasks + run history.
Ensure execution tab history refresh is invoked after run lifecycle events, not only on tab open/manual click.
Preserve source separation; only align refresh triggers and sequencing.
Do not touch:
Run history storage format/files
Kanban grouping rules
State/task schema
Manual validation:
Execute a run that completes at least one task.
Without page reload, verify header status/counts, kanban columns/counts, and execution history all reflect same completed progress.
Switch tabs and confirm no stale/contradictory values remain.