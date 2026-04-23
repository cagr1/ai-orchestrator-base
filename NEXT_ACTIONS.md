---
type: next-actions
updated: 2026-04-23
---

# NEXT_ACTIONS.md

## Status: Loop Closed — Output Quality Phase

Loop cerrado tres veces. PTASK-BOUND y PINTEGRATION resueltos y validados en run real (2026-04-23).
Foco actual: calidad de output del executor (PSKILL-CONTRACT) y UX del dashboard (PCONFIG-DUP, PGEN-SILENT, PDASH-RESTORE).
Resueltos anteriores → `HISTORY.md`.

---

## Filosofía de trabajo

**Test antes de arreglar bugs. Fix en el origen, no en el síntoma.**

1. Reproducir el bug en un run controlado y observar el síntoma exacto en logs/YAML
2. Aplicar el fix mínimo en el punto de intervención correcto
3. Confirmar en un run real que el síntoma desaparece

Sin validación en run real, el fix es hipótesis — no solución.

---

## Orden canónico de ejecución

1. **PCONFIG-DUP** — ✓ aplicado (2026-04-23)
2. **PSKILL-CONTRACT** — ✓ patch aplicado por Codex (2026-04-23), pendiente arch-review
3. **PSKILL-IMPORT** — barrera de normalización en el punto de entrada de skills
4. **PGEN-SILENT + PDASH-RESTORE** — UX polish (2–4 líneas cada uno)
5. **P0** — validar dep guard en run real
6. **P2-MODEL** — model-per-skill después de PSKILL-CONTRACT
7. **P8.2 / P8.3** — integrity fixes menores
7. **P3 / P5 / P7 / P9** — UI/UX polish
8. **P6** — paralelismo (requiere todos los guards anteriores)

---

## PCONFIG-DUP — UX: Tres inputs de project root solapados

**Síntoma confirmado 2026-04-23**: el usuario tiene tres lugares para el project root con propósito ambiguo:

| ID | Ubicación | Estado real |
|---|---|---|
| `#projectPath` | Panel Config | Activo — fallback en `createProjectBtn` handler |
| `#inlineProjectRoot` | Bajo el textarea (prompt tab) | Activo — primera lectura en `createProjectBtn` handler |
| `#existingProjectPath` + `#existingProjectToggle` | Bajo el textarea | **Dead code** — nunca leído por ningún handler |

**Fix mínimo** (`index.html`):
1. Eliminar `div.existing-project-row` completo — dead code.
2. Eliminar `div.project-root-inline` con `#inlineProjectRoot` — duplicado del Config.
3. `createProjectBtn` handler (línea ~891): usar `#projectPath` directamente. Si vacío → toast "Set project root in Config tab first" + focus en Config.
4. Agregar bajo el textarea un `<small>` con path activo: `Using: [path] · Edit in Config` — bind a `#projectPath`.

**Prerequisito**: ninguno.

---

## PSKILL-CONTRACT — PATCH APLICADO, PENDIENTE ARCH-REVIEW (2026-04-23)

**Codex implementó**:
- `src/integrations/skill-manager.js:139` — `normalizeSkillFile(filePath)` exportada; vendor stubs renombrados a `.md` y normalizados
- `runner.js:630` — inyección de skill en `buildExecutionPrompt`; bloque `--- SKILL GUIDELINES ---` en línea ~704; warn sin throw en ~713
- `runner.js:3114` — `buildExecutionPrompt` exportada
- `tests/phase_skill_injection.test.js` — nuevo; passed standalone y en `npm test`
- **NOTA**: test NO agregado a `tests/run-all.js` — pendiente fix

**Arch-review completado (2026-04-23) — 4 issues encontrados, prompt de fix listo para Codex**:

1. **CRÍTICO** `skills/frontend-html-basic.md:40-50` — JSON template + "Output only markdown" dentro de `## Output bounds` se inyecta verbatim → dos schemas JSON contradictorios en el prompt del executor. Fix: eliminar líneas 40-50, auditar otros skill files.
2. **Menor** `runner.js:~713` — warn message dice "not found" aunque el archivo sí existe pero no tiene secciones. Fix: separar en dos warns distintos.
3. **Simple** `tests/run-all.js` — `phase_skill_injection.test.js` no registrado. Fix: agregar una línea.
4. **Medio** `runner.js:678-681` — vendor paths (`skills/vendor/backend/`, `skills/vendor/frontend/`) no están en la lista de candidatos. Fix: añadir dos entradas al array.

**Pendiente antes de marcar cerrado**:
- Correr prompt de fix en Codex → `npm test` verde → validar en run real que executor recibe SKILL GUIDELINES sin JSON duplicado

---

## PSKILL-CONTRACT — CONTEXTO ORIGINAL: Skill files nunca llegan al executor LLM

**Problema confirmado**: `buildExecutionPrompt(task)` construye el prompt sin leer el skill file. `callOpenRouter` usa `skill` solo para model routing. Skills como `design-taste.md` (234 líneas) son invisibles al executor — resultado: output mínimo ("Home | Menu | Contact" sin contenido real, confirmado en run 2026-04-23).

**Problema secundario — 5 formatos incompatibles en el mismo repo**:
| Skill | Formato | Output contract |
|-------|---------|-----------------|
| `frontend-html-basic.md` | `#skill-name` header | Sí — JSON explícito |
| `frontend/design-taste.md` | YAML frontmatter | No |
| `frontend/animations.md` | Sin identificador | No |
| `backend/node-api.md` | Sin identificador | No |
| `vendor/backend/nodejs-backend-patterns` | Sin extensión `.md` | Dead file |

**Tres intervenciones en orden**:

**1. Schema estándar** (cero riesgo):
Frontmatter obligatorio: `name`, `description`, `output_contract` (enum: `json_files`, `markdown`, `none`).
Body sections opcionales: `## Context`, `## Constraints`, `## Output bounds`.

**2. Inyección en `buildExecutionPrompt`** ([runner.js:630-702](runner.js#L630)):
Leer `skills/{task.skill}.md`, inyectar secciones `Constraints` + `Output bounds` como bloque `SKILL GUIDELINES` antes de la task description. Skills sin frontmatter válido → warning en log, no crash.

**3. Normalizar skills existentes**:
- Agregar frontmatter a todos los skills sin él.
- Mover/eliminar vendor skills sin extensión `.md`.

**Prerequisito**: PCONFIG-DUP completado (no mezclar cambios de UI y executor en el mismo run de validación).

---

## PGEN-SILENT — UX: "Generate Tasks" usa goal previo sin avisar

**Síntoma**: F5 → textarea vacío → "Generate Tasks" → el sistema usa `state.goal` del run anterior sin advertencia.

**Causa raíz**: [dashboard-service.js:519](src/web/services/dashboard-service.js#L519) — fallback en cascada `goal || state.goal || config.prompt`. `initProject` no guarda el prompt en `dashboard.json`.

**Fix en dos partes**:
1. `initProject` ([dashboard-service.js:308](src/web/services/dashboard-service.js#L308)) — `prompt: goal` al `updateDashboardConfig` call.
2. `generateTasksBtn` handler ([index.html:930](src/web/public/dashboard/index.html#L930)) — si `goal === ''`, toast de advertencia: "Using saved goal: [X]" antes de proceder.

---

## PDASH-RESTORE — UX: Config save no recarga el kanban

**Síntoma**: cambiar `project_root` en Config panel → Save → kanban permanece vacío. Page reload sí funciona.

**Fix mínimo** (2 líneas):
1. `api.js:106` — `realtime.broadcast('snapshot:updated', dashboard.getSnapshot())` antes de `res.json`.
2. `index.html:860` — `await loadInitial()` tras toast de éxito del save.

---

## P0 — APLICADO, SIN VALIDAR: Dependency guard en runtime

**Patch aplicado**: `runner.js:2081-2099` — dep guard bloquea tarea si dependencia está `failed`.
**Validación requerida**: forzar que T1 falle en un run. Confirmar en logs: `[DEPS GUARD] Blocking T2 — dependency T1 is failed`. Confirmar en `tasks.yaml`: T2 queda `blocked` con `block_reason: dependency_failed:T1`.

---

## P1 — APLICADO, SIN VALIDAR: Truncation break + retry pickup

**Patch aplicado**: `runner.js:2414` — truncación hace `break` del batch loop.
**Incógnita pendiente**: el compact-mode retry no disparó en el log del run 2026-04-22. Verificar si `truncation_retry: true` quedó en `tasks.yaml` de demo3 para confirmar que P8.1 no intervino.

---

## PSKILL-IMPORT — Skills externas no pasan por schema validation

**Estado**: no implementado. Prerequisito: schema de PSKILL-CONTRACT definido (ya está).

**Problema de fondo**: la normalización de PSKILL-CONTRACT es una corrección puntual a los skills existentes. Cualquier skill que entre después por autoskills o CLI externa llega sin schema y rompe la inyección silenciosamente — exactamente el mismo problema que PSKILL-CONTRACT resuelve.

**Contexto real del codebase**:
- `src/integrations/autoskills-adapter.js` — corre `npx autoskills -y`, instala skills en `skills/vendor/`. No tiene paso de normalización post-install.
- `src/integrations/skill-manager.js:29` — `collectSkills()` ignora archivos sin `.md` extension. Los 5 archivos en `skills/vendor/` sin extensión (`nodejs-backend-patterns`, `nodejs-best-practices`, `accessibility`, `frontend-design`, `seo`) son actualmente invisibles.
- `skills/vendor/` — skills instalados por autoskills; nunca tuvieron schema, nunca fueron visibles al runner.

**Tres fuentes de skills que necesitan el mismo schema**:
| Fuente | Cómo entra | Problema |
|---|---|---|
| Manual | Directamente en `skills/` | PSKILL-CONTRACT lo normaliza una vez |
| Autoskills (`npx autoskills -y`) | `autoskills-adapter.js` → `skills/vendor/` | Sin `.md` → invisibles; sin frontmatter |
| CLI externa (`npx skills add URL`) | No implementado aún | Necesita el mismo adapter cuando se implemente |

**Solución — 3 capas**:

**Capa 1 — `normalizeSkillFile(filePath)` (función pura reutilizable)**:
- Si no tiene frontmatter → inferir `name` del filename, `output_contract` del contenido (`json_files` si produce archivos, `markdown` si produce docs).
- Agregar `## Constraints` y `## Output bounds` como placeholders vacíos si no existen.
- No inventar reglas — solo estructura. Retornar `{ added_frontmatter, added_sections, renamed }`.

**Capa 2 — Barrera en `autoskills-adapter.js` post-install**:
- Después de `runAutoskills({ yes: true })`, recorrer `skills/vendor/` y correr `normalizeSkillFile` en cada archivo.
- Archivos sin `.md` → renombrar a `<name>.md` antes de normalizar (para que `collectSkills` los vea).
- Loguear qué se normalizó: `[SKILLS] Normalized 3 vendor skills, renamed 2 files`.

**Capa 3 — `node runner.js skills validate` (nuevo CLI command)**:
- Correr `collectSkills` + validar frontmatter de cada skill.
- Reportar: `✓ valid`, `⚠ missing output_contract`, `✗ no frontmatter`.
- Exit code 0 siempre (es auditoría, no bloqueante).

**Prerequisito**: PSKILL-CONTRACT completado — el normalizer usa el mismo schema definido ahí.
**Desbloquea**: cualquier skill importada por autoskills es automáticamente usable por el executor sin intervención manual.

---

## P2-MODEL — Configurar model-per-skill

**Estado**: no aplicado.
**Fix**: `system/config.json` — mapear `frontend-html-basic`, `ux` y skills ligeras a un modelo rápido.
**Prerequisito**: PSKILL-CONTRACT completado — cambiar modelo y prompt al mismo tiempo impide aislar qué cambió el output.

---

## P8.2 — Auto-complete bypass de R10 para `output: []`

**Líneas**: `runner.js:2262-2279`
**Fix**: branch auto-complete debe requerir respuesta verificable del LLM, no solo campo vacío.

---

## P8.3 — `failed_permanent` puede re-entrar al pool ejecutable

**Líneas**: `runner.js:1720-1742`
**Fix**: agregar `'failed_permanent'` al guard en línea 1727.

---

## P3 — UI: Kanban no muestra "running" durante ejecución

**Fix**: emitir evento SSE explícito `task:running` antes de la LLM call.

---

## P5 — UX: Mensaje manual aparece en modo AUTO

**Fix**: suprimir bloque `[NEXT]` cuando `AUTO_EXECUTE = true`.

---

## P6 — VELOCIDAD: Loop secuencial + spawn overhead

**Secuencia correcta antes de habilitar paralelismo**:
1. P8.1 — resuelto
2. PTASK-BOUND — resuelto
3. P2-MODEL — model-per-skill (reduce latencia por tarea)
4. Isolated-result pattern (elimina race condition en writes)
5. `Promise.all` parallelism

---

## P7 — UI: Sin señal de actividad durante LLM call

**Fix**: spinner en botón Run + indicador de "waiting for LLM".

---

## P9 — Realtime feed no informativo

**Fix**: enriquecer eventos SSE con `task_id`, `skill`, `model`, `files_changed`.

---

## PNORM-PROMPT — DIFERIDO: Validación de task description contra skill contract

**Origen**: idea de prompt-master repo (X.com, 2026-04-23). La propuesta original es un normalizer genérico de inputs libres (`normalizePrompt(rawInput, skillContext)`). Evaluado y acotado para OrchestOS.

**Por qué el normalizer genérico NO encaja en OrchestOS**: el executor no recibe input libre de usuario — recibe una task description generada por el planner LLM. Aplicar heurísticas de "detectar vaguedad" sobre texto ya estructurado es compensar un planner débil, no arreglarlo. La causa raíz de tasks vagas es el prompt del planner (PTASK-BOUND lo ataca) o la ausencia de skill guidelines (PSKILL-CONTRACT lo ataca).

**Lo que SÍ tiene valor**: una función de validación concreta y acotada:
```
validateTaskAgainstSkill(task, skillFrontmatter) → { valid, warnings[] }
```
- Verifica que `task.description` menciona el output format que el skill contract exige.
- Verifica que `task.output[]` contiene al menos un archivo listado en `skill.output_bounds`.
- Si faltan → loguear `[WARN] Task T3 description missing output format — skill contract requires json_files`.
- No enriquece silenciosamente. No reescribe. Solo audita y avisa.

**Diferencia clave con el prompt original**: no es un normalizer (transforma) — es un validator (avisa). OrchestOS no debe transformar silenciosamente lo que el planner genera; debe hacerlo visible para que el planner mejore.

**Prerequisito**: PSKILL-CONTRACT completado (necesita `skillFrontmatter` parseado, que ese PR provee).
**Prioridad**: baja — PSKILL-CONTRACT ya inyecta los constraints. Este validator añade una capa de observabilidad, no de corrección.

---

## Do Not Touch (Deuda estructural — sin diagnóstico completo)

- Path escape check (LLM puede escribir fuera de ROOT_DIR) — sin incidente, defer.
- `refreshSkills`/`detectSkills` missing `--root` — low impact.
- P8.4 (crash window lock/saveState) — riesgo bajo hasta paralelismo real.
- P8.5 (double counter mutation) — low impact con loop secuencial.
- P8.6 (descomposición de runner.js en módulos) — ventana óptima post-P6.
- PTASK-TRUE (pre-flight output budget estimator) — infraestructura futura.
