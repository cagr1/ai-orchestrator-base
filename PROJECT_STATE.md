---
type: project-state
updated: 2026-04-22
---

# PROJECT_STATE.md

## Mission

Make OrchestOS close the execution loop reliably across arbitrary reasonable tasks:
- clean state in → real file outputs in `project_root` → deterministic halt → inspectable evidence
- Validated only by clean rerun from wiped `project_root`. No other validation counts.

---

## Phase: Post-Loop — Quality & Integrity

**Loop confirmado dos veces**: demo2 (2026-04-21, T1–T6) y demo3 (2026-04-22, minimax-m2.7).
**Falla activa**: output files no se enlazan — `index.html` no referencia `styles.css` ni `script.js`. Root cause en planner prompt (`auto-planner.js:buildPrompt`), no en runner.

Focos activos: (1) fix integración de archivos, (2) guard de proyecto existente en Create Project, (3) validar P0/P1 en run real, (4) P8.1 silent state loss.

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
| Compact retry on truncation | `runner.js:buildExecutionPrompt` — truncation_retry flag |
| Auto-complete for `output: []` tasks | `runner.js` — writes marker to `docs/{task_id}-complete.md` |
| `validateEvidenceAgainstTask` skips when output=[] | `runner.js:1378` — guard added |
| Input file context injected into prompts | `runner.js:buildExecutionPrompt` — reads task.input files |
| Auto-loop on batch cap | `dashboard-service.js:217` — auto-resume when `status=paused`, exit code 0 |
| Run button routes to resume when paused | `index.html` — `currentStatus` tracked, endpoint selected dynamically |
| P0 dependency guard + truncation batch stop | `runner.js:2081` runtime dep check; `runner.js:2414` truncation breaks batch |

---

## Known Issues / Structural Debt

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | Output files generated as isolated artifacts (index.html doesn't link styles/scripts) | High | **FIXED** — input injection added 2026-04-21 |
| 2 | `POST /project/start` returns 500 with no error detail (no try/catch in async handler) | High | **FIXED** — try/catch added to api.js 2026-04-21 |
| 3 | `generateTasks` crashes with ENOENT if `system/` dir doesn't exist in project root | High | **FIXED** — `mkdirSync` added to auto-planner.js 2026-04-21 |
| 4 | Multi-line goal breaks `execSync` shell command — `runner init` runs without `--root`, writes state.json to wrong dir | High | **FIXED** — `spawnSync` with args array in `initProject`; newlines normalized 2026-04-21 |
| 5 | `runner.js init` args parsing appends `--root` path value to goal string | Medium | **FIXED** — filter excludes both `--root` flag and its value 2026-04-21 |
| 6 | `express.json()` body limit not explicit (default 100kb) | Low | **FIXED** — set to 1mb in server.js 2026-04-21 |
| 7 | Dependency task executes despite its dependency being failed (T2 ran after T1 failed) | Critical | **PATCH APPLIED, UNVALIDATED** — dep guard runner.js:2081 + truncation break :2414 |
| 8 | T3 compact retry activates but doesn't complete before run closes — CSS truncation persists | High | **PATCH APPLIED, UNVALIDATED** — truncation now breaks batch; retry picked up next run |
| 9 | Kanban never shows "in_progress" state — no visual signal during execution | Medium | Open — P3 |
| 10 | No Resume button in dashboard when status=paused | Medium | **FIXED** — auto-loop + smart Run button + CLI message fix 2026-04-22 |
| 11 | `[NEXT] Ejecuta las tareas` manual instructions printed in AUTO_EXECUTE mode | Medium | Open — P5 |
| 12 | Speed: 6-8 min per run cycle — sequential execution + spawn overhead + slow model | High | Open — P6 |
| 13 | Terminal/Run button gives no active signal during LLM call | Medium | Open — P7 |
| 14 | Realtime feed shows only "snapshot updated" — no task detail | Low | Open — P8 |
| 15 | `tasks_yaml_conflict` root cause untraced | Medium | Open |
| 3 | No path escape check — LLM can write outside ROOT_DIR | Medium | Open |
| 4 | No Resume button in dashboard UI | Low | Open |
| 5 | `refreshSkills`/`detectSkills` missing `--root` | Low | Open |
| 6 | Direct CLI without `--root` silently uses orchestrator dir | Medium | **FIXED** — error message now includes `--root "<path>"` 2026-04-22 |
| 7 | model-per-skill not configured (Codex vs minimax) | Medium | Open |

---

## Next Step

See `NEXT_ACTIONS.md`.
