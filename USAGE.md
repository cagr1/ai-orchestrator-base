# Guia de Uso del Sistema de Agentes

Esta guia te ensena a usar el sistema de agentes para cualquier tipo de proyecto: landing pages, APIs, bases de datos, e-commerce, dashboards, etc.

---

##  Inicio Rapido

### Paso 0: Preparar el Proyecto

Asegurate de tener la estructura:
```
tu-proyecto/
 .ai/                    # o la carpeta donde esta el sistema
    agents/
    skills/
    system/
    runner.js
 src/                    # aqui se generara el codigo
```

### Paso 1: Iniciar el Runner

**En la terminal de VSCode:**
```bash
cd .ai
node runner.js "DESCRIPCION DE TU PROYECTO"
```

**Ejemplos de goals:**
```bash
# Landing page
node runner.js "Landing page para restaurante italiano, diseno elegante, menu, reservas, ubicacion"

# API
node runner.js "API REST para e-commerce con auth JWT, productos, carrito, ordenes de compra"

# Base de datos
node runner.js "Esquema de base de datos para app de citas medicas con pacientes, doctores, citas"

# Fullstack
node runner.js "Dashboard admin con React y Node.js, autenticacion, graficos, CRUD de usuarios"
```

El runner creara o actualizara:
- `system/goal.md` - Tu objetivo
- `system/state.json` - Estado del sistema

---

##  Flujo de Trabajo

El runner te dira que agente ejecutar. Alternaras entre:
1. **Terminal** - Ejecutar `node runner.js`
2. **Chat de Kilo.ai** - Ejecutar el agente indicado

---

##  Agente 1: Planner

**Cuando:** El runner muestra `" Activating Planner Agent..."`

**Prompt para el chat:**
```
Actua como el Planner Agent. 

Lee system/goal.md y genera:
1. system/plan.md - Plan estructurado en fases
2. system/tasks.md - Lista de tareas con variables dinamicas

Usa las plantillas con variables {{run_id}}, {{task_id}}, etc.
El tipo de proyecto es: [landing/api/database/fullstack]
```

**Resultado:** Kilo genera `plan.md` y `tasks.md`

---

##  Agente 2: Executor

**Cuando:** El runner muestra `" Activating Executor Agent for T01..."`

**Prompt para el chat:**
```
Actua como el Executor Agent.

Lee system/tasks.md y encuentra la tarea con estado "pending" (ej: T01).

Tarea actual: {{task_id}}
Skill asignado: {{skill_name}}

1. Lee system/memory.md para respetar decisiones previas
2. Carga el skill desde skills/[categoria]/[skill].md
3. Ejecuta la tarea siguiendo los patrones del skill
4. Genera codigo/archivos en la carpeta del proyecto
5. Actualiza system/tasks.md - en la columna resultado agrega: executor:done
6. Deja estado en `running` y listo para QA (NO cerrar la tarea aqui)

Output esperado:
## Tarea {{task_id}}
**Status:** completed
**Archivos:** [lista]
**Decisiones:** [que decidiste]
**Pendiente:** [si algo quedo pendiente]
**Listo para QA:** si
```

**Resultado:** Codigo creado + token `executor:done` en tasks.md

---

##  Agente 3: QA

**Cuando:** El runner muestra `" Activating QA Agent..."` (despues de Executor)

**Prompt para el chat:**
```
Actua como el QA Agent.

Valida el output del Executor para la tarea {{task_id}}:

1. Revisa el codigo/archivos generados
2. Aplica los checks especificos del skill usado:
   - Frontend: TypeScript sin errores, sin console.log, props tipadas
   - Backend: Error handling, no secrets, validacion de inputs
   - Database: Migrations reversibles, indices, no N+1
3. Si hay issues criticos  FAIL
4. Si todo OK  PASS

Genera QA Report:
## QA Report  Tarea {{task_id}}
**Resultado:** PASS | FAIL
**Score:** X/10
**Issues criticos:** [lista o "ninguno"]
**Warnings:** [lista o "ninguno"]
**Comando de verificacion:** [ej: npm test]
```

**Si es PASS:** Agrega `qa:pass` en `resultado` y el runner continua a Reviewer  
**Si es FAIL:** Agrega `qa:fail` en `resultado` y vuelve a Executor

---

##  Agente 4: Reviewer

**Cuando:** El runner muestra `" Activating Reviewer Agent..."` (despues de QA PASS)

**Prompt para el chat:**
```
Actua como el Reviewer Agent.

Evalua la calidad de la tarea {{task_id}} despues de QA PASS:

Inputs:
- Output del Executor
- QA Report
- system/goal.md (para alignment)
- system/memory.md (para consistencia)

Criterios de evaluacion (score 1-10):
- Funcionalidad (30%): Hace lo que pedia la tarea?
- Calidad de codigo (20%): Sigue patrones del skill?
- Consistencia (20%): Respeta decisiones en memory?
- Testabilidad (15%): Es verificable?
- Alignment con goal (15%): Contribuye al objetivo?

Genera Review:
## Review  Tarea {{task_id}}
**Score:** X/10
**Resultado:** PASS | FAIL | PASS_WITH_NOTES
**Detalle por criterio:**
- Funcionalidad: X/10  [nota]
- Calidad: X/10  [nota]
- Consistencia: X/10  [nota]
- Testabilidad: X/10  [nota]
- Alignment: X/10  [nota]
**Notas para memory.md:** [decisiones importantes]
**Recomendacion para siguiente tarea:** [si aplica]
```

**Score >= 7:** Agrega `review:pass(score=X)` en `resultado`; luego el runner pide escribir memory  
**Score < 7:** Agrega `review:fail(score=X)` en `resultado` y vuelve a Executor

---

##  Memory (Automatico)

Despues de `review:pass`, el runner exige escribir la entrada de la tarea en `system/memory.md` para cerrar la tarea como `done`:

```markdown
### T01 2025-06-10  executor
**Decision:** Usar Vite 5 con SWC
**Razon:** Build 3x mas rapido
**Alternativas descartadas:** CRA, Next.js
**Impacto en tareas futuras:** T02 debe usar eslint-plugin-react compatible
```

---

##  Ejemplos por Tipo de Proyecto

### Landing Page
```bash
node runner.js "Landing page para cafeteria artesanal, hero con imagen de cafe, seccion menu, galeria, contacto con mapa, responsive"
```
**Skills tipicos:** `frontend-react-hooks`, `frontend-animations`, `ux`

### API REST
```bash
node runner.js "API REST para reservas de hotel: auth, habitaciones, reservas, pagos, admin dashboard"
```
**Skills tipicos:** `backend-node-api`, `backend-laravel-api`, `database-postgres-schema`

### Base de Datos
```bash
node runner.js "Esquema PostgreSQL para plataforma de cursos online: usuarios, cursos, inscripciones, pagos, certificados"
```
**Skills tipicos:** `database-postgres-schema`, `database-migrations-dotnet-prisma`

### E-commerce
```bash
node runner.js "Tienda online fullstack: catalogo de productos, carrito, checkout con Stripe, panel admin, inventario"
```
**Skills tipicos:** `frontend-react-hooks`, `backend-node-api`, `database-postgres-schema`, `devops-docker`

---

##  Estados del Sistema

### HALT (Detencion)
El sistema se detiene si:
- Se alcanza `max_iterations` (default: 20)
- Hay un fallo critico en fase setup y `halt_on_failure: true`
- Una tarea falla y es critica

**Para reanudar:**
1. Corrige el problema
2. Edita `system/state.json`: cambia `"halted": false`, `"halt_reason": null`
3. Vuelve a ejecutar `node runner.js`

### Complete
Cuando todas las tareas estan DONE:
- El runner muestra: `" PROJECT COMPLETED SUCCESSFULLY!"`
- Revisa `system/memory.md` para decisiones tecnicas
- Revisa las metricas en `system/state.json`

---

##  Tips

1. **Se especifico en el goal:** Cuanto mas detalle, mejor el plan
2. **Revisa memory.md:** Contiene decisiones importantes que afectan todo el proyecto
3. **Itera rapido:** Si algo falla, corrige y vuelve a ejecutar el runner
4. **Manten el contexto:** No borres archivos de `system/` durante el proyecto
5. **Personaliza skills:** Si necesitas un patron especifico, edita el skill correspondiente

---

##  Troubleshooting

**"No tasks found"**
- El Planner no genero tareas. Vuelve a ejecutar el Planner Agent.

**"Phase stuck in planning"**
- El Planner no actualizo el estado. Edita `state.json`: `"phase": "execution"`

**Tarea falla repetidamente**
- Revisa el QA Report para issues criticos
- Actualiza el skill si el patron no es adecuado
- Considera dividir la tarea en subtareas mas pequenas

---

##  Referencias

- [`agents/planner.md`](agents/planner.md) - Genera plan y tareas
- [`agents/executor.md`](agents/executor.md) - Ejecuta tareas con skills
- [`agents/qa.md`](agents/qa.md) - Valida calidad
- [`agents/reviewer.md`](agents/reviewer.md) - Evalua y decide
- [`agents/orchestrator.md`](agents/orchestrator.md) - Flujo del sistema
- [`system/config.json`](system/config.json) - Skills disponibles
- [`runner.js`](runner.js) - Orquestador del flujo



