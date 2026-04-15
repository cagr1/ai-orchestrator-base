BATCH 1

Objective:
Unify dashboard and runtime to the same project root/system path for all read/write/execute flows.
Why this batch exists:
Audit proved split-brain: dashboard reads project_root/system/* but runner/planner execute and write in repo-root system/*.
Files:
[dashboard-service.js](/e:/Carlos/Development Tools/Proyectos/Agents/ai-orchestrator-base/src/web/services/dashboard-service.js), [runner.js](/e:/Carlos/Development Tools/Proyectos/Agents/ai-orchestrator-base/runner.js)
Exact change:
Make initProject, triggerRun, and generateTasks execute against active project root (not fixed rootDir), and ensure planner writes to active root system/tasks.yaml. Keep status/tasks/run-history reading on that same root.
Depends on:
None.
Manual validation:
Set a non-default project path, initialize project, generate tasks, run execution, then confirm the same path’s system/state.json, system/tasks.yaml, system/evidence/* are updated and dashboard shows those exact updates.
BATCH 2

Objective:
Wire /api/v1/project/start to real end-to-end flow: init → plan → execute.
Why this batch exists:
Audit proved “Iniciar proyecto” currently does init+run only, skipping planning, causing no_tasks_planned.
Files:
[api.js](/e:/Carlos/Development Tools/Proyectos/Agents/ai-orchestrator-base/src/web/routes/api.js), [dashboard-service.js](/e:/Carlos/Development Tools/Proyectos/Agents/ai-orchestrator-base/src/web/services/dashboard-service.js)
Exact change:
Update /project/start handler chain to call planner generation after init and only trigger run when planning succeeds and tasks exist. Return structured response for each stage result.
Depends on:
BATCH 1.
Manual validation:
From dashboard, click “Iniciar Proyecto” with a goal and verify one action produces non-empty tasks and starts run without no_tasks_planned.
BATCH 3

Objective:
Fix dashboard runtime state refresh after run start/finish.
Why this batch exists:
Audit proved runner writes files, but UI can remain stale/stuck because status/tasks refresh is not pushed after run lifecycle.
Files:
[dashboard-service.js](/e:/Carlos/Development Tools/Proyectos/Agents/ai-orchestrator-base/src/web/services/dashboard-service.js), [index.html](/e:/Carlos/Development Tools/Proyectos/Agents/ai-orchestrator-base/src/web/public/dashboard/index.html)
Exact change:
On runner spawn/close/error, emit refreshed status/tasks events from backend; in frontend websocket handlers, consume them to re-render status/task board consistently.
Depends on:
BATCH 1.
Manual validation:
Run a project and watch task/status transitions update automatically without manual reload; verify no “stuck executing” after process exits.

BATCH 4
Objective:
Restore config panel visibility/toggle behavior with actual CSS state styles.
Why this batch exists:
Audit proved JS toggles .open classes, but CSS has no .config-panel/.config-backdrop/.open rules, so panel renders incorrectly and toggle appears broken.
Files:
[dashboard.css](/e:/Carlos/Development Tools/Proyectos/Agents/ai-orchestrator-base/src/web/public/assets/dashboard.css), [dashboard-improvements.css](/e:/Carlos/Development Tools/Proyectos/Agents/ai-orchestrator-base/src/web/public/assets/dashboard-improvements.css), [index.html](/e:/Carlos/Development Tools/Proyectos/Agents/ai-orchestrator-base/src/web/public/dashboard/index.html)
Exact change:
Add/align missing CSS for config panel/backdrop default hidden state and .open state transitions; keep existing JS open/close handlers.
Depends on:
None.
Manual validation:
Click config icon: panel opens as overlay, backdrop appears, close button/backdrop click closes it, panel no longer permanently occupies bottom layout.

BATCH 5
Objective:
Load .env at dashboard server startup so key status reflects real environment before UI writes.
Why this batch exists:
Audit proved dashboard process does not load dotenv on boot; /config/env can show missing until API key is manually saved in-process.
Files:
[server.js](/e:/Carlos/Development Tools/Proyectos/Agents/ai-orchestrator-base/src/web/server.js)
Exact change:
Initialize dotenv in web server startup path so process.env.OPENROUTER_API_KEY is populated from .env immediately.
Depends on:
None.
Manual validation:
Start dashboard with .env containing key; open UI and verify API key status is “set” without pressing Save.

BATCH 6
Objective:
Align planner/provider model selection with actual runtime config source used by provider.
Why this batch exists:
Audit proved planner computes a concrete model but passes it to provider as “skill key”; provider remaps via model_mapping, bypassing intended planner model path.
Files:
[auto-planner.js](/e:/Carlos/Development Tools/Proyectos/Agents/ai-orchestrator-base/src/integrations/auto-planner.js), [openrouter.js](/e:/Carlos/Development Tools/Proyectos/Agents/ai-orchestrator-base/providers/openrouter.js), [README.md](/e:/Carlos/Development Tools/Proyectos/Agents/ai-orchestrator-base/README.md) and/or [CLAUDE.md](/e:/Carlos/Development Tools/Proyectos/Agents/ai-orchestrator-base/CLAUDE.md)
Exact change:
Make planner/provider call contract consistent with one runtime source of truth (system/config.json) so planner/executor both resolve provider+model deterministically through the same path; document that contract and explicitly state opencode.json is not runtime input.
Depends on:
BATCH 1.
Manual validation:
Generate plan and execute task while logging resolved provider/model; verify both flows use expected config mapping and no hidden dependency on opencode.json.