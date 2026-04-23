---
type: next-actions
updated: 2026-04-23
---

# NEXT_ACTIONS.md

## Status: Guards + Integrity Phase completada — Próximo: Output Enhancement

Resueltos y validados: loop cierra 3 veces, skills al executor, dep guard, R10 bypass eliminado, skill validation terminal filter, failed_permanent guard.
Historial completo → `HISTORY.md`.

---

## Filosofía de trabajo

**Test antes de arreglar bugs. Fix en el origen, no en el síntoma.**

1. Reproducir el bug en un run controlado y observar el síntoma exacto en logs/YAML
2. Aplicar el fix mínimo en el punto de intervención correcto
3. Confirmar en un run real que el síntoma desaparece

Sin validación en run real, el fix es hipótesis — no solución.

---

## Orden canónico de ejecución

| # | Item | Estado |
|---|------|--------|
| 1 | PCONFIG-DUP | ✓ resuelto 2026-04-23 |
| 2 | PSKILL-CONTRACT | ✓ resuelto 2026-04-23, npm test verde |
| 3 | PSKILL-IMPORT | ✓ resuelto 2026-04-23 |
| 4 | PGEN-SILENT + PDASH-RESTORE | ✓ resuelto 2026-04-23 |
| 5 | P0 dep guard | ✓ validado en run real 2026-04-23 |
| 6 | P8.2 / P8.3 / P8.4 | ✓ resuelto 2026-04-23, npm test verde |
| 7 | **P2-MODEL** | **PRÓXIMO** — Codex |
| 8 | **QA/Reviewer stage** | Pendiente — Codex (post P2-MODEL) |
| 9 | **elapsed_ms observabilidad** | Pendiente — Codex (quick win) |
| 10 | P3 / P5 / P7 / P9 | Pendiente — UI/UX polish |
| 11 | PPROVIDER-MULTI | Pendiente — Ollama + multi-provider |
| 12 | P6 paralelismo | Pendiente — requiere todos los guards |

---

## P1 — APLICADO, SIN VALIDAR: Truncation break + retry pickup

**Patch aplicado**: `runner.js:2414` — truncación hace `break` del batch loop.
**Incógnita pendiente**: el compact-mode retry no disparó en el log del run 2026-04-22. Verificar si `truncation_retry: true` quedó en `tasks.yaml` de demo3 para confirmar que P8.1 no intervino.

---

## P2-MODEL — Configurar model-per-skill

**Estado**: no aplicado.

`system/config.json` ya tiene `model_mapping` con todos los skills mapeados a `"base"` y un único modelo configurado en `providers.openrouter.models.base`. El sistema ya soporta múltiples model keys — solo falta poblar el mapping.

**Fix (Codex)**:
1. En `system/config.json`, agregar al menos 2 model keys en `providers.openrouter.models`:
   - `"base"` — modelo actual (minimax/minimax-m2.7) para tasks generales
   - `"fast"` — modelo ligero para tasks simples (ux, frontend-html-basic)
2. En `model_mapping`, actualizar skills ligeras para apuntar a `"fast"`.
3. Verificar que `resolveModelForSkill` en `runner.js` ya consume correctamente el mapping (revisar línea ~15 de `providers/openrouter.js`).

**Prerequisito**: PSKILL-CONTRACT completado ✓ — cambiar modelo y skill context al mismo tiempo ya no es ambiguo.

---

## QA/Reviewer Stage — Pipeline post-executor

**Causa raíz (arch-review 2026-04-23)**: `agents/qa.md` y `agents/reviewer.md` existen pero nunca son invocados. El pipeline runner.js va directo `executor → updateTask(done)`. Cada tarea se marca `done` sin quality-gating — riesgo real de hallucination no detectado.

**Fix estructural (Codex)**: Después de que el executor completa (antes de `updateTask(done)`), agregar dos LLM calls secuenciales:
1. Prompt con `agents/qa.md` + output del executor → parsear `qa:pass` / `qa:fail`
2. Si pass → Prompt con `agents/reviewer.md` → parsear `review:pass(score=X)`
3. Solo si ambos pasan → `updateTask(done)`
4. Si `qa:fail` → tarea vuelve a `pending` con `retry_reason: qa_failed`

**Prerequisito**: P2-MODEL completado (primero estabilizar el modelo antes de agregar stages).

---

## elapsed_ms — Observabilidad Fase 1 (quick win)

`providers/openrouter.js` loguea `[LLM START]` y `[LLM END]` pero no calcula ni persiste la latencia.

**Fix (Codex, ~30 min)**:
- `providers/openrouter.js` línea ~24 (antes del fetch): `const t0 = Date.now()`
- Al construir el objeto de evidencia en `runner.js`: agregar `elapsed_ms: Date.now() - t0`
- En `history.log`: incluir `elapsed_ms` en el evento de completion

**Prerequisito**: ninguno. Fix independiente.

---

## PPROVIDER-MULTI — Soporte multi-provider (Ollama + otros)

**Análisis (2026-04-23)**: El sistema ya tiene la abstracción correcta. `providers/openrouter.js` usa fetch con el formato OpenAI-compatible. Ollama expone exactamente el mismo formato en `http://localhost:11434/v1/chat/completions`. La extensión es:

1. Crear `providers/ollama.js` — mismo contrato que `callOpenRouter`:
   - `base_url`: `http://localhost:11434/v1/chat/completions`
   - Sin `Authorization` header (o vacío)
   - Modelos: `qwen2.5-coder:7b`, `codestral:latest`, `llama3.1:8b`

2. En `runner.js`, `runLLM()` despacha según `config.active_provider`:
   - `openrouter` → `callOpenRouter()`
   - `ollama` → `callOllama()`
   - `anthropic` / `openai` → adaptadores futuros

3. En `system/config.json`:
   - Agregar sección `"ollama"` en `providers`
   - `active_provider: "ollama"` para runs locales sin API key

**Valor**: runs 100% locales sin costo, privacidad, modelos de código como Codestral/Qwen2.5-Coder que son buenos para las tasks del executor.

**Prerequisito**: P2-MODEL completado (primero consolidar el model mapping antes de agregar providers).

---

## P3 — UI: Kanban no muestra "running" durante ejecución

**Fix**: emitir evento SSE explícito `task:running` antes de la LLM call.

---

## P5 — UX: Mensaje manual aparece en modo AUTO

**Fix**: suprimir bloque `[NEXT]` cuando `AUTO_EXECUTE = true`.

---

## P6 — VELOCIDAD: Loop secuencial + spawn overhead

**Secuencia correcta antes de habilitar paralelismo**:
1. P8.1 — ✓ resuelto
2. PTASK-BOUND — ✓ resuelto
3. P2-MODEL — model-per-skill (reduce latencia por tarea)
4. QA/Reviewer stage (valida correctness antes de paralelizar)
5. Isolated-result pattern (elimina race condition en writes)
6. `Promise.all` parallelism

---

## P7 — UI: Sin señal de actividad durante LLM call

**Fix**: spinner en botón Run + indicador de "waiting for LLM".

---

## P9 — Realtime feed no informativo

**Fix**: enriquecer eventos SSE con `task_id`, `skill`, `model`, `files_changed`.

---

## PNORM-PROMPT — DIFERIDO: Validación de task description contra skill contract

La propuesta de valor real (acotada para OrchestOS):
```
validateTaskAgainstSkill(task, skillFrontmatter) → { valid, warnings[] }
```
- Verifica que `task.output[]` contiene al menos un archivo dentro de `skill.output_bounds`.
- Si falta → `[WARN] Task T3 description missing output format — skill contract requires json_files`.
- No transforma — solo audita.

**Prerequisito**: PSKILL-CONTRACT ✓. Prioridad baja.

---

## Arch-Review context — QA/Reviewer y Engram

**QA/Reviewer** (P0 real del arch-review): ver sección "QA/Reviewer Stage" arriba.

**Engram search fallback**: escritura correcta (file-first, Engram async mirror). Búsqueda degrada silenciosamente a substring scan sin indicar al caller. `memoryManager.search()` nunca se invoca en el pipeline actual. Fix mínimo: loguear cuando search() cae al fallback. Conectar al pipeline cuando QA/Reviewer stage esté implementado.

---

## Do Not Touch (Deuda estructural — sin diagnóstico completo)

- Path escape check (LLM puede escribir fuera de ROOT_DIR) — sin incidente, defer.
- `refreshSkills`/`detectSkills` missing `--root` — low impact.
- P8.5 (double counter mutation) — low impact con loop secuencial.
- P8.6 (descomposición de runner.js en módulos) — ventana óptima post-P6.
- PTASK-TRUE (pre-flight output budget estimator) — infraestructura futura.
