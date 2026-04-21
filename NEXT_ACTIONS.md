---
type: next-actions
updated: 2026-04-21
---

# NEXT_ACTIONS.md

## Status: Loop Closed — Entering Quality Phase

First clean closure confirmed 2026-04-21. Active blocker is now output integration quality.

---

## Priority Queue

### P0 — CRÍTICO: Dependency integrity — task avanza aunque su dependencia falló
**Síntoma**: T1 falló en una iteración pero T2 corrió igualmente. Si T1 no está `done`, ninguna tarea con `depends_on: [T1]` debería ejecutarse.
**Causa probable**: El planner no declaró `depends_on` en T2, O el estado quedó inconsistente entre runs (T1 marcado `done` en un run, luego `failed` en otro sin resetear dependientes).
**Dónde buscar**: `recalculateTaskStates` en runner.js — verificar que la condición de desbloqueo exige `estado === 'done'`, no solo ausencia de `failed`.
**Riesgo si no se resuelve**: El sistema ejecuta tareas con dependencias rotas → output integrado inconsistente, archivos que asumen contexto que no existe.
**Fix requerido**: Trazar con un run controlado. Leer `demo3/system/tasks.yaml` después del fallo para verificar qué `estado` tenía T1 cuando T2 se ejecutó.

---

### P1 — CRÍTICO: T3 truncation persiste aunque compact retry se activa
**Síntoma**: `kimi-k2.6` genera CSS de ~3987 chars, se corta en posición 3962 (JSON unterminated). El retry se activa (`attempt 1/3`) pero el run termina antes de que complete.
**Causa raíz**: El runner respeta `max_tasks_per_run` y cierra la iteración después del checkpoint, incluso si hay un retry pendiente. El retry se guarda en estado (`truncation_retry: true`) pero el siguiente run no lo recoge si el estado no persiste correctamente.
**Fix requerido**:
1. Verificar que `truncation_retry: true` persiste en `tasks.yaml` entre runs.
2. Verificar que al inicio del siguiente run, las tareas con `truncation_retry: true` se seleccionan en el batch con prioridad.
3. Alternativa: aumentar `max_tokens` en `config.json` para tareas CSS (skill `frontend-html-basic` → modelo con más tokens).

---

### P2 — Validate demo3 hospital site runs end-to-end (clean rerun)
**What**: Three fixes applied to `/project/start` flow. All blocked by shell command injection of multi-line goals. Now validate.

**Fixes applied**:
- `initProject` → `spawnSync` with args array (no shell interpolation, handles any chars)
- `runner.js init` args parsing → filters `--root` AND its value (goal no longer contaminated)
- `express.json` limit → 1mb (supports long prompts)
- `auto-planner.js` → `mkdirSync` before writeFileSync

**Procedure**:
1. Wipe `C:\Users\Windows\Documents\demo3`
2. Restart dashboard (`npm run dashboard`)
3. Submit hospital Machala goal (multi-line, with URL) via dashboard
4. Confirm terminal shows `[INIT]` messages + planner generates tasks
5. Confirm run reaches `all_tasks_completed`
6. Open `demo3/index.html` in browser — styles and scripts should load (integration fix validation)

**Done when**: demo3 completes from clean state, all files integrate correctly in browser.

---

### P2 — Configure model-per-skill (Codex for code, minimax for drafts)
**What**: `system/config.json → model_mapping` currently routes all skills to one model. Map frontend/backend skills to Codex, lightweight tasks to minimax.

**File**: `system/config.json` in orchestrator root.  
**Do not change**: runner.js — the mapping mechanism already exists.

---

### P3 — Add Resume button to dashboard UI
**What**: When `state.json → status = paused`, dashboard shows no Resume button. User must run CLI manually.

**File**: `src/web/` — identify the dashboard component that renders run controls.  
**Fix**: Add button that calls `triggerResume()` on the service when status is paused.

---

### P4 — Integrate Engram for cross-run planner memory
**Repo**: https://github.com/Gentleman-Programming/engram  
**Purpose**: Let the planner remember architectural decisions from prior runs.  
**Prerequisite**: P1 and P2 must be stable first. Do not introduce Engram while core loop is still being hardened.

---

### P5 — Codex integration as production executor
**What**: Wire Codex as the LLM for `skill: frontend-*` and `skill: backend-*` tasks.  
**Why**: minimax-m2.7 generates verbose output that triggers truncation retries. Codex produces tighter, more structured code.  
**Prerequisite**: P2 (model mapping).

---

---

### P3 — UI: Kanban no muestra estado "running" durante ejecución
**Síntoma**: Tarea pasa de `pending` directo a `done` o `failed` sin mostrar `in_progress`. No hay señal visual de que algo está corriendo.
**Causa**: El runner marca la tarea `in_progress` brevemente antes de completar, pero el dashboard solo recibe snapshot updates cada N segundos — nunca captura el estado intermedio.
**Fix requerido**: Emitir un evento SSE explícito `task:running` cuando el runner empieza a ejecutar una tarea (antes de la LLM call), y que el kanban lo refleje sin esperar el snapshot completo.

---

### P4 — UI: No hay botón Resume cuando el runner está pausado
**Síntoma**: Cuando `state.json → status = paused`, el dashboard no muestra botón de resume. Usuario debe usar CLI.
**Fix**: En `src/web/public/dashboard/index.html`, mostrar el botón "Resume" condicionalmente cuando el estado es `paused`. El endpoint ya existe: `POST /api/v1/resume`.

---

### P5 — UX: Mensaje `[NEXT] Ejecuta las tareas del batch` aparece en modo AUTO
**Síntoma**: El runner imprime instrucciones manuales ("Marca cada tarea como done en tasks.yaml...") incluso en ejecución automática. Confunde al usuario — parece que el sistema espera intervención manual.
**Fix**: Suprimir o reemplazar ese bloque de texto cuando el runner está en modo AUTO_EXECUTE. Solo mostrarlo en modo manual.

---

### P6 — VELOCIDAD: Cada iteración = proceso nuevo + LLM secuencial + sin streaming
**Síntoma**: 6-8 minutos para 6 tareas simples. Realtime feed muestra gaps de 4-7 minutos entre snapshots.

**Diagnóstico arquitectónico** (revisión 2026-04-21):

El banner `🟢 BATCH PARALELO` que imprime el runner es un nombre falso — el loop en `runner.js:2078` es un `for...of` con `await` secuencial. El nombre del campo `parallel_batch` en `state.json` no corresponde a ninguna ejecución paralela real. Este mismatch hace el problema invisible en los logs.

**Causas rankeadas por impacto real**:

1. **Loop secuencial dentro del batch — ARQUITECTURAL (impacto dominante)**
   `runner.js:2078` — cada tarea espera a que la anterior termine. Con `max_batch_size=3` y 60-90 s por LLM call, 3 tareas cuestan 180-270 s en secuencia, vs ~90 s en paralelo. Este es el cuello de botella principal.
   **Bloqueador para resolverlo**: race condition en escritura de `tasks.yaml`. Bajo `Promise.all` real, dos tareas compartirían el mismo `tasksDoc` en memoria, lo mutarían concurrentemente, y el segundo `saveTasksWithLock` perdería los cambios del primero silenciosamente (last-writer-wins con hash check).

2. **Un solo modelo para todas las skills — CONFIGURACIÓN (impacto alto, riesgo cero)**
   `system/config.json` → `model_mapping` enruta todas las skills a `"base"` → mismo modelo lento para planning y para un HTML simple. Cambiar skills de baja complejidad (`frontend-html-basic`, `ux`) a un modelo más rápido reduce latencia por task sin tocar código. La infraestructura (`model_mapping` en `openrouter.js`) ya funciona.

3. **Fetch sin streaming — ARQUITECTURAL (impacto bajo en modo secuencial)**
   `providers/openrouter.js:27` — `response.text()` bloquea hasta que llega el último token. En modo secuencial, streaming no reduce tiempo total — solo ayudaría si el paralelismo ya estuviera resuelto (UX + P7).

4. **Spawn por run — ARQUITECTURAL (impacto menor, <5% del tiempo total)**
   `dashboard-service.js:180` — cada click de Run spawna un proceso Node nuevo: parseo de YAML, config, state hydration. Overhead real: ~2-5 s por ciclo. Con 2-3 ciclos para 6 tareas = 10-15 s sobre 360-480 s totales. Un daemon eliminaría esto, pero la ganancia es marginal hasta resolver el loop secuencial.

**Secuencia correcta de cambios**:

- **Paso 1 — Ahora, sin riesgo**: Agregar segunda clave de modelo en `config.json` (ej. `"fast": "<modelo-rapido>"`) y mapear `frontend-html-basic`, `ux`, y skills ligeras a `"fast"`. Dejar planning, backend, y architecture en el modelo actual. Validar en un run real. Tiempo estimado: 15 min.

- **Paso 2 — Prerrequisito para paralelismo**: Separar mutación en memoria de escritura a disco. Cada tarea del batch acumula su resultado en un objeto aislado; un paso serial post-batch aplica todos los resultados a `tasksDoc` y llama `saveTasksWithLock` una sola vez. Esto elimina la race condition sin cambiar la semántica del lock.

- **Paso 3 — Paralelismo real**: Reemplazar el `for...of` con `Promise.all(batch.map(...))` usando el patrón de resultado aislado del Paso 2. La selección de batch ya garantiza que ninguna tarea del batch depende de otra tarea del mismo batch (`getExecutableTasks` solo incluye tareas con todos sus `depends_on` en `done`). El dependency guard agregado en P0 también aplica bajo concurrencia.

- **Paso 4 — Daemon (opcional, bajo ROI)**: Solo después de Paso 1-3. Elimina overhead de spawn pero aporta <5% de mejora total. La motivación real sería mantener `tasksDoc` caliente en memoria entre runs, no la velocidad pura.

**No hacer**: cambiar el loop a `Promise.all` sin antes resolver la race condition de YAML — produciría pérdida silenciosa de estados de tareas bajo carga.

---

### P7 — UI: Terminal output parcial / señales de actividad insuficientes
**Síntoma**: El usuario no sabe si el sistema está trabajando o colgado. El botón RUN no cambia de estado cuando hay un run activo.
**Fix**:
1. Botón RUN → mostrar spinner y texto "Ejecutando..." mientras hay un runner activo
2. Agregar "typing indicator" o barra de progreso cuando se está esperando respuesta LLM
**Referencia**: `v8-OrchestOS-fixplan.md` sección 9 — terminal siempre visible, panel inferior fijo.

---

### P8 — Realtime feed no informativo
**Síntoma**: Solo muestra "snapshot updated" con timestamp. No indica qué tarea corrió, qué modelo usó, qué archivos cambió.
**Fix**: Enriquecer los eventos SSE con payload de tarea (`task_id`, `skill`, `model`, `files_changed`). El feed debe leer como log de actividad, no como ping de heartbeat.

---

## Referencia
Ver `plans/v8-OrchestOS-fixplan.md` para el plan completo de rediseño del dashboard y roadmap de v1.

## Do Not Touch (Structural Debt — No Diagnosis Yet)

- `tasks_yaml_conflict` — root cause untraced. Do not patch.
- Path escape check (LLM writes outside ROOT_DIR) — no incident on record yet.
- `refreshSkills`/`detectSkills` missing `--root` — low impact, defer.
