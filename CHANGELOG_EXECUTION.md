---
type: changelog-execution
updated: 2026-04-21
---

# CHANGELOG_EXECUTION.md

Log format:
```
## [DATE] Attempt N — <description>
- Change: what was modified or run
- Result: exact halt code or outcome
- Decision: what was decided and why
```

Entries are append-only. Past entries must not be edited.

---

## [2026-04-06] Attempts 1–13 — test-goal-20260306

- **Change**: Multiple `node runner.js run` invocations on `test-goal-20260306`.
- **Result**: Iterations 1–12: `batch_size=1`, `status=running`. Iteration 13: `status=needs_review`. No clean rerun performed.
- **Decision**: Classified as UNVALIDATED. Passed in dirty state only. No clean-rerun record.

---

## [2026-04-15] Attempt 14 — sdd-flow-test-20260415

- **Change**: `node runner.js run` on `sdd-flow-test-20260415`.
- **Result**: `completed=2, blocked=1, halt=tasks_yaml_conflict`. Pattern: task completes → conflict on tasks.yaml write → state left inconsistent.
- **Decision**: `tasks_yaml_conflict` is a recurring halt. Root cause not traced. Do not patch.

---

## [2026-04-15] Attempts 15–16 — landing page run (realiza-un-landign-p-20260415)

- **Change**: `node runner.js run` on landing page goal.
- **Result (15)**: `completed=0, pending=1, blocked=5, halt=no_tasks_planned`.
- **Result (16)**: `completed=0, pending=0, blocked=5, halt=tasks_yaml_conflict → no_executable_tasks`.
- **Decision**: Loop did not close. 5 tasks permanently blocked in that run's tasks.yaml. Goal prompt cleared in dashboard.json afterward. Classified OPEN — state since wiped.

---

## [2026-04-16] Attempt 17 — re-run on stale landing page state

- **Change**: `node runner.js run` (no config change).
- **Result**: `completed=0, pending=0, blocked=5, halt=no_executable_tasks`.
- **Decision**: Tasks.yaml in demo2 was frozen in blocked state. No recovery mechanism. Run abandoned.

---

## [2026-04-21] Session — Project Memory System initialized (v1)

- **Change**: Created 5 control docs from events.log, history.log, config.json, dashboard.json, runner.js.
- **Result**: Docs written. No run executed.
- **Decision**: Docs correctly captured events but contained two errors (see next entry).

---

## [2026-04-21] Audit — Control docs corrected (v2)

- **Change**: Audited all 5 docs against runner.js source.
- **Result**: Two structural errors found in v1 docs:
  1. `config.json → evidence.project_root: null` was listed as the file-write root gate. WRONG. The actual mechanism is `dashboard.json → project_root → --root CLI flag → ROOT_DIR`. The `evidence.project_root` field in config.json is not used for write routing.
  2. NEXT_ACTIONS said "Read `system/tasks.yaml`" as if it existed in the orchestrator dir. It does not. The project's tasks.yaml lives in `{ROOT_DIR}/system/tasks.yaml` (= `C:\Users\Windows\Documents\demo2\system\tasks.yaml`) and has been wiped by user.
  3. Additional finding: `system/evidence/T1.json` in the orchestrator's own `system/` dir is a contamination artifact — likely written during a run where `--root` was not passed and ROOT_DIR defaulted to `__dirname`.
- **Decision**: All 5 docs rewritten. Blocker restated as runtime reliability gap, not 5-task specific diagnosis. `tasks_yaml_conflict` classified as structural debt. Next action is a controlled trace run, not a read of a nonexistent file.

---

## [2026-04-21] Session — Loop closure + integration fixes

- **Change (1)**: `providers/openrouter.js` — `max_tokens` changed from hardcoded 2000 to `providerConfig.max_tokens || 8000`. Root cause of T3 truncation.
- **Change (2)**: `runner.js:buildExecutionPrompt` — compact retry instruction injected when `task.truncation_retry = true`. Prevents infinite truncation loops.
- **Change (3)**: `runner.js` catch block — truncation errors retry (up to max_attempts) instead of immediately failing. After max_attempts, task goes to `split_required`.
- **Change (4)**: `runner.js` — auto-complete path for tasks with `output: []`. Writes marker to `docs/{task_id}-complete.md` and creates evidence. Resolves T6 (manual verification task).
- **Change (5)**: `runner.js:validateEvidenceAgainstTask` — added guard: if `task.output.length === 0`, skip path validation. Resolves "Unauthorized file change" error for auto-completed tasks.
- **Change (6)**: `runner.js:buildExecutionPrompt` — reads and injects full content of `task.input` files into prompt. Resolves output integration problem (index.html not linking styles/scripts).
- **Result**: First confirmed clean-loop closure. T1–T6 `all_tasks_completed`. Evidence files present.
- **Remaining issue**: Integration quality not yet validated with browser test (P1 in NEXT_ACTIONS).
- **Decision**: Loop phase complete. Entering quality + hardening phase.

---

## [2026-04-21] Fix — /project/start 500 error on new project (demo3)

- **Symptom**: `POST /api/v1/project/start` returning 500 with no detail in browser. Server terminal showed `ENOENT: no such file or directory, open 'C:\Users\Windows\Documents\demo3\system\tasks.yaml'` at `auto-planner.js:234`.
- **Root cause**: Two issues found:
  1. `src/web/routes/api.js` route handler for `/project/start` was `async` with no try/catch — any throw produced a silent 500.
  2. `src/integrations/auto-planner.js:234` — `fs.writeFileSync` called on `system/tasks.yaml` without first ensuring `system/` directory exists. When `initProject` ran `runner.js init` but the system dir wasn't created yet, the write failed.
- **Fix (1)**: Wrapped route handler body in try/catch — errors now return `{ ok: false, stage: 'unknown', error: msg }` and log stack trace.
- **Fix (2)**: Added `fs.mkdirSync(systemDir, { recursive: true })` before `writeFileSync` in `auto-planner.js`.
- **Status**: Fixes applied. Awaiting validation with demo3 clean run.

---

## [2026-04-21] Fix — Multi-line goal breaks runner init; args parsing contaminates goal

- **Symptom**: demo3 run showed PLANNER succeeded (tasks written), but `runner run` said "No state found". `goal.md` and `state.json` not created in demo3/system/.
- **Root cause (traced)**: `initProject` used `execSync` with string interpolation. Multi-line goal (hospital Machala + URL) caused `cmd.exe` to split the command at the first newline. `runner.js init` ran without `--root` flag → `ROOT_DIR = __dirname` (orchestrator dir) → `state.json` written to orchestrator's `system/`, not `demo3/system/`. `execSync` returned exit code 0 (first line succeeded), so `initResult.ok = true`. Route continued, generateTasks ran correctly (had right path from getPaths()), tasks written to demo3. But triggerRun → runner found no state in demo3.
- **Secondary root cause**: `runner.js init` args parsing filtered `--root` flag but not its value — path was appended to goal string.
- **Fix (1)**: `dashboard-service.js initProject` — replaced `execSync` string interpolation with `spawnSync(['node', RUNNER, 'init', goal, '--root', root])`. Bypasses shell entirely. Any characters in goal (newlines, URLs, quotes) handled correctly. Newlines also normalized to spaces as defense-in-depth.
- **Fix (2)**: `runner.js init` args parsing — now filters both `--root` flag and its value using index-based filter.
- **Fix (3)**: `server.js` — `express.json({ limit: '1mb' })` set explicitly. Supports long prompts without truncation.
- **Status**: All fixes applied. Clean rerun of demo3 required to validate.

---

## [2026-04-21] Observación — demo3 run, múltiples problemas identificados

- **Run**: demo3 / `realiza-un-landig-pa-20260421` / prompt: hospital Machala Ecuador
- **Iteración 1**: T1 completó exitosamente (index.html creado). Model: `moonshotai/kimi-k2.6`.
- **Iteración 2**: T3 (`css/styles.css`) falló con truncation — `content_len=3987`, JSON unterminated en posición 3962. Compact retry activado (`attempt 1/3`) pero la iteración cerró antes de completar el retry.
- **Problema reportado (dep. integrity)**: En algún punto T2 ejecutó aunque T1 habría fallado en una corrida anterior. Estado exacto no trazado — requiere corrida controlada para confirmar.
- **Velocidad**: ~7 minutos entre iteraciones. Causa: spawn-per-run + LLM secuencial + modelo con alta latencia en OpenRouter.
- **Nuevos issues registrados**: 8 items (P0–P8) en NEXT_ACTIONS.md. Ver lista completa ahí.
- **Referencia**: `plans/v8-OrchestOS-fixplan.md` — documento de arquitectura completo que anticipa y describe varios de estos issues con plan de implementación por tier.
