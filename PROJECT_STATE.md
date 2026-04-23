---
type: project-state
updated: 2026-04-23
---

# PROJECT_STATE.md

## Mission

Make OrchestOS close the execution loop reliably across arbitrary reasonable tasks:
- clean state in → real file outputs in `project_root` → deterministic halt → inspectable evidence
- Validated only by clean rerun from wiped `project_root`. No other validation counts.

---

## Phase: Post-Loop — Output Quality Phase

**Loop confirmado tres veces**: demo2 (2026-04-21, T1–T6), demo3 (2026-04-22, minimax-m2.7), demo3-wipe (2026-04-23, clean run).
**Estado actual**: loop cierra limpio. CSS se divide en sub-tareas (PTASK-BOUND). `index.html` enlaza `styles.css` y `main.js` con 200 (PINTEGRATION). Problema activo: output quality — el executor genera páginas mínimas sin contenido real porque los skill files nunca llegan al LLM (PSKILL-CONTRACT).

**Focos activos en orden**:
1. ✓ PCONFIG-DUP, PSKILL-CONTRACT, PSKILL-IMPORT, PGEN-SILENT, PDASH-RESTORE — resueltos 2026-04-23
2. ✓ P0 — validado 2026-04-23 (`recalculateTaskStates` bloquea deps fallidas, HALT sin LLM call)
3. ✓ P8.2 / P8.3 / P8.4 — resueltos 2026-04-23 (R10 bypass eliminado, failed_permanent guard, skill validation terminal filter)
4. **P2-MODEL** — model-per-skill via `system/config.json` ← PRÓXIMO (Codex)
5. **QA/Reviewer stage** — implementar pipeline real post-executor en runner.js (arch-review: agentes nunca invocados)
6. P3 / P5 / P7 / P9 — UI/UX polish
7. P6 — paralelismo (requiere todos los guards anteriores)

---

## Work Schema

| Role | Tool | Responsibility |
|------|------|----------------|
| Architect | Claude Code (this session) | Diagnose, design, patch runner.js |
| Executor (test) | minimax/minimax-m2.7 | LLM for demo runs |
| Executor (prod) | Codex | LLM for production-quality runs |
| Memory | Engram (not yet integrated) | Cross-run context for planner |

---

## File Write Root

```
dashboard.json → project_root
       ↓
dashboard-service.js → node runner.js run --root <project_root>
       ↓
runner.js: ROOT_DIR = --root arg
       ↓
All writes: path.join(ROOT_DIR, file.path)
```

**Active project root**: `C:\Users\Windows\Documents\demo3`

`config.json → evidence.project_root` is NOT the write-root gate. Do not use it as such.

---

## Confirmed Working

| Item | Notes |
|------|-------|
| Loop closes from clean state | First confirmed: 2026-04-21, T1–T6 landing page |
| `--root` passed by dashboard | `dashboard-service.js:triggerRun` |
| max_tokens increased to 8000 | `providers/openrouter.js` |
| Compact retry on truncation (P1) | `runner.js:2414` — truncation breaks batch; `truncation_retry: true` persists in tasks.yaml for next run |
| R10 bypass eliminado para `output: []` | `runner.js:2323` — auto-complete reemplazado por throw; tasks sin outputs declarados fallan explícitamente |
| Input file context injected into prompts | `runner.js:buildExecutionPrompt` — reads task.input files |
| Planner frontend integration guard | `src/integrations/auto-planner.js:155` creates/updates final `index.html` integration task; runs before `tasks.yaml` persist |
| P8.1 tasks.yaml conflict hard halt | `runner.js:870` maps save failure to `needs_review`; `runner.js:2450` turns post-batch save conflict into hard failure; `tests/phase_tasks_lock.test.js:85` verifies `halt_reason=tasks_yaml_conflict` |
| PTASK-BOUND planner sizing guard | `skills/frontend-html-basic.md:21` defines 100-line CSS/JS bound; `src/integrations/auto-planner.js:214` splits generic `styles.css`; `src/integrations/auto-planner.js:299` makes final integration output `styles.css`; `tests/phase_auto_planner_task_sizing.test.js:45` covers expected split. **Validated 2026-04-23**: T3/T4/T5 con scope description + 100-line budget en clean run. |
| PINTEGRATION output linking | `auto-planner.js:89,155,278` — T7 integration task depends on all CSS/JS sub-tasks; `index.html` links `styles.css` + `main.js`. **Validated 2026-04-23**: DevTools Network 200 for all assets. |
| Auto-loop on batch cap | `dashboard-service.js:217` — auto-resume when `status=paused`, exit code 0 |
| Run button routes to resume when paused | `index.html` — `currentStatus` tracked, endpoint selected dynamically |
| P0 dependency guard — validado | `recalculateTaskStates` bloquea deps fallidas pre-batch; mid-batch guard `runner.js:2149` para P6. **Validated 2026-04-23**: `--root demo4`, T2→blocked, HALT sin LLM call. |
| P8.2 R10 bypass eliminado | `runner.js:2323` — throw si `output: []`; npm test verde 2026-04-23 |
| P8.3 failed_permanent guard | `runner.js:1725` — excluido de pool correctivo; npm test verde 2026-04-23 |
| P8.4 skill validation terminal filter | `runner.js:1389` — ignora done/failed/split_required; npm test verde 2026-04-23 |
| Create Project guard (PGUARD) | `dashboard-service.js:285` blocks overwrite of active projects; `api.js:119` preserves `project_exists`; `index.html:910` toast orienta a Run/Resume |
| Dashboard state restoration on page load | `loadInitial()` → `/dashboard/data` → reads `dashboard.json` + `tasks.yaml` → kanban/status/prompt restaurados automáticamente |

---

## Known Issues / Structural Debt

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| P8.1 | `tasks_yaml_conflict` silently drops all state transitions — tasks.yaml not updated, runner exits clean | Critical | **FIXED** — `runner.js:870` sets `needs_review`; `runner.js:2450` hard-stops post-batch save conflicts; `tests/phase_tasks_lock.test.js:85` covers expected state transition |
| PTASK-BOUND | Planner generates unbounded CSS/JS tasks — LLM overflows max_tokens, JSON truncated, compact retry fires | High | **FIXED + VALIDATED 2026-04-23** — T3/T4/T5 con scope acotado + 100-line budget en clean run de demo3-wipe |
| PINTEGRATION | Output files generated as isolated artifacts (`index.html` doesn't link `styles.css` / `script.js`) | High | **FIXED + VALIDATED 2026-04-23** — DevTools Network 200 para `styles.css` y `main.js` en demo3-wipe |
| PCONFIG-DUP | Tres inputs de project root solapados: `#projectPath` (Config), `#inlineProjectRoot` (prompt tab), `#existingProjectPath` (checkbox "Existing project" — dead code no conectado a ningún handler) | Medium | **Open** — fix: eliminar `#existingProjectPath` + `#existingProjectToggle` (dead code); eliminar `#inlineProjectRoot`; `createProjectBtn` usa `#projectPath` directamente; añadir `<small>` que muestra el path activo con link a Config |
| P0 | Dependency task executes despite its dependency being failed | Critical | **FIXED + VALIDATED 2026-04-23** — `recalculateTaskStates` pre-batch + mid-batch guard `runner.js:2149` |
| P1 | Compact retry doesn't complete before run closes — CSS truncation persists across runs | High | **PATCH APPLIED, UNVALIDATED** — truncation breaks batch; retry picked up next run via `truncation_retry: true` |
| P3 | Kanban never shows "in_progress" state — no visual signal during execution | Medium | Open |
| P5 | `[NEXT] Ejecuta las tareas` manual message printed in AUTO_EXECUTE mode | Medium | Open |
| P6 | Speed: 6-8 min per run cycle — sequential loop + spawn overhead + single model | High | Open — P8.1 prerequisite fixed; still requires isolated-result pattern before parallelism |
| P7 | Terminal/Run button gives no active signal during LLM call | Medium | Open |
| P8.2 | Auto-complete bypass of R10 for `output: []` tasks | High | **FIXED 2026-04-23** — throw en `runner.js:2323`; npm test verde |
| P8.3 | `failed_permanent` can re-enter executable pool | Medium | **FIXED 2026-04-23** — guard en `runner.js:1725`; npm test verde |
| P8.4 | `validateTaskSkills` validates terminal-state tasks | Medium | **FIXED 2026-04-23** — filter en `runner.js:1389`; npm test verde |
| P9 | Realtime feed shows only "snapshot updated" — no task detail | Low | Open |
| PSKILL-CONTRACT | Skill file content never reaches executor LLM — skills are routing metadata only, not instructions. 5 incompatible formats in repo. Vendor skills have no .md extension and are invisible. | High | **Open — PRÓXIMO** — P2-INTEGRATION-VALIDATE completado 2026-04-23. Síntoma confirmado en run real: executor genera "Home \| Menu \| Contact" sin contenido real porque no recibe ninguna guía de skill. 3-step: schema standard + `buildExecutionPrompt` injection + skill normalization. |
| PGEN-SILENT | "Generate Tasks" uses previous run's goal silently when textarea is empty — user has no visibility into which goal was used | Medium | Open — `initProject` must persist prompt to `dashboard.json`; frontend must show effective goal in toast |
| PDASH-RESTORE | Saving new project root via Config panel doesn't reload kanban (requires manual page refresh) | Medium | Open — 2-line fix |
| PTASK-TRUE | True root fix: pre-flight output budget estimator at plan time | Low | Deferred — infrastructure, post-PTASK-BOUND |
| — | No path escape check — LLM can write outside ROOT_DIR | Medium | Open — no incident on record |
| — | `refreshSkills`/`detectSkills` missing `--root` | Low | Open — low impact |

---

## Next Step

See `NEXT_ACTIONS.md`.
