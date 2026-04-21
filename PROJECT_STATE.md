---
type: project-state
updated: 2026-04-21
---

# PROJECT_STATE.md

## Mission

Make OrchestOS close the execution loop reliably across arbitrary reasonable tasks:
- clean state in → real file outputs in `project_root` → deterministic halt → inspectable evidence
- Validated only by clean rerun from wiped `project_root`. No other validation counts.

---

## Phase: Post-Loop — Quality & Integration

**The loop closed.** A full clean run (T1–T6) reached `all_tasks_completed` from a wiped `C:\Users\Windows\Documents\demo2` on 2026-04-21. This is the first confirmed closure.

Current focus: output quality (files integrate correctly) and system hardening (model-per-skill, Engram, Resume button, Codex wiring).

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

**Active project root**: `C:\Users\Windows\Documents\demo2`

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
| 7 | Dependency task executes despite its dependency being failed (T2 ran after T1 failed) | Critical | Open — P0 |
| 8 | T3 compact retry activates but doesn't complete before run closes — CSS truncation persists | High | Open — P1 |
| 9 | Kanban never shows "in_progress" state — no visual signal during execution | Medium | Open — P3 |
| 10 | No Resume button in dashboard when status=paused | Medium | Open — P4 |
| 11 | `[NEXT] Ejecuta las tareas` manual instructions printed in AUTO_EXECUTE mode | Medium | Open — P5 |
| 12 | Speed: 6-8 min per run cycle — sequential execution + spawn overhead + slow model | High | Open — P6 |
| 13 | Terminal/Run button gives no active signal during LLM call | Medium | Open — P7 |
| 14 | Realtime feed shows only "snapshot updated" — no task detail | Low | Open — P8 |
| 15 | `tasks_yaml_conflict` root cause untraced | Medium | Open |
| 3 | No path escape check — LLM can write outside ROOT_DIR | Medium | Open |
| 4 | No Resume button in dashboard UI | Low | Open |
| 5 | `refreshSkills`/`detectSkills` missing `--root` | Low | Open |
| 6 | Direct CLI without `--root` silently uses orchestrator dir | Medium | Open |
| 7 | model-per-skill not configured (Codex vs minimax) | Medium | Open |

---

## Next Step

See `NEXT_ACTIONS.md`.
