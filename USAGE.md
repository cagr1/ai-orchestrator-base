# Guia Operativa (Terminal + Chat Kilo.ai)

Este sistema orquesta estado Y verifica ejecucion real.
El runner gestiona el flujo y **verifica hashes de archivos** para asegurar que cada tarea hizo cambios reales.

Tu trabajo siempre alterna entre:
1. Terminal
2. Chat de Kilo.ai

---

## REGLAS INQUEBRANTABLES

> Estas reglas aplican a TODOS los agentes y NO pueden ser ignoradas.

1. **El runner crea snapshots** de archivos del proyecto ANTES de cada tarea
2. **El runner compara hashes** DESPUES de que el executor dice `executor:done`
3. **Si no hay cambios reales** en archivos del proyecto → `executor:done` es **RECHAZADO**
4. **QA verifica** que `system/evidence/{task_id}.json` existe con cambios reales
5. **Reviewer verifica** que las reglas del skill fueron aplicadas en el codigo
6. **No hay forma de saltarse** esta verificacion — es automatica via hashes MD5

---

## Prerequisito: Configurar project_root

**ANTES de iniciar cualquier run**, configura el directorio del proyecto en `system/config.json`:

```json
{
  "evidence": {
    "required": true,
    "min_files_changed": 1,
    "project_root": "E:\\Carlos\\Development Tools\\Proyectos\\TuProyecto"
  }
}
```

Sin `project_root`, el sistema de evidencia no puede verificar cambios.

---

## Flujo Correcto

`init -> planner -> executor(+evidence) -> qa(+evidence) -> reviewer(+skill) -> memory -> repeat`

- `init` y control de estado: Terminal
- `planner/executor/qa/reviewer/memory`: Chat de Kilo.ai

### Modo Chat-Only (recomendado)

Prompt recomendado:

```text
Trabaja en {PROJECT_PATH}\.agents.

REGLAS INQUEBRANTABLES:
- El runner verifica hashes de archivos antes y despues de cada tarea
- Si dices executor:done pero no cambiaste archivos, el token es RECHAZADO
- DEBES hacer cambios REALES en el proyecto
- DEBES leer y aplicar el skill file asignado
- Sin evidence = qa:fail y review:fail automaticos

1) Ejecuta: node runner.js start "{GOAL}"
2) Lee la salida del runner y ejecuta la accion requerida
3) Despues de cada accion, ejecuta: node runner.js next
4) Repite hasta phase=complete o halted=true
5) Al final muestra resumen con:
   - node runner.js status
   - system/runs/<run_id>/summary.md
```

---

## Paso a Paso (Obligatorio)

## Paso 1: Configurar project_root

En `system/config.json`, agregar:
```json
"evidence": {
  "project_root": "ruta/a/tu/proyecto"
}
```

## Paso 2: Inicializar run

En Terminal:

```bash
node runner.js start "Tu objetivo del proyecto"
```

Resultado esperado:
- Se actualiza `system/goal.md`
- Se resetean `system/plan.md` y `system/tasks.md`
- Se crea nuevo `run_id` en `system/state.json`
- Se muestra warning si `project_root` no esta configurado

---

## Paso 3: Ver estado

En Terminal:

```bash
node runner.js status
```

Debes ver:
- `phase: planning`
- `awaiting_agent: planner`
- `evidence_required: true`
- `project_root: /ruta/a/tu/proyecto`

---

## Paso 4: Ejecutar Planner en Chat Kilo.ai

En chat Kilo.ai:

```text
Actua como Planner Agent.
Lee:
- system/goal.md
- system/config.json (para ver skills disponibles y tier)

Genera:
1) system/plan.md
2) system/tasks.md

Reglas de tasks.md:
- Debe ser tabla markdown
- Columnas minimas obligatorias: id | skill | estado | resultado
- Opcional: dependencias
- id formato: T001, T002, ...
- estado inicial: pending
- resultado inicial: -
```

---

## Paso 5: Volver a Terminal

```bash
node runner.js next
```

El runner:
1. Detecta plan y tasks generados
2. Selecciona primera tarea pending
3. **Crea pre-snapshot** de archivos del proyecto
4. Pide Executor para la tarea

---

## Paso 6: Ejecutar Executor en Chat Kilo.ai

```text
Actua como Executor Agent.
Lee system/tasks.md y toma la tarea indicada por el runner.

OBLIGATORIO:
1. Lee el skill file asignado COMPLETO
2. Haz cambios REALES en archivos del proyecto
3. Lista todos los archivos que modificaste/creaste
4. Actualiza tasks.md con executor:done

RECUERDA: El runner verifica hashes. Si no hay cambios reales, executor:done sera rechazado.
```

---

## Paso 7: Volver a Terminal

```bash
node runner.js next
```

El runner:
1. Crea post-snapshot y compara hashes
2. Si hay cambios reales → acepta `executor:done` → pide QA
3. **Si NO hay cambios** → RECHAZA `executor:done` → pide Executor de nuevo

---

## Paso 8: Ejecutar QA en Chat Kilo.ai

```text
Actua como QA Agent para la tarea actual.
PRIMERO: Lee system/evidence/{task_id}.json
Si no existe o tiene 0 cambios → qa:fail inmediato.
Si existe: inspecciona los archivos cambiados y valida calidad.
Actualiza tasks.md: qa:pass o qa:fail
```

---

## Paso 9: Volver a Terminal y pedir Reviewer

```bash
node runner.js next
```

---

## Paso 10: Ejecutar Reviewer en Chat Kilo.ai

```text
Actua como Reviewer Agent para la tarea actual.
PRIMERO: Lee system/evidence/{task_id}.json
SEGUNDO: Lee el skill file asignado
Verifica que las reglas del skill fueron aplicadas en el codigo.
Actualiza tasks.md: review:pass(score=X) o review:fail(score=X)
```

---

## Paso 11: Memory (cierre de tarea)

```bash
node runner.js next
```

En chat Kilo.ai agrega en `system/memory.md` una entrada que incluya:
- El `task_id`
- Los archivos cambiados (de evidence.json)
- Las decisiones tecnicas

```markdown
### T001 2026-03-02 - executor
**Decision:** ...
**Archivos cambiados:** src/components/HeroSection.tsx, src/styles/hero.css
**Skill aplicado:** frontend-design-taste
**Razon:** ...
**Alternativas descartadas:** ...
**Impacto en tareas futuras:** ...
```

Luego:
```bash
node runner.js next
```

---

## Paso 12: Repetir ciclo

Repite pasos 6 a 11 hasta completar todas las tareas.

---

## Comandos de Control

```bash
node runner.js init "objetivo"     # Inicializa run limpio
node runner.js start "objetivo"    # Init + ejecuta primer next
node runner.js status              # Estado actual (incluye evidence info)
node runner.js next                # Ejecuta solo 1 paso (con verificacion de evidence)
node runner.js "objetivo"          # Run completo
node scripts/smoke-runner.js       # Smoke tests del sistema
```

---

## Sistema de Evidence

Cada tarea genera archivos en `system/evidence/`:

```
system/evidence/
  T001-pre.json     # Hashes de archivos ANTES de ejecutar
  T001.json         # Diff: archivos cambiados/creados/eliminados
  T002-pre.json
  T002.json
```

El runner usa estos archivos para:
1. Verificar que el executor hizo cambios reales
2. Proveer a QA y Reviewer la lista de archivos a inspeccionar
3. Registrar evidencia auditable de cada tarea

---

## Troubleshooting Rapido

## Error: "executor:done REJECTED — no file changes detected"
- El executor no hizo cambios reales en archivos del proyecto
- Verifica que `evidence.project_root` en config.json apunta al proyecto correcto
- El executor debe modificar/crear archivos `.tsx`, `.ts`, `.js`, `.css`, etc.

## Error: "No project_root configured"
- Agrega `evidence.project_root` en `system/config.json`
- Debe ser la ruta absoluta al directorio del proyecto

## HALT: invalid_tasks_schema
- Corrige `system/tasks.md`:
  - columnas: `id|skill|estado|resultado`
  - IDs validos `T001...`
  - estados validos
  - sin duplicados

## No avanza a siguiente agente
- Revisa tokens en `resultado` de la tarea
- Revisa `system/evidence/{task_id}.json` existe

---

## Regla de Oro

> El runner es el gatekeeper. Ningun token es aceptado sin evidencia verificable por el sistema de archivos. El LLM no puede auto-certificar completitud — el file system es la fuente de verdad.
