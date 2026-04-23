# HISTORY

Institutional memory built from `git log`, selected `git show` diffs, `NEXT_ACTIONS.md`, `PROJECT_STATE.md`, and the current `tests/` tree. Dates below are exact commit dates. When a commit described an intent but the concrete symptom was not reconstructable from the surviving diff or tests, the entry says so explicitly.

## 2026-03-02 - Foundations, v2.0, and v3.0

### Baseline runner, roles, skills, and operating docs
Commit: `a720845f9d516239b78eb7f3764d17a3ca506147` (`feat: standardize runner flow and add skill evolution workflow`)

- Symptom: the repository did not yet contain a standardized runtime, role prompts, or a governed skill catalog.
- Root cause: the project was still missing its first coherent orchestration scaffold.
- Changed: initial runtime and operating surface added in `runner.js`, `agents/*.md`, `skills/**`, `system/config.json`, `system/SKILL_EVOLUTION.md`, and companion docs (`README.md`, `USAGE.md`).
- Validation: no automated validation is recoverable for this exact commit; later March 2 test commits exercised the runtime introduced here.

### Strict task schema and project bootstrap
Commit: `6ee71790eb1aa15dd75148f1074f8cfb3f49fb8e` (`feat: add init-project script and strict tasks schema validation`)

- Symptom: project bootstrapping and task documents were too loose to trust.
- Root cause: missing initialization script and missing strict validation for the generated task schema.
- Changed: bootstrap flow added in `scripts/init-project.js`; task validation tightened in `runner.js`; supporting state updates landed in `system/goal.md` and `system/state.json`.
- Validation: later CLI coverage for `init` exists in `tests/phase_cli_commands.test.js:88` and `tests/phase_sdd_flow.test.js:88`.

### Run snapshots and smoke coverage
Commit: `c78176210f41fada65d09790f47e09efd45d9ea7` (`feat: add run snapshots and smoke tests`)

- Symptom: there was no lightweight way to prove the runner created evidence and snapshots end to end.
- Root cause: smoke-level validation had not been added yet.
- Changed: smoke coverage added in `scripts/smoke-runner.js`; snapshot/evidence support extended in `runner.js`.
- Validation: `scripts/smoke-runner.js` assertions cover evidence directory creation and diff snapshots; exact historical run output is not preserved in git.

### CLI commands, run summary, and stricter task guardrails
Commit: `b8e9001dce84b7c87a0046fad8030d336b08790b` (`feat: add runner cli commands, run summary, and stronger tasks guardrails`)

- Symptom: the operator workflow lacked dedicated CLI lifecycle commands and stronger task protections.
- Root cause: command handling and run summarization were still incomplete.
- Changed: `runner.js` gained broader command support and stronger guardrails; smoke coverage expanded in `scripts/smoke-runner.js`; docs updated in `README.md`.
- Validation: current CLI regression coverage passes in `tests/phase_cli_commands.test.js:140`.

### ESM portability
Commit: `a7e783684ac0e9e04df0106b9418103f016fe718` (`feat: make orchestrator portable across ESM projects`)

- Symptom: the orchestrator was not yet packaged cleanly for ESM-oriented projects.
- Root cause: packaging/runtime assumptions were too narrow.
- Changed: portability adjustments landed in `package.json`, `runner.js`, and `scripts/init-project.js`.
- Validation: details beyond the commit summary are not recoverable from git.

### Chat-only startup flow and onboarding docs
Commits: `60f8581340342eaa3712479d5780d1693117188a`, `219b21163ca7957eac2461a4746e83b796e29d6a`

- Symptom: the repository lacked a documented chat-first startup path and reusable prompts.
- Root cause: onboarding material had not caught up with the intended operating model.
- Changed: chat-only start flow added to `runner.js`/`package.json`; reusable operator docs added in `CHAT_PROMPT_TEMPLATE.md`, `PROMPTS.md`, and `QUICKSTART.md`.
- Validation: documentation-only change; no automated validation recoverable from git.

### v2.0 evidence enforcement
Commit: `c4ae3f1de912eb934ba26c97d26d91180ed6304c` (`v2.0: Enforce real execution with evidence system`)

- Symptom: a task could be treated as complete without inspectable proof of file changes.
- Root cause: there was no required evidence artifact tying task completion to observable output.
- Changed: evidence persistence and validation added in [runner.js](runner.js:1094), including `system/evidence/{task}.json`, excluded-path filtering, and evidence checks against task outputs ([runner.js](runner.js:1406)); smoke coverage expanded in `scripts/smoke-runner.js`.
- Validation: current evidence rules pass in `tests/phase11-14_validation.test.js:127`, `tests/phase_cli_commands.test.js:140`, and `tests/phase_sdd_flow.test.js:172`.

### v3.0 phases 1-6: state, locking, tasks.yaml, batching, cooldown
Commit: `3475fc8eb61ab64bedd5f2e9f0517bae81054a3b` (`v3.0: Phases 1-6 - State management, tasks.yaml, execution limits, batch selection, checkpoints, cooldown`)

- Symptom: run state, lock handling, and executable task selection were not deterministic enough for resumable orchestration.
- Root cause: the runtime still relied on a simpler state model and lacked a formal `tasks.yaml` execution contract.
- Changed: `initializeState`, lock handling, and deterministic batch selection were added in [runner.js](runner.js:718), [runner.js](runner.js:807), and [runner.js](runner.js:975); `system/tasks.yaml` was introduced.
- Validation: current regression coverage passes in `tests/phase1_state.test.js:15`, `tests/phase1_state.test.js:84`, and `tests/phase4_batch.test.js:50`.

### v3.0 phases 7-10: evidence format, agent updates, recalculation
Commits: `8ace687daf881236a50986dd90fd82e8d37d1e2a`, `9810a9666fde828d94ae5f70536767413a88b148`

- Symptom: blocked/pending task states could drift as dependencies changed, and evidence handling still needed follow-on work.
- Root cause: recalculation logic and later-phase v3.0 behaviors were not fully implemented in the first v3.0 commit.
- Changed: dependency-driven state recalculation exists in [runner.js](runner.js:1733); additional agent/CLI/evidence work was layered onto `runner.js` and the tests on the same day.
- Validation: recalculation coverage passes in `tests/phase10_recalc.test.js`; exact per-commit validation split between these two commits is not recoverable from git.

### v3.0 phases 11-14: task size, completion detection, dependency checks, R10
Commit: `4ee1ad00bcde4f656915643e1001eb948969df42` (`v3.0: Phases 11-14 - R9 validation, completion detection, deps, R10`)

- Symptom: oversize tasks, impossible dependency graphs, premature completion, and undeclared file writes could all slip through planning/execution.
- Root cause: R9/R10 validation and completion/dependency checks had not been encoded.
- Changed: task-size validation in [runner.js](runner.js:1153), completion detection in [runner.js](runner.js:1207), dependency/cycle validation in [runner.js](runner.js:1364) and [runner.js](runner.js:1378), and output-scope enforcement in [runner.js](runner.js:1406).
- Validation: `tests/phase11-14_validation.test.js:127`; commit message also records "All 15 tests passing: npm test".

### v3.0 phases 15-17: stale-lock recovery, deterministic ordering, planner guardrail
Commit: `cfa89a4d099b65bf27a10a46439ca9dcb3b37d9c` (`feat: implement phases 15-17 (crash recovery, deterministic ordering, R11 guardrail)`)

- Symptom: stale locks could block future runs, task ordering could vary across executions, and the planner could be invoked in destructive phases.
- Root cause: lock TTL recovery, stable tie-breaking, and an anti-destruction planner guard were missing.
- Changed: stale lock recovery in [runner.js](runner.js:807), deterministic batch selection in [runner.js](runner.js:975), and planner gating in [runner.js](runner.js:1442).
- Validation: `tests/phase15-17_final.test.js:195`; commit message records 23 passing tests.

### v3.0 phases 18-20: full workflow simulation and integration verification
Commit: `c43bd14857fb17e2ab2faea5781e24f27795acd5` (`feat: implement final phases 18-20 (simulation, docs, integration)`)

- Symptom: the runtime still needed end-to-end proof that linear flows, branching flows, limits, cooldown, and evidence gates worked together.
- Root cause: only unit-style coverage existed before the simulation pass.
- Changed: simulation coverage added in `tests/phase18_simulation.test.js`; README/state docs were rewritten to describe the integrated v3.0 system.
- Validation: `tests/phase18_simulation.test.js:87`; commit message records 30 passing tests.

### v3.0 workflow docs refresh
Commit: `03d593a4195f7b87f9e901d8840b8668f0b36f3c` (`docs: update USAGE.md with v3.0 workflow and commands`)

- Symptom: usage documentation lagged behind the v3.0 runtime.
- Root cause: the command set, `tasks.yaml`, evidence rules, and recovery states had changed faster than the docs.
- Changed: `USAGE.md` was rewritten for `init`, `run`, `resume`, `status`, `review`, `tasks.yaml`, evidence, and recovery procedures.
- Validation: documentation-only change; no automated validation recoverable from git.

## 2026-03-06 - Quality and maintainability improvements (v3.1)

### Retry accounting, permanent failure, corrective tasks, and memory compaction
Commit: `dabfb5584cbc64def5625a71119b0560ff80d6a7` (`feat: Implement 5 improvements (v3.1)`)

- Symptom: failures had no durable retry budget, downstream tasks could not be redirected to a fix task, and memory growth was unmanaged.
- Root cause: the runtime lacked explicit attempt accounting, corrective-task generation, and compaction rules.
- Changed: retry/permanent-failure logic in [runner.js](runner.js:1461) and [runner.js](runner.js:1547); corrective-task creation in [runner.js](runner.js:1627) and [runner.js](runner.js:1705); memory compaction helpers in [runner.js](runner.js:1029).
- Validation: current coverage passes in `tests/phase_attempts.test.js`, `tests/phase_corrective_tasks.test.js`, and `tests/phase_memory_compaction.test.js:170`.

### Skill hygiene for long skills
Commit: `43fafc592515b0be7ad7e98307ecb1962155913b` (`feat: Complete Mejora 4 - Skills largas (skill hygiene)`)

- Symptom: the main frontend design skill had grown too long to maintain comfortably.
- Root cause: skill guidance had accumulated in a single large document without a size policy or modular split.
- Changed: the policy was documented in `system/SKILL_EVOLUTION.md:31`; `skills/frontend/design-taste.md:9` now delegates to focused sub-skills; supporting sub-skills and testing skills were added.
- Validation: `tests/phase_skill_hygiene.test.js:56` and `tests/phase_skill_hygiene.test.js:127`.

## 2026-03-15 - v4 runtime expansion

### CLI workflow and end-to-end SDD flow
Commit: `65855cf8fa16d3869771d5e8bf935f2a6863721b` (`Complete v4 block 1`)

- Symptom: the project still lacked an automated regression path for the CLI lifecycle and a scripted spec-driven flow.
- Root cause: those flows were implemented informally but not yet locked down in tests/docs.
- Changed: large runtime expansion in `runner.js`; CLI and SDD regressions added in `tests/phase_cli_commands.test.js` and `tests/phase_sdd_flow.test.js`; plan/docs updated in `plans/v4-orchestrator-plan.md`, `QUICKSTART.md`, `README.md`, and `USAGE.md`.
- Validation: current coverage passes in `tests/phase_cli_commands.test.js:140` and `tests/phase_sdd_flow.test.js:172`.

### Optimistic locking for `tasks.yaml`
Commit: `8ce1fe653a4f1a1c93c3d4faffe534fab6b3ec5f` (`Finish block 2 safety and collaboration`)

- Symptom: concurrent or out-of-band edits to `tasks.yaml` could be overwritten silently.
- Root cause: task persistence had no optimistic-lock conflict detection.
- Changed: optimistic save conflict handling added in [runner.js](runner.js:858) and [runner.js](runner.js:870); supporting test added in `tests/phase_tasks_lock.test.js`.
- Validation: `tests/phase_tasks_lock.test.js:78` and `tests/phase_tasks_lock.test.js:92`.

### Dashboard and audit logging
Commit: `0bfc733cd825ba35d73ec962814f3556f16c7339` (`Add dashboard and audit logging`)

- Symptom: runtime activity was not yet visible through a dashboard-facing audit surface.
- Root cause: audit/log plumbing had not been added to the runner.
- Changed: audit/dashboard logging additions landed in `runner.js`; README/USAGE were updated to expose the new behavior.
- Validation: details beyond the diff summary are not recoverable from git.

### Templates, packs, provider prompts
Commit: `c9a168affb19fdbdd8e875414f5a076bd334da72` (`Implement block 3 templates, packs, providers`)

- Symptom: the orchestrator did not yet ship reusable domain packs, module templates, or provider-specific prompt sets.
- Root cause: those extension points had not been formalized.
- Changed: prompt packs added in `agents/prompts/*.md`, module templates in `templates/modules/*.yaml`, new domain skills in `skills/data/**`, `skills/finance/**`, and `skills/ops/**`, with provider wiring in `runner.js` and `system/config.json`.
- Validation: no dedicated automated validation is recoverable from git for this exact commit.

### Technical reference docs
Commit: `29949ef7bdce200014d95ae177bf4afe20f93db1` (`Add technical documentation`)

- Symptom: architecture-level technical documentation was still missing.
- Root cause: previous docs focused more on usage than internals.
- Changed: `TECHNICAL.md` added; README/USAGE expanded.
- Validation: documentation-only change; no automated validation recoverable from git.

## 2026-04-07 - v5.1 dashboard improvements

### First substantial web dashboard
Commit: `eeb9045855dd4a960227c45a2aa2d216047b0a22` (`feat(dashboard): v5.1 improvements - toasts, folder picker, create project button`)

- Symptom: the operator experience was still CLI-heavy and lacked web-native project controls, toasts, and status surfaces.
- Root cause: the dashboard stack and supporting services did not exist yet.
- Changed: the dashboard app landed in `src/web/public/dashboard/index.html`, `src/web/public/assets/dashboard.css`, `src/web/routes/api.js`, `src/web/server.js`, `src/web/services/dashboard-service.js`, and realtime/websocket services; autoskills/memory integrations were also added.
- Validation: current dashboard-driven flow is exercised indirectly by `tests/phase_auto_planner_integration.test.js` and `tests/phase_auto_planner_task_sizing.test.js`; no dedicated historical browser recording is stored in git.

## 2026-04-14 - v6 cleanup and v7 dashboard refactor

### v6 cleanup: path quoting, file-first memory, local assets, Prompt Studio terminal
Commit: `2a53e1fc0db26e40c86ee8a3f714b04cb73f0147` (`fix(v6): tests 100%, CSS limpio, assets locales, terminal en Prompt Studio`)

- Symptom: real use exposed multiple issues at once: memory compaction behavior was unstable with Engram coupling, tests broke in directories with spaces, and the dashboard depended on CDN assets while carrying duplicated CSS.
- Root cause: file persistence was not clearly primary, shell invocation did not quote the runner path robustly, and dashboard assets/layout had drifted.
- Changed: file-first memory writes now happen in `src/integrations/memory-manager.js:152`; test runners quote the runner path in `tests/phase_cli_commands.test.js:82` and `tests/phase_sdd_flow.test.js:82`; local assets are referenced in `src/web/public/dashboard/index.html:9`; the terminal panel moved into the prompt workspace in the same file.
- Validation: current suite passes `tests/phase_memory_compaction.test.js`, `tests/phase_cli_commands.test.js:140`, and `tests/phase_sdd_flow.test.js:172`; I also re-ran `npm test` successfully on 2026-04-23.

### v7 dashboard refactor and auto-planner
Commit: `f6b59f4e7f2d0a59acc2ada10dd35cdbc84eae13` (`feat(v7): dashboard upgrade - execute tab, sidebar collapse, auto-planner`)

- Symptom: the first dashboard iteration still had disconnected project/init/run flows and no LLM-backed task generation from the UI.
- Root cause: routing, layout, and planner integration had been added incrementally instead of as a single execution surface.
- Changed: `/project/start` and `/tasks/generate` routes were added in `src/web/routes/api.js`; `src/integrations/auto-planner.js` was introduced; dashboard controls were reorganized in `src/web/public/dashboard/index.html`.
- Validation: the auto-planner behavior is now covered by `tests/phase_auto_planner_integration.test.js:56` and `tests/phase_auto_planner_task_sizing.test.js:65`.

## 2026-04-15 - Runtime integration and dashboard sync

### Existing-project detection and planner context injection
Commit: `b170ed2dda048ff573180aee9282994da4d3c445` (`batch-6: add existing-project detection and context injection in planner`)

- Symptom: the planner could treat an existing project root as blank context.
- Root cause: project signals were not being detected and injected into planning.
- Changed: planner-side project-context detection was added in `src/integrations/auto-planner.js`.
- Validation: exact historical validation is not recoverable from git; later planner integration tests cover adjacent behavior.

### Runtime wiring and dashboard sync
Commit: `aa8c982d7e0078dab7d541024d1778cb41737b45` (`Finalize OrchestOS runtime wiring and dashboard sync fixes`)

- Symptom: the dashboard and runtime still had synchronization gaps during init/run flows.
- Root cause: run wiring, UI assets, and persisted task/state snapshots were still settling after the v7 refactor.
- Changed: coordinated updates landed in `runner.js`, `src/web/public/dashboard/index.html`, `src/web/routes/api.js`, `src/web/server.js`, and `src/web/services/dashboard-service.js`; accompanying planning docs were added under `docs/` and `plans/`.
- Validation: details are partly recoverable from the diff but not from dedicated tests; later April 21-23 hardening commits validated this area more concretely.

### Runtime and dashboard sync adjustments
Commit: `ada0f61ecdd63445ee794061774e4eefe165787b` (`fix: runtime and dashboard sync adjustments`)

- Symptom: live runs still hit integration problems between the dashboard, the planner, and the LLM executor.
- Root cause: several runtime/dash sync edges remained unresolved after the previous commit.
- Changed: `runner.js`, `providers/openrouter.js`, `src/integrations/auto-planner.js`, and `src/web/services/dashboard-service.js` were patched; the old root `index.html` was removed.
- Validation: current repo state confirms the larger-token executor path in `providers/openrouter.js:38` and dashboard-side task generation fallback in `src/web/services/dashboard-service.js:519`; exact historical run logs are not committed.

## 2026-04-21 to 2026-04-22 - Live-run hardening

### Hardening the execution loop
Commit: `994581e8ad32aa48d7db66f2fb7ada776b3a29d1` (`Harden OrchestOS execution flow`)

- Symptom: live runs exposed brittle behavior around `tasks.yaml` conflicts, dependency failure handling, and operator visibility into the actual runtime state.
- Root cause: the execution loop still assumed clean saves and happy-path dependency progress too often.
- Changed: optimistic-lock failures are now escalated via [runner.js](runner.js:858) and [runner.js](runner.js:870); dependency failures are blocked in [runner.js](runner.js:2101); execution docs and current-state docs were added in `NEXT_ACTIONS.md`, `PROJECT_STATE.md`, `WORKFLOW_RULES.md`, and `SYSTEM_MAP.md`.
- Validation: current lock regression passes in `tests/phase_tasks_lock.test.js:78`; `PROJECT_STATE.md` records the live-run confirmation dates for the loop and the remaining unvalidated guards.

### Dashboard auto-resume state
Commit: `6eb006454261b45a6cd996c2e2ab8062195f9fe9` (`Update dashboard auto-resume state`)

- Symptom: when a run stopped on a batch cap, the dashboard did not reliably reflect or continue the paused state.
- Root cause: the service/UI state was not handling paused-to-resume transitions consistently.
- Changed: automatic resume-on-clean-pause is implemented in `src/web/services/dashboard-service.js:217`; the Run button now switches endpoint based on `currentStatus` in `src/web/public/dashboard/index.html:972`.
- Validation: current behavior is visible in code and was revalidated by a green `npm test`; dedicated historical browser output is not committed.

### Project creation guard and frontend integration guard
Commit: `3474ea4188b612789843f65d2ed6fce740499c0e` (`Guard project creation and frontend integration`)

- Symptom: Create Project could overwrite an active project root, and frontend plans could emit isolated assets without a final integration step.
- Root cause: project existence was not being checked before init, and the planner lacked a hard integration pass for generated frontend assets.
- Changed: active-project protection exists in `src/web/services/dashboard-service.js:285` and `src/web/public/dashboard/index.html:907`; frontend integration synthesis exists in `src/integrations/auto-planner.js:255`; CSS task splitting exists in `src/integrations/auto-planner.js:214`.
- Validation: `tests/phase_auto_planner_integration.test.js:56` and `tests/phase_auto_planner_task_sizing.test.js:65`; `PROJECT_STATE.md` also records browser validation on 2026-04-23 for linked assets returning HTTP 200.

## 2026-04-23 - Current verified state

- Current confirmed working areas are summarized in `PROJECT_STATE.md`.
- Current unresolved items are deliberately tracked in `NEXT_ACTIONS.md` rather than duplicated here.
- Fresh verification for this documentation pass: `npm test` succeeded on 2026-04-23 and ran all tests listed in `tests/run-all.js`.
