---
type: next-actions
updated: 2026-04-22
---

# NEXT_ACTIONS.md

## Status: Loop Closed — Quality & Integrity Phase

Loop confirmed cerrado dos veces: demo2 (2026-04-21) y demo3 (2026-04-22, minimax-m2.7).
Falla activa visible: los archivos de output no se enlazan entre sí (index.html no incluye styles.css ni script.js).

---

## Filosofía de trabajo (2026-04-22)

**Test antes de arreglar bugs. No repetir errores.**

Antes de aplicar cualquier fix:
1. Reproducir el bug en un run controlado y observar el síntoma exacto en logs/YAML
2. Aplicar el fix mínimo
3. Confirmar en un run real que el log/síntoma esperado desaparece

Sin validación en run real, el fix es hipótesis — no solución. Esto aplica especialmente a P0 y P1 que están aplicados pero sin confirmar.

---

## Priority Queue — Estado actual (2026-04-22)

---

### PGUARD — CRÍTICO: Create Project sobrescribe proyecto existente sin avisar
**Síntoma**: Al presionar "Create Project" sobre una ruta que ya tiene `system/state.json` y `system/tasks.yaml`, el sistema re-genera el plan desde cero, borra todo el progreso previo, y reinicia `state.json` sin advertencia.
**Causa**: `api.js:114` → `initProject` → `generateTasks` — ninguno de los tres verifica si ya existe un proyecto en `project_root`. `tasks.yaml` se sobreescribe incondicionalmente.
**Dónde arreglar**: `dashboard-service.js:285` (inicio de `initProject`) — verificar si `system/state.json` o `system/tasks.yaml` existen en el root antes de continuar. Si existen y `state.status !== 'completed'`, retornar `{ok: false, error: 'project_exists', status}` y dejar que la UI ofrezca Resume en su lugar.
**Por qué aquí y no en api.js**: protege contra llamadas directas que bypaseen la ruta HTTP.
**Riesgo si no se resuelve**: pérdida de datos de usuario en cada click accidental.

---

### PINTEGRATION — CRÍTICO: Archivos de output no se enlazan entre sí
**Síntoma confirmado 2026-04-22**: `demo3/index.html` no contiene `<link rel="stylesheet" href="styles.css">` ni `<script src="script.js">`. Los archivos existen pero el HTML no los referencia. El sitio no funciona en browser.
**Causa raíz**: La falla está en el **planner prompt** (`auto-planner.js:buildPrompt`), no en el runner.
- El prompt de ejemplo muestra `"input": []` sin explicar que `input` debe listar los outputs de tareas anteriores que esta tarea debe leer e integrar.
- El LLM genera tareas con `input: []` vacío — el ejecutor de `styles.css` nunca recibe `index.html` como contexto, y el ejecutor de `index.html` nunca sabe qué archivos CSS/JS va a necesitar enlazar.
- `buildExecutionPrompt` en `runner.js:662-674` **sí inyecta** el contenido de `task.input` correctamente — pero si el array está vacío, no hay nada que inyectar.

**Segunda falla (runner.js:667)**: `buildExecutionPrompt` resuelve paths de input con `path.join(ROOT_DIR, inputPath)`. Si `ROOT_DIR` apunta al directorio del orquestador en lugar del proyecto activo, el `fs.existsSync` devuelve false y la inyección silenciosamente no ocurre, incluso con `input` correctamente declarado.

**Fix requerido (dos partes)**:
1. **auto-planner.js:buildPrompt** — agregar instrucción explícita: `input` debe listar los archivos de output de las tareas previas de las que esta tarea depende. Agregar un enforcement pass análogo a `enforceFrontendBootstrap` que verifique que `T_css.input` incluye el HTML y `T_html.input` incluye los nombres de CSS/JS que se van a crear.
2. **runner.js:667** — verificar que el path base para resolver `input` sea el project root (`ROOT_DIR` cuando se pasa `--root`) y no el directorio del orquestador.

---

### P0 — APLICADO, SIN VALIDAR: Dependency guard en runtime
**Patch aplicado**: `runner.js:2081-2099` (dep guard) + `runner.js:2414` (truncation break batch)
**Estado**: código correcto según code review del arch-reviewer, pero **nunca ha disparado en un run real**.
**Edge case conocido**: `failed_permanent` no está en `liveFailedIds` — se bloquea igual por `depNotDone` pero el log dice `dependency_not_done` en lugar de `dependency_failed`. Cosmético, no funcional.
**Validación requerida**: Forzar que T1 falle en un run (manualmente marcar `estado: failed` en `tasks.yaml` mientras corre, o crear un task con output inválido). Confirmar en logs: `[DEPS GUARD] Blocking T2 — dependency T1 is failed`. Confirmar en `tasks.yaml`: T2 queda `blocked` con `block_reason: dependency_failed:T1`.
**No marcar como done hasta ver esa línea en un run real.**

---

### P1 — APLICADO, SIN VALIDAR: Truncation break + retry pickup
**Patch aplicado**: truncation ahora hace `break` en lugar de continuar el loop (`runner.js:2414`)
**Estado**: correcto estructuralmente. El `truncation_retry: true` persiste en `tasks.yaml` y el siguiente run lo recoge vía `getExecutableTasks` (el task queda `pending`).
**Incógnita**: el truncation original ocurrió con `kimi-k2.6` a ~3987 chars. Con `minimax-m2.7` activo ahora, puede que no se alcance ese threshold — el bug podría estar dormido.
**Validación requerida**: correr un task con output CSS largo y confirmar si minimax también trunca. Si no trunca, el patch es preventivo y correcto. Si sí trunca, confirmar que el retry se recoge en el siguiente run con `truncation_retry: true` visible en `tasks.yaml`.

---

### P8.1 — CRÍTICO: Silent state loss en conflicto de hash YAML
**Líneas**: `runner.js:2431-2440`
**Síntoma**: `saveTasksWithLock` retorna `{ok: false, reason: 'tasks_yaml_conflict'}` y el runner trata esto como `[WARN]` y continúa. Todas las transiciones de estado del batch (`done`, `failed`, `blocked`, `truncation_retry`) se descartan silenciosamente. El runner termina con `[END] Runner finished` limpio, pero `tasks.yaml` no fue actualizado.
**Consecuencia**: runs subsiguientes re-ejecutan tareas ya completadas, `cost.json` incrementa sin progreso real, outputs correctos se sobreescriben.
**Relación con "Do Not Touch"**: `tasks_yaml_conflict` estaba sin diagnóstico — este es el vector de daño exacto. El `{ok: false}` es detección sin recovery.
**Fix requerido**: convertir el warn en halt con `hardFailure` — si el YAML no se pudo guardar, el run no fue exitoso y el estado no debe marcarse como completado.

---

### P2-INTEGRATION-VALIDATE — Validar demo3 end-to-end con fix de planner
**Bloquea a**: confirmar que `PINTEGRATION` fix funciona.
**Procedure post-fix**:
1. Aplicar fix de planner prompt (PINTEGRATION)
2. Wipear `C:\Users\Windows\Documents\demo3`
3. Restart dashboard
4. Submit goal → confirmar tasks.yaml tiene `input` con cross-references entre tareas
5. Dejar correr hasta `all_tasks_completed`
6. Abrir `demo3/index.html` en browser — verificar que `styles.css` y `script.js` cargan y no hay 404 en DevTools
**Done when**: network tab en browser muestra 200 para todos los recursos enlazados desde `index.html`.

---

### P2-MODEL — Configurar model-per-skill
**Estado**: no aplicado. Todas las skills rutean a `"base"` → `minimax/minimax-m2.7`.
**Fix**: `system/config.json` — agregar clave `"fast": "<modelo-rapido>"` y mapear `frontend-html-basic`, `ux`, y skills ligeras a `"fast"`. Dejar `planner`, `backend`, `architecture` en el modelo actual. Cero código, cero riesgo.
**Prerequisito**: PINTEGRATION debe estar validado primero — cambiar modelo y prompt al mismo tiempo hace imposible aislar cuál arregló el problema.

---

### P8.3 — `failed_permanent` puede re-entrar al pool ejecutable
**Líneas**: `runner.js:1720-1742` (`recalculateTaskStates`)
**Riesgo**: el guard protege `done`, `failed`, `split_required` pero no `failed_permanent`. Una tarea `failed_permanent` con deps incompletas se sobreescribe a `blocked`. Cuando esas deps completan en un run posterior, la tarea sube de `blocked` → `pending` y re-entra al batch, bypassando el mecanismo de exhaustion.
**Fix**: agregar `'failed_permanent'` al guard en línea 1727.

---

### P8.2 — Auto-complete bypass de R10 para `output: []`
**Líneas**: `runner.js:2262-2279`
**Riesgo**: tasks con `output: []` generan un archivo markdown sintético, fabrican evidencia, y se marcan `done` descartando la respuesta del LLM. Cualquier task sin `output` declarado (error del planner) siempre auto-completa.
**Fix**: el branch auto-complete debe requerir que el LLM haya producido alguna respuesta verificable, no solo existir el campo vacío.

---

### P3 — UI: Kanban no muestra estado "running" durante ejecución
**Síntoma**: Tarea pasa de `pending` directo a `done` o `failed` sin mostrar estado intermedio.
**Fix requerido**: Emitir evento SSE explícito `task:running` antes de la LLM call, y que el kanban lo refleje sin esperar el snapshot completo.

---

### P5 — UX: Mensaje manual aparece en modo AUTO
**Síntoma**: El runner imprime `[NEXT] Ejecuta las tareas del batch...` incluso en ejecución automática.
**Fix**: Suprimir ese bloque cuando `AUTO_EXECUTE = true`.

---

### P6 — VELOCIDAD: Loop secuencial + spawn overhead + modelo único
*(Ver diagnóstico completo en versión anterior — se mantiene intacto)*

**Resumen**: El loop `for...of` con `await` en `runner.js:2078` es secuencial aunque el banner dice "PARALELO". El bloqueador para paralelismo real es la race condition en `tasks.yaml` (P8.1 debe resolverse primero). El cambio de mayor leverage inmediato sin riesgo es model-per-skill (P2-MODEL).

**Secuencia correcta**:
1. P8.1 (silent state loss) → prerequisito para paralelismo seguro
2. P2-MODEL (config, cero riesgo)
3. Isolated-result pattern (fix de race condition)
4. `Promise.all` parallelism
5. Daemon (bajo ROI, opcional)

---

### P7 — UI: Terminal sin señal de actividad durante LLM call
**Síntoma**: botón RUN no cambia de estado, usuario no sabe si el sistema está trabajando o colgado.
**Fix**: spinner en botón + indicador mientras se espera respuesta LLM.

---

### P9 — Realtime feed no informativo
**Síntoma**: solo muestra "snapshot updated". No indica tarea, modelo, archivos cambiados.
**Fix**: enriquecer eventos SSE con `task_id`, `skill`, `model`, `files_changed`.

---

## Resuelto — Referencia

| Item | Fecha | Notas |
|------|-------|-------|
| P4 Auto-loop + Resume | 2026-04-22 | `dashboard-service.js:217` — auto-resume cuando `status=paused`, exit code 0. Run button rutea a `/resume` cuando estado es paused. CLI message incluye `--root`. |
| Input injection en prompts | 2026-04-21 | `runner.js:buildExecutionPrompt` — inyecta contenido de `task.input` como contexto |
| POST /project/start 500 | 2026-04-21 | try/catch en api.js |
| ENOENT en generateTasks | 2026-04-21 | `mkdirSync` en auto-planner.js |
| Multi-line goal shell injection | 2026-04-21 | `spawnSync` con args array |
| runner.js init goal contaminado | 2026-04-21 | filtro de `--root` y su valor |
| express.json body limit | 2026-04-21 | 1mb en server.js |

---

## Do Not Touch (Structural Debt — Sin Diagnóstico Completo)

- Path escape check (LLM writes outside ROOT_DIR) — no incident on record yet.
- `refreshSkills`/`detectSkills` missing `--root` — low impact, defer.
- P8.4 (crash window lock/saveState) — risk low until paralelismo real.
- P8.5 (double counter mutation) — low impact while loop is sequential.
- P8.6 (descomposición runner.js en módulos) — ventana óptima post-P8.1 + P6.
