# Chat Prompt Template (Kilo.ai)

Copy this block, replace placeholders, and send it in Kilo.ai chat.

```text
Trabaja en {PROJECT_PATH}\\.agents.

1) Ejecuta:
node runner.js start "{GOAL}"

2) Lee la salida del runner y ejecuta la accion requerida editando archivos en `.agents/system`:
- Planner -> genera `system/plan.md` y `system/tasks.md`
- Executor -> agrega `executor:done` en `resultado`
- QA -> agrega `qa:pass` o `qa:fail`
- Reviewer -> agrega `review:pass(score=X)` o `review:fail(score=X)`
- Memory -> agrega entrada con `task_id` en `system/memory.md`

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
