# Guía Operativa v3.0 - Uso del Sistema

Sistema de orquestación determinística y paralela para agentes de IA. Gestiona el flujo de trabajo en **rondas de ejecución** con protección contra fatiga de LLM.

---

## 🆕 Novedades v3.0

- **Ejecución por rondas**: `node runner.js run` ejecuta hasta 5 tareas y detiene
- **Batches paralelos**: Hasta 3 tareas simultáneas seleccionadas por prioridad
- **Formato YAML**: `tasks.yaml` reemplaza `tasks.md` con campos input/output
- **Protección anti-hallucination**: R10 valida evidencia vs archivos permitidos
- **Recuperación de fallos**: TTL de 30 minutos en el Run Lock
- **30+ tests**: Validación completa sin frameworks pesados

---

## 📋 Comandos CLI

### `init` - Inicializar Proyecto

```bash
node runner.js init "Crear API REST con autenticación JWT"
```

**Crea:**
- `system/goal.md` - Objetivo del proyecto (inmutable)
- `system/state.json` - Estado inicial (fase: planning)
- `system/tasks.yaml` - Plantilla de tareas vacía
- `system/memory.md` - Log de decisiones

**Salida esperada:**
```
[INIT] New run initialized: crear-api-rest-con-autenticacion-jwt-20240303
[INIT] Phase: planning
[INIT] Tasks template created

[END] Run: node runner.js run
```

---

### `run` - Ejecutar Ronda

```bash
node runner.js run
```

**Flujo interno:**
1. Valida Lock TTL (limpia si está obsoleto)
2. Adquiere Run Lock
3. Resetea contadores (`tasks_completed`, `consecutive_failures`)
4. Recalcula estados de tareas desde dependencias
5. Selecciona batch paralelo (hasta 3 tareas)
6. Muestra batch al humano para ejecución
7. Libera Lock

**Salida esperada:**
```
[RUN] Starting execution...
[STATE] Phase: execution
[STATE] Iteration: 0/50

🟢 BATCH PARALELO - Puedes ejecutar estas tareas en cualquier orden:
  - T1: Setup base de datos
    Input: docs/schema.md
    Output: src/database/, migrations/
  - T2: Crear modelo User
    Input: src/database/
    Output: src/models/User.js
```

---

### `resume` - Reanudar Ejecución

```bash
node runner.js resume
```

**Usar cuando:**
- Estado es `paused` (se alcanzó `max_tasks_per_run`)
- Se quiere continuar después de un `run` anterior

**Resetea:**
- `execution_control.tasks_completed = 0`
- `execution_control.consecutive_failures = 0`
- `status = "running"`

---

### `status` - Ver Estado

```bash
node runner.js status
```

**Salida:**
```
[STATUS] Current run state
- run_id: crear-api-rest-con-autenticacion-jwt-20240303
- version: 3.0
- phase: execution
- iteration: 5/50
- status: running
- halt_reason: -
- lock: ACTIVE / inactive
- tasks_completed: 3/5
- consecutive_failures: 0
```

---

### `context` - Refrescar Snapshot

```bash
node runner.js context
```

Genera/actualiza `system/context.md` con un resumen corto del estado (goal, tareas pendientes top y memoria reciente) para evitar re-leer todo el proyecto en cada paso.

---

## 📊 Dashboard y Auditoría

- `system/status.md`: resumen de progreso, riesgos y salud de dependencias.
- `system/events.log`: bitácora de eventos (init, run, done, fail, verify).
- `system/runs/<run_id>/history.log`: historial resumido por ejecución (gitignore).

## 🔒 Concurrencia

`tasks.yaml` usa lock optimista: si cambia entre lectura y guardado, el runner detiene la operación para evitar conflictos.

### `review` - Modo Revisión

```bash
node runner.js review
```

**Usar cuando:**
- Estado es `needs_review` (cooldown activado o error crítico)
- Se necesita intervención manual

---

### `plan` - Crear Solicitud de Planner

```bash
node runner.js plan "Nueva solicitud o cambio de foco"
```

Genera `system/plan_request.md` con goal + contexto compacto + tareas pendientes. Esto evita releer todo el repo; el Planner/LLM solo necesita este archivo para proponer `system/plan.md` y `system/tasks.yaml`.

---

### `validate` - Validar Planificacion

```bash
node runner.js validate
```

Valida `system/tasks.yaml` contra `system/config.json` (skills permitidas, R9 y dependencias).

---

### `done` - Marcar Tarea como Done

```bash
node runner.js done T1
```

Marca la tarea como `done` y, si la evidencia es requerida, intenta generar `system/evidence/T1.json` a partir de `git diff --name-only` (o usando archivos pasados como argumentos).

---

### `fail` - Marcar Tarea como Failed

```bash
node runner.js fail T1 "motivo"
```

Incrementa intentos y bloquea dependientes si se agotan los reintentos.

---

### `retry` - Reintentar Tarea

```bash
node runner.js retry T1
```

Mueve la tarea a `pending` si no es `failed_permanent`.

---

### `evidence` - Crear Evidencia

```bash
node runner.js evidence T1 src/file.js
```

Escribe `system/evidence/T1.json` con archivos cambiados. Si no pasas archivos, usa `git diff --name-only`.

---

### `verify` - Validar Evidencias

```bash
node runner.js verify
```

Verifica evidencia para todas las tareas `done` (R10 y criterios de aceptacion si se requieren).

---

## 🔄 Flujo de Trabajo Completo

### Fase 1: Planning (Primera vez)

```bash
# 1. Inicializar proyecto
node runner.js init "Descripción del proyecto"

# 2. Ver estado
node runner.js status
# Phase: planning
```

En este punto, el **Planner Agent** debe:
1. Leer `system/goal.md`
2. Generar `system/tasks.yaml` con tareas iniciales
3. Cada tarea debe tener `input` y `output` definidos

```yaml
# system/tasks.yaml
version: "3.0"
generated_at: "2024-03-03T10:00:00Z"
run_id: "mi-proyecto-20240303"

tasks:
  - id: "T1"
    title: "Setup proyecto"
    description: "Inicializar estructura base"
    skill: "devops/docker"
    estado: "pending"
    priority: 1
    depends_on: []
    input: []
    output: ["docker-compose.yml", "Dockerfile"]
    attempts: 0
    max_attempts: 3
```

Cambiar fase a `execution` en `system/state.json` cuando el planner termine.

---

### Fase 2: Execution (Bucles de Run)

```bash
# Ejecutar ronda (máximo 5 tareas)
node runner.js run

# Ver batch sugerido y ejecutar tareas manualmente
# Marcar tareas como done en tasks.yaml

# Repetir hasta que status = paused
node runner.js run

# Cuando status = paused, resumir
node runner.js resume
```

**Ciclo típico:**
```
run → ejecutar tareas del batch → run → paused → resume → run → ... → completed
```

---

### Fase 3: Completado

Cuando todas las tareas estén en estado `done`:

```bash
node runner.js status
# status: completed
# halt_reason: all_tasks_completed
```

---

## 📊 Formatos de Archivo

### system/state.json

```json
{
  "version": "3.0",
  "run_id": "mi-proyecto-20240303",
  "phase": "execution",
  "iteration": 5,
  "max_iterations": 50,
  "status": "running",
  "execution_control": {
    "tasks_completed": 3,
    "max_tasks_per_run": 5,
    "last_checkpoint": 0,
    "checkpoint_interval": 5,
    "cooldown_trigger": false,
    "consecutive_failures": 0
  },
  "parallel_batch": {
    "max_batch_size": 3
  },
  "lock": {
    "active": false,
    "locked_at": null,
    "locked_by": null,
    "ttl_seconds": 1800
  },
  "last_updated": "2024-03-03T12:00:00Z",
  "halt_reason": null
}
```

---

### system/tasks.yaml

```yaml
version: "3.0"
generated_at: "2024-03-03T10:00:00Z"
run_id: "mi-proyecto-20240303"

tasks:
  - id: "T1"
    title: "Setup base de datos"
    description: "Crear esquema PostgreSQL"
    skill: "database/postgres-schema"
    estado: "done"              # pending | running | done | failed | blocked
    priority: 1                 # 1 = alta, 3 = baja
    depends_on: []              # IDs de dependencias
    created_at: "2024-03-03T10:00:00Z"
    updated_at: "2024-03-03T11:00:00Z"
    attempts: 1
    max_attempts: 3
    input:
      - "docs/schema.md"
    output:
      - "src/database/"
      - "migrations/"

metadata:
  total_tasks: 5
  completed: 2
  pending: 2
  failed: 0
  blocked: 1
```

---

### system/evidence/{task_id}.json

```json
{
  "task_id": "T1",
  "executed_at": "2024-03-03T11:00:00Z",
  "files_changed": [
    "src/database/schema.sql",
    "migrations/001_initial.sql"
  ],
  "summary": "Creado esquema PostgreSQL con tablas users y auth"
}
```

---

### system/config.json

El runner lee `system/config.json` en cada `run/resume`. Puedes definir `limits` para ajustar topes de ejecucion y `evidence` para enforcement (el repo puede incluir otros campos adicionales para selector de skills).

```json
{
  "version": "3.0",
  "limits": {
    "max_tasks_per_run": 5,
    "max_iterations": 50,
    "checkpoint_interval": 5,
    "max_batch_size": 3,
    "cooldown_threshold": 3
  },
  "context": {
    "max_memory_entries": 20,
    "compaction_enabled": true,
    "max_lines": 120,
    "working_set_limit": 10
  },
  "evidence": {
    "required": true,
    "min_files_changed": 1,
    "excluded_paths": ["system/", ".agents/", "node_modules/", ".git/"]
  },
  "tasks": {
    "id_pattern": "^T\\d+(_fix)?$"
  },
  "retention": {
    "events_max_lines": 2000,
    "evidence_max_days": 30
  },
  "redaction": {
    "enabled": true
  }
}
```

---

## 🛡️ Reglas de Seguridad

### R9: Límite de Tamaño de Tarea

Toda tarea debe satisfacer:
- ⏱️ **Tiempo**: < 15 minutos ejecución humana
- 📁 **Archivos**: Modifica < 10 archivos  
- 🎯 **Objetivo**: Meta única y enfocada

**Validación automática:** El runner rechaza tareas que violen R9.

---

### R10: Sin Tareas Implícitas (Anti-Hallucination)

**El Executor SOLO puede:**
- Crear archivos listados en `task.output`
- Modificar archivos listados en `task.output`

**Prohibido:**
- Crear archivos fuera de `task.output`
- Modificar archivos no listados
- Agregar tareas nuevas a tasks.yaml

**Validación:** La evidencia se valida contra `task.output` para reducir cambios implícitos/no autorizados.

---

### R11: Protección del Planner (Anti-Destrucción)

**El Planner solo puede ejecutar si:**
- `tasks.yaml` no existe, O
- `state.phase === "planning"`

**Prevención:** Evita regeneración accidental que destruye semanas de trabajo.

---

## ⚠️ Estados de Parada

| Estado | Causa | Solución |
|--------|-------|----------|
| `paused` | `max_tasks_per_run` alcanzado | `node runner.js resume` |
| `needs_review` | 3 fallos consecutivos (cooldown) | `node runner.js review` |
| `needs_review` | Tarea crítica falló | Revisar manualmente y fix |
| `completed` | Todas las tareas done | ¡Proyecto terminado! |

---

## 🧪 Testing

```bash
# Ejecutar todos los tests
npm test

# Salida esperada:
# === Running All Tests ===
# ...
# === ALL TESTS PASSED ===
```

**Tests incluidos:**
- Phase 1: State Schema
- Phase 4: Batch Selection (paralelo, determinístico)
- Phase 10: Recalculation Rule
- Phase 11-14: Validaciones (R9, completion, deps, R10)
- Phase 15-17: Features finales (TTL, determinismo, R11)
- Phase 18: Simulaciones (workflows completos)

---

## 🔄 Ejemplo Completo

```bash
# 1. Inicializar
node runner.js init "Crear blog con Next.js y PostgreSQL"

# 2. Planner genera tasks.yaml (manual o via Kilo.ai)
#    - Editar system/tasks.yaml
#    - Cambiar state.phase a "execution"

# 3. Ejecutar rondas
node runner.js run
# Output: Batch con T1, T2, T3
# Ejecutar tareas manualmente, marcar como done

node runner.js run
# Output: Batch con T4, T5
# Ejecutar tareas manualmente, marcar como done
# Status: paused (5/5 tareas)

node runner.js resume
node runner.js run
# ... repetir hasta completar

# 4. Verificar completitud
node runner.js status
# status: completed
```

---

## 📚 Documentación Relacionada

- [`README.md`](README.md) - Visión general del sistema
- [`plans/v3-deterministic-parallel-orchestrator-plan.md`](plans/v3-deterministic-parallel-orchestrator-plan.md) - Plan de implementación
- [`agents/planner.md`](agents/planner.md) - Definición del Planner
- [`agents/checkpoint.md`](agents/checkpoint.md) - Definición del Checkpoint Agent

---

**Versión:** 3.0 - Deterministic Parallel Orchestrator  
**Última actualización:** 2024-03-03
