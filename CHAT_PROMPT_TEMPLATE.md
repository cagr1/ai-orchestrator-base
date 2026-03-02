# Chat Prompt Template (Kilo.ai)

Copy this block, replace placeholders, and send it in Kilo.ai chat.

```text
Trabaja en {PROJECT_PATH}\.agents.

REGLAS INQUEBRANTABLES (aplican a TODOS los agentes):
- El runner verifica hashes de archivos ANTES y DESPUES de cada tarea
- Si dices executor:done pero no cambiaste archivos del proyecto, el token es RECHAZADO
- DEBES hacer cambios REALES en archivos del proyecto ({PROJECT_PATH})
- DEBES leer y aplicar el skill file asignado a cada tarea
- QA y Reviewer verificaran que system/evidence/{task_id}.json existe con cambios reales
- Sin evidence de cambios = qa:fail y review:fail automaticos
- NO hay forma de saltarse esta verificacion

1) Ejecuta:
node runner.js start "{GOAL}"

2) Lee la salida del runner y ejecuta la accion requerida:
- Planner -> genera `system/plan.md` y `system/tasks.md`
- Executor -> LEE el skill file, hace cambios REALES en el proyecto, agrega `executor:done`
- QA -> verifica `system/evidence/{task_id}.json`, inspecciona archivos, agrega `qa:pass` o `qa:fail`
- Reviewer -> lee skill file + evidence, verifica compliance, agrega `review:pass(score=X)` o `review:fail(score=X)`
- Memory -> agrega entrada con `task_id` y archivos cambiados en `system/memory.md`

3) Despues de cada accion, ejecuta:
node runner.js next

4) Repite hasta:
- `phase=complete`, o
- `halted=true`

5) Al final muestra:
- `node runner.js status`
- `system/runs/<run_id>/summary.md`
```

## Placeholder examples

- `{PROJECT_PATH}`: `E:\\Carlos\\Development Tools\\Proyectos\\Ehdu`
- `{GOAL}`: `Execute plans/premium-upgrade-plan.md for EHDU in phases, preserving design and optimizing performance.`

## IMPORTANT: Configure project_root

Before running, set the project root in `system/config.json`:

```json
{
  "evidence": {
    "project_root": "E:\\Carlos\\Development Tools\\Proyectos\\Ehdu"
  }
}
```

This enables the file-hash verification system that prevents fake completions.
