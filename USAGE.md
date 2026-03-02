# Guia Operativa (Terminal + Chat Kilo.ai)

Este sistema NO ejecuta Planner/Executor/QA/Reviewer por si solo.
El runner solo orquesta estado y te dice que agente ejecutar.

Tu trabajo siempre alterna entre:
1. Terminal
2. Chat de Kilo.ai

---

## Flujo Correcto

`init -> planner -> executor -> qa -> reviewer -> memory -> repeat`

- `init` y control de estado: Terminal
- `planner/executor/qa/reviewer/memory`: Chat de Kilo.ai

### Modo Chat-Only (recomendado)

Si quieres usar TODO desde el chat (sin cambiar manualmente entre terminal/chat), pide a Kilo.ai que ejecute comandos y edite archivos en bucle.

Prompt recomendado:

```text
Trabaja en E:\\Carlos\\Development Tools\\Proyectos\\Ehdu\\.agents.
1) Ejecuta: node runner.js start "Execute plans/premium-upgrade-plan.md for EHDU in phases, preserving design and optimizing performance."
2) Lee la salida del runner y ejecuta la accion requerida (Planner/Executor/QA/Reviewer/Memory).
3) Despues de cada accion, ejecuta: node runner.js next
4) Repite hasta phase=complete o halted=true.
5) Al final muestra resumen con:
   - node runner.js status
   - system/runs/<run_id>/summary.md
```

---

## Requisitos Previos

1. Copia la carpeta del sistema en tu proyecto (por ejemplo `.agents`).
2. Entra a esa carpeta antes de ejecutar comandos.
3. Asegura que exista `system/` con `goal.md`, `state.json`, `plan.md`, `tasks.md`, `memory.md`.

Ejemplo:

```bash
cd "E:\Carlos\Development Tools\Proyectos\Ehdu\.agents"
```

---

## Paso a Paso (Obligatorio)

## Paso 1: Inicializar run

En Terminal:

```bash
node scripts/init-project.js "Tu objetivo del proyecto"
```

Alternativa directa (init + primera accion en un comando):

```bash
node runner.js start "Tu objetivo del proyecto"
```

Ejemplo:

```bash
node scripts/init-project.js "Execute plans/premium-upgrade-plan.md for EHDU in phases, preserving design and optimizing performance."
```

Resultado esperado:
- Se actualiza `system/goal.md`
- Se resetean `system/plan.md` y `system/tasks.md`
- Se crea nuevo `run_id` en `system/state.json`

---

## Paso 2: Ver estado

En Terminal:

```bash
node runner.js status
```

Debes ver:
- `phase: planning`
- `awaiting_agent: planner`

---

## Paso 3: Pedir siguiente accion

En Terminal:

```bash
node runner.js next
```

El runner te dira algo como:
- `[ACTION] ... Planner Agent ...`

Aqui TERMINA el trabajo del terminal por ahora.

---

## Paso 4: Ejecutar Planner en Chat Kilo.ai

En chat Kilo.ai (no en terminal), pide:

```text
Actua como Planner Agent.
Lee:
- system/goal.md
- (si aplica) plans/premium-upgrade-plan.md del proyecto

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

Importante:
- Si `tasks.md` no cumple schema, el runner hace HALT.

---

## Paso 5: Volver a Terminal

En Terminal:

```bash
node runner.js next
```

Ahora el runner debe pedir Executor para una tarea.

---

## Paso 6: Ejecutar Executor en Chat Kilo.ai

En chat Kilo.ai:

```text
Actua como Executor Agent.
Lee system/tasks.md y toma la tarea pending indicada por el runner.
Ejecuta la tarea con su skill asignado.
Actualiza esa fila en tasks.md:
- estado: running (o done si tu flujo interno lo requiere)
- resultado: agrega token executor:done

No cierres la tarea todavia.
```

---

## Paso 7: Volver a Terminal y pedir QA

En Terminal:

```bash
node runner.js next
```

Si ve `executor:done`, te pedira QA.

---

## Paso 8: Ejecutar QA en Chat Kilo.ai

En chat Kilo.ai:

```text
Actua como QA Agent para la tarea actual.
Valida output y actualiza tasks.md en resultado:
- qa:pass  (si pasa)
- qa:fail  (si falla)
```

---

## Paso 9: Volver a Terminal y pedir Reviewer

En Terminal:

```bash
node runner.js next
```

Si ve `qa:pass`, te pedira Reviewer.

---

## Paso 10: Ejecutar Reviewer en Chat Kilo.ai

En chat Kilo.ai:

```text
Actua como Reviewer Agent para la tarea actual.
Evalua y actualiza tasks.md en resultado:
- review:pass(score=X)
- review:fail(score=X)
```

---

## Paso 11: Memory (cierre de tarea)

En Terminal:

```bash
node runner.js next
```

Si ve `review:pass`, te pedira escribir memory.

En chat Kilo.ai agrega en `system/memory.md` una entrada que incluya el `task_id`.

Ejemplo:

```markdown
### T001 2026-03-02 - reviewer
**Decision:** ...
**Razon:** ...
**Alternativas descartadas:** ...
**Impacto en tareas futuras:** ...
```

Luego vuelve a Terminal:

```bash
node runner.js next
```

El runner cerrara la tarea como `done` y seguira con la siguiente.

---

## Paso 12: Repetir ciclo

Repite pasos 6 a 11 hasta completar todas las tareas.

Cuando termine:
- `phase: complete`
- Se genera `system/runs/<run_id>/summary.md`

---

## Comandos de Control

```bash
node runner.js init "objetivo"   # Inicializa run limpio
node runner.js start "objetivo"  # Init + ejecuta primer next
node runner.js status              # Estado actual
node runner.js next                # Ejecuta solo 1 paso
node runner.js "objetivo"         # Run completo (seguira pidiendo acciones)
node scripts/smoke-runner.js       # Smoke tests del sistema
```

---

## Troubleshooting Rapido

## Error: "Cannot find module scripts/init-project.js"
- Estas en el directorio equivocado.
- Entra a `.agents` y ejecuta ahi.

## Error: "require is not defined in ES module scope"
- Falta `package.json` dentro de `.agents` con `"type": "commonjs"`.

## HALT: invalid_tasks_schema
- Corrige `system/tasks.md`:
  - columnas: `id|skill|estado|resultado`
  - IDs validos `T001...`
  - estados validos
  - sin duplicados
  - dependencias validas si existen

## No avanza a siguiente agente
- Revisa tokens en `resultado` de la tarea:
  - `executor:done`
  - `qa:pass` o `qa:fail`
  - `review:pass(score=X)` o `review:fail(score=X)`

---

## Regla de Oro

Si el runner dice `[ACTION]`, esa accion se ejecuta en el chat de Kilo.ai.
Despues siempre vuelves a Terminal y corres `node runner.js next`.
