OrchestOS v1 — Definición Cerrada del Sistema
1. Tesis del Producto
OrchestOS es un motor de ejecución de software dirigido por intención.

Resuelve un problema específico: la brecha entre lo que un desarrollador quiere construir (expresado en lenguaje natural ambiguo) y la ejecución ordenada, verificable y controlada de ese objetivo.

No es un chatbot. No responde preguntas.
No es un IDE. No edita código directamente.
No es un generador de código. No produce output de forma libre.

Es una estación de control que:

Recibe una intención general
La descompone en un plan ejecutable con tareas, dependencias, skills y criterios
Ejecuta ese plan de forma controlada, en lotes, con validación y memoria
Permite supervisar, pausar, corregir y retomar sin perder estado
Para quién sirve: Un desarrollador que trabaja solo o con equipo pequeño y necesita construir software real (APIs, frontends, sistemas completos) con asistencia de LLMs, sin que el LLM se desvíe, repita contexto inútilmente o rompa lo que ya existe.

En qué casos sí sirve:

Proyecto nuevo desde cero: landing page, API REST, sistema SaaS básico
Proyecto existente donde se agrega un módulo nuevo sin tocar el código que ya funciona
Tareas paralelas que no se bloquean entre sí (el sistema las ejecuta en batch)
Proyectos donde el scope es claro aunque la intención inicial sea ambigua
En qué casos no sirve (todavía):

Proyectos con requerimientos que cambian durante la ejecución (el sistema necesita plan estable)
Coordinación de agentes humanos (es un orquestador de LLMs, no de personas)
Dominos completamente desconocidos donde no hay skills disponibles
Debugging de sistemas en producción con estado externo complejo
2. Borde de OrchestOS v1
Qué entra en v1
Área	Qué incluye
Intake	Campo de texto libre para el goal del usuario
Planning	Descomposición automática en tareas con skills, dependencias, prioridades
Execution	Ejecución de tareas por batch (máx 3 en paralelo), con validación R9/R10/R11
Memory	Persistencia de decisiones (archivo), búsqueda básica, compactación
Verification	Evidence system (archivos modificados), detección de ciclos, validación de schema
Supervision	Dashboard para observar estado: pausa, reanuda, estado de tareas
Skills	50+ skills de dominio (frontend, backend, DB, DevOps)
Models	OpenRouter con routing por skill (free/low-cost/heavy)
Recovery	Lock con TTL, tareas correctivas automáticas, cooldown ante fallos consecutivos
Project support	Proyecto nuevo y proyecto existente (sin romper lo que existe)
Qué queda fuera de v1
Feature	Razón
Coordinación multi-usuario	Complejidad innecesaria para el caso de uso principal
Integración con Linear/Jira	Derivable por skill externa; no core
Deployment automático a producción	Fuera del scope de construcción de software
Feedback loop con testing automatizado del output real	Deseable pero es v2
Interfaz visual de edición de tasks (drag & drop real)	El kanban actual es observación, no edición interactiva
Multi-workspace / multi-proyecto simultáneo	Un proyecto a la vez en v1
Qué se pospone
Engram como dependencia real (hoy es opcional, en v1 debe mantenerse así)
Autoskills como feature crítica (es útil but no es el camino principal)
Multi-proveedor (OpenRouter es suficiente para v1)
Skills de dominio nuevas (las 50+ existentes son suficientes para los casos de uso core)
Qué se elimina definitivamente
Autoskills como paso obligatorio en el flujo (debe ser opcional/asistente)
La referencia a "Hyperscript" y HTMX como tech del dashboard — deben ser reemplazados por el stack que ya está funcionando (HTML5 puro + EventSource + Socket.io)
Cualquier lógica que asuma que el usuario es también el ejecutor LLM (el flujo debe funcionar con LLM externo directo vía API, no como "el usuario juega el rol del planner")
3. Mapa de Módulos del Sistema

┌─────────────────────────────────────────────────────────────────┐
│                         OrchestOS v1                            │
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌───────────────────┐  │
│  │   INTAKE     │───▶│   PLANNER    │───▶│    EXECUTOR       │  │
│  │              │    │              │    │                   │  │
│  │ goal.md      │    │ auto-planner │    │ runner.js         │  │
│  │ (texto libre)│    │ agents/      │    │ batch selection   │  │
│  │              │    │ planner.md   │    │ R9/R10/R11        │  │
│  └──────────────┘    └──────┬───────┘    └────────┬──────────┘  │
│                             │ tasks.yaml           │ evidence    │
│                             ▼                      ▼             │
│  ┌──────────────┐    ┌──────────────┐    ┌───────────────────┐  │
│  │   MEMORY     │◀──▶│  SUPERVISOR  │◀───│   VERIFIER        │  │
│  │              │    │              │    │                   │  │
│  │ memory.md    │    │ state.json   │    │ evidence/*.json   │  │
│  │ engram (opt) │    │ dashboard    │    │ dep graph         │  │
│  │ compaction   │    │ pause/resume │    │ cycle detection   │  │
│  └──────────────┘    └──────┬───────┘    └───────────────────┘  │
│                             │                                    │
│  ┌──────────────┐    ┌──────▼───────┐                           │
│  │   SKILLS     │───▶│   MODELS     │                           │
│  │              │    │              │                           │
│  │ 50+ .md files│    │ OpenRouter   │                           │
│  │ skill_index  │    │ model_mapping│                           │
│  │ categorizados│    │ cost tracker │                           │
│  └──────────────┘    └──────────────┘                           │
└─────────────────────────────────────────────────────────────────┘
Seis módulos canónicos. Todos existen hoy. Ninguno sobra.

4. Qué se Mantiene
Estas piezas están bien construidas y cumplen su función. No se tocan.

Módulo	Estado	Por qué se mantiene
runner.js — batch selection determinista	Estable, 100% tests	Core del sistema. Es la pieza más crítica.
system/tasks.yaml como source of truth	Correcto	Único punto de verdad para el estado de tareas
Lock con TTL	Correcto	Previene corrupción de estado en ejecuciones concurrentes
Evidence system (R10)	Correcto	Previene que el LLM modifique archivos no declarados
Validaciones R9, R10, R11	Correcto	Es lo que da confiabilidad al sistema
memory-manager.js con fallback a archivo	Correcto	Engram opcional, archivo siempre disponible
auto-planner.js — tier detection + task generation	Funcional	Es el puente entre intención y plan
agents/planner.md y agents/executor.md	Correctos	Templates probados para guiar al LLM
Skills system (50+ skills categorizados)	Correcto	Es el conocimiento de dominio del sistema
Model routing por skill (config.json)	Correcto	Optimización de costo real
Cost tracking + budget enforcement	Correcto	Previene sorpresas económicas
Tests — 14 suites	Correcto	Son la guardia de regresión del sistema
Corrective tasks automáticas	Correcto	Recovery sin intervención manual
5. Qué se Corrige
Partes existentes que fallan en su propósito o están mal conectadas.

5.1 El dashboard no refleja el flujo real del sistema
Problema actual: El dashboard tiene tabs de "Prompt | Tasks | Memory | Skills | Stats". Eso es una lista de recursos, no un flujo de trabajo. Un usuario nuevo no sabe qué hacer primero.

Corrección: El dashboard debe guiar el flujo en orden:


1. Escribe tu objetivo (Intake)
2. Genera el plan (Planning)
3. Ejecuta (Execution)
4. Observa (Monitoring)
Las tabs de Skills, Memory y Stats no desaparecen, pero no son el punto de entrada.

5.2 El campo de texto del objetivo es demasiado pequeño
Problema actual: La textarea del prompt no comunica que ahí se escribe la intención completa del proyecto. Parece un input de chat.

Corrección: El área de intake debe ser el protagonista visual de la pantalla principal. Debe tener placeholder con ejemplos reales, y el botón principal debe llamarse algo como "Planificar" o "Analizar objetivo", no "Generate Tasks".

5.3 El output del ejecutor (terminal) está en la tab de Prompt
Problema actual: El output de ejecución vive en la misma pantalla donde se escribe el objetivo. Eso mezcla intake con monitoring.

Corrección: El terminal de ejecución debe estar en la sección de Execution/Monitoring, no en Prompt.

5.4 El flujo manual de planning no está claro
Problema actual: El sistema genera tareas vía auto-planner.js, pero también depende de que el usuario "actúe como planner" usando agents/planner.md. Esto es ambiguo. ¿El LLM planifica solo o el usuario tiene que copiar/pegar el prompt?

Corrección: En v1, el flujo debe ser:

Usuario escribe el goal
Sistema llama auto-planner.js automáticamente vía API
auto-planner.js llama al LLM con agents/planner.md como system prompt
Resultado: tasks.yaml generado sin intervención manual
Este flujo ya existe pero no está conectado de extremo a extremo en el dashboard. Hay que cerrar ese loop.

5.5 La configuración de modelos está hardcodeada y no es visible desde el dashboard
Problema actual: El model_mapping está en system/config.json pero no hay forma de verlo o editarlo desde el dashboard. El usuario no sabe qué modelo se usa para qué.

Corrección: Una sección de "Configuración" simple en el dashboard que muestre los modelos activos y permita cambiar el API key. Ya existe /api/v1/config/env — solo falta exponerlo correctamente.

5.6 El soporte para proyecto existente no está diferenciado
Problema actual: El auto-planner no tiene un modo "proyecto existente" documentado. Si el usuario mete un goal como "avanza el módulo RRHH del ERP que ya tenemos", el planner no sabe que hay código previo que respetar.

Corrección: Agregar al intake dos modos explícitos: Proyecto nuevo / Proyecto existente, con un segundo campo opcional para describir el stack y restricciones del proyecto existente. Esto alimenta el prompt del planner con contexto de "no romper X, respetar Y".

6. Qué se Elimina
Estas piezas añaden ruido o complejidad sin contribuir al flujo principal.

Qué	Por qué se elimina
HTMX + Hyperscript como dependencias del dashboard	Ya no se usan; el dashboard funciona con HTML5 + EventSource + Socket.io. Son assets que se cargan sin propósito.
domain-packs/ — task patterns for data, finance, ops	Duplican funcionalidad de los skills. El skill system ya tiene esas categorías. Son templates sin conexión al runner.
templates/ — task templates for modules	Mismo problema. No están conectados al auto-planner real. Son archivos sueltos.
CONTINUE_FROM_HOME.md	Instrucción manual de recuperación. El sistema ya tiene recovery automático. Este doc es deuda de UX.
PROMPTS.md y CHAT_PROMPT_TEMPLATE.md	Son prompts para "el usuario actuando como LLM". En v1, el sistema llama al LLM directamente. Estos docs solo confunden.
agents/checkpoint.md	Duplica la lógica de state.json + lock. El sistema ya tiene checkpointing automático.
El tab de "Stats" mezclado con configuración	Stats y configuración no son lo mismo. Si existe configuración, debe ser su propia sección. Si Stats existe, debe mostrar métricas reales del sistema, no números vacíos.
7. Qué se Posterga
Cosas que tiene sentido eventualmente, pero que bloquean el cierre de v1 si se incluyen ahora.

Qué	Cuándo tendría sentido
Integración real con Engram (dependencia dura)	v2 — cuando el sistema tenga usuarios que necesiten persistencia entre máquinas
Autoskills como feature activa en el flujo	v2 — después de que el flujo base funcione sin fricción
Multi-proyecto / workspaces	v2 — después de que un proyecto funcione de extremo a extremo
Feedback loop con tests automatizados del output	v2 — requiere definir qué "test real" significa para cada tipo de proyecto
Soporte para otros proveedores (Anthropic direct, Gemini)	v2 — OpenRouter los cubre a todos
UI de edición de tareas (drag & drop, inline edit)	v1.5 — el kanban de solo lectura es suficiente para v1
Agents especializados por dominio (QA, reviewer separados)	Ya existen los .md pero no están conectados al runner. Postergar conexión.
8. Flujo Ideal: Del Prompt General a la Tarea Ejecutada

┌────────────────────────────────────────────────────┐
│  PASO 1: INTAKE                                    │
│                                                    │
│  Usuario escribe en el dashboard:                  │
│  "Construye una landing page para empresa de       │
│   seguridad con Stack moderno y buen diseño"       │
│                                                    │
│  (Opcional) Modo: ○ Proyecto nuevo  ● Existente    │
│  (Si existente) Stack: ".NET + Vue, no tocar DB"   │
└──────────────────────┬─────────────────────────────┘
                       │ POST /api/v1/prompt
                       ▼
┌────────────────────────────────────────────────────┐
│  PASO 2: PLANNING                                  │
│                                                    │
│  auto-planner.js recibe el goal                    │
│  detectTier() → "professional" (por "seguridad")   │
│  selectSkillSet() → landing/professional           │
│  buildPrompt() con agents/planner.md como base     │
│  callOpenRouter(model: free_advanced)              │
│                                                    │
│  Output: tasks.yaml con T1...Tn                    │
│  ┌─────────────────────────────────────────────┐   │
│  │ T1: Define paleta visual y typography       │   │
│  │ T2: Estructura HTML semántica (hero, about) │   │
│  │ T3: CSS + animaciones (depends: T1, T2)     │   │
│  │ T4: SEO on-page (depends: T2)               │   │
│  │ T5: Accesibilidad WCAG (depends: T2, T3)    │   │
│  └─────────────────────────────────────────────┘   │
└──────────────────────┬─────────────────────────────┘
                       │ tasks.yaml generado
                       ▼
┌────────────────────────────────────────────────────┐
│  PASO 3: EXECUTION                                 │
│                                                    │
│  runner.js run                                     │
│  acquireLock()                                     │
│  recalculateTaskStates() → T1, T2 son ejecutables  │
│  selectBatch(max=3) → [T1, T2]                     │
│                                                    │
│  Para cada tarea del batch:                        │
│    buildExecutionPrompt(task, skill)               │
│    → skill file adjunto al prompt                  │
│    → memory.md adjunto (contexto previo)           │
│    callOpenRouter(model según skill)               │
│    parseOutput()                                   │
│    validateR10(evidence vs task.output)            │
│    writeFiles(output paths)                        │
│    markTaskDone(T1), markTaskDone(T2)              │
│    appendDecision(memory.md)                       │
│  releaseLock()                                     │
└──────────────────────┬─────────────────────────────┘
                       │ T1, T2 done → T3, T4 desbloqueados
                       ▼
┌────────────────────────────────────────────────────┐
│  PASO 4: VERIFICATION                              │
│                                                    │
│  validateEvidence(T1) → files en evidence match    │
│  validateEvidence(T2) → ok                         │
│  detectCycles() → no hay ciclos                    │
│  recalculateTaskStates() → T3, T4 pasan a pending  │
│                                                    │
│  Si falla alguna tarea:                            │
│    createCorrectiveTask(T_fail)                    │
│    Dependientes heredan dependencia correctiva      │
└──────────────────────┬─────────────────────────────┘
                       │ Loop hasta all_tasks_done
                       ▼
┌────────────────────────────────────────────────────┐
│  PASO 5: SUPERVISION (CONTINUO)                    │
│                                                    │
│  Dashboard muestra en tiempo real:                 │
│  - Estado del kanban (Pending→Running→Done/Failed) │
│  - Terminal con output del runner                  │
│  - Cost tracker (0.12 USD / 50 USD budget)         │
│  - Botones: Pausar / Reanudar / Re-ejecutar tarea  │
│                                                    │
│  Memory.md se actualiza con cada decisión          │
│  Events.log registra cada acción con timestamp     │
└────────────────────────────────────────────────────┘
9. Arquitectura Mínima del Dashboard para Representar ese Flujo
El dashboard actual tiene la información correcta pero la organización equivocada. Esta es la estructura que debe tener:


┌──────────────────────────────────────────────────────────────────┐
│  OrchestOS                          ● Connected  [Config] [Help] │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  OBJETIVO DEL PROYECTO                                   │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │  Describe lo que quieres construir...              │  │   │
│  │  │  Ej: "Landing page para empresa de seguridad..."   │  │   │
│  │  │                                                    │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  │  Tipo: [○ Nuevo] [○ Existente]  Stack: [____________]    │   │
│  │  [  Generar Plan  ]  [  Ejecutar ▶  ]  [  Pausar ⏸  ]  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌────────────────────────┐  ┌────────────────────────────────┐ │
│  │  PLAN DE TAREAS        │  │  ESTADO DE EJECUCIÓN           │ │
│  │                        │  │                                │ │
│  │  Pending(3) Running(1) │  │  ▶ Ejecutando T3...            │ │
│  │  Done(2)   Failed(0)   │  │  > Reading skill css-animations│ │
│  │                        │  │  > Calling OpenRouter...       │ │
│  │  [T1 ✓] Setup visual   │  │  > Writing src/styles/main.css │ │
│  │  [T2 ✓] HTML structure │  │  > Evidence validated ✓        │ │
│  │  [T3 ⚙] CSS + anim     │  │                                │ │
│  │  [T4 ⏳] SEO           │  │  Cost: 0.08 USD / 50 USD      │ │
│  │  [T5 ⏳] A11y          │  │  Tasks: 2/5 done               │ │
│  │                        │  │                                │ │
│  └────────────────────────┘  └────────────────────────────────┘ │
│                                                                  │
│  [Skills ▼]  [Memory ▼]  [Config ▼]                            │
└──────────────────────────────────────────────────────────────────┘
Principios del dashboard:

El objetivo es el protagonista — El campo de texto es lo primero que ves
La ejecución es observación — El terminal es lectura, no interacción
El kanban es estado, no edición — No hace falta drag & drop en v1
Skills, Memory, Config son secundarios — Accesibles pero no en primer plano
Un solo botón de acción primaria a la vez — "Generar plan" primero, luego "Ejecutar"
Los números importan — Cost, tasks completadas, failures visibles siempre
10. Plan de Implementación por Prioridad
Tier 0: Cierre del flujo base (esta semana)
Estas son las piezas que hacen que el sistema funcione de extremo a extremo por primera vez de forma confiable. Sin esto, nada más importa.

[P0-1] Conectar auto-planner al endpoint de Prompt en el dashboard

Hoy: POST /api/v1/prompt y POST /api/v1/tasks/generate existen pero no están claros si están conectados al auto-planner de extremo a extremo o si esperan input humano.

Acción: Verificar y cerrar el loop en src/web/routes/api.js:

POST /api/v1/project/start debe llamar a auto-planner.js con el goal
El resultado debe poblar system/tasks.yaml directamente
El dashboard debe refrescar el kanban automáticamente vía EventSource
[P0-2] Verificar que npm run run ejecuta tareas reales via LLM

Hoy: El runner está completamente implementado pero no está claro si la conexión con OpenRouter produce output real o solo simula.

Acción: Test de integración real: goal → plan → run → archivos generados en disco. Si falla, es el bug más crítico.

[P0-3] Rediseño mínimo del dashboard

No es un rediseño visual. Es reorganización de los elementos existentes según la arquitectura del punto 9.

Mover el terminal de la tab Prompt a una sección de Execution
Hacer el campo de objetivo el elemento principal de la pantalla
Agregar los dos botones de acción primaria (Planificar / Ejecutar) bien visibles
Quitar HTMX y Hyperscript del HTML si no están en uso
Tier 1: Robustez del flujo (siguiente semana)
[P1-1] Soporte para proyecto existente en el intake

Agregar campo "Stack y restricciones del proyecto existente" al formulario de goal. Cuando está presente, este contexto se inyecta en el prompt del planner con instrucciones explícitas de no modificar archivos fuera del scope declarado.

[P1-2] Limpieza de archivos obsoletos

Eliminar: domain-packs/, templates/, CONTINUE_FROM_HOME.md, PROMPTS.md, CHAT_PROMPT_TEMPLATE.md, agents/checkpoint.md. Son ruido.

[P1-3] Sección de Configuración en el dashboard

Conectar /api/v1/config/env al dashboard con un formulario simple: API Key, modelo por defecto, budget. Nada más.

Tier 2: Polish del producto (semana 3)
[P2-1] Validación visual del plan antes de ejecutar

Antes de ejecutar, mostrar al usuario el plan generado (lista de tareas, dependencias, costo estimado) y pedir confirmación explícita. Esto previene ejecutar planes mal generados.

[P2-2] Indicador de "proyecto existente" en el estado del sistema

Si el proyecto es "existente", el dashboard debe mostrar claramente el stack y restricciones activos para que el usuario sepa que el planner los está respetando.

[P2-3] Definición clara del criterio de tarea terminada

Cada tarea, cuando se marca done, debe mostrar el summary de la evidence (qué archivos creó/modificó). Hoy existe system/evidence/{task_id}.json pero no es visible en el dashboard.

11. Riesgos Reales
R1: El LLM produce output que no cumple con el schema esperado
Severidad: Alta
Probabilidad: Alta
Mitigación actual: Validaciones R9/R10/R11 existentes. Pero si el LLM devuelve JSON malformado, el parser falla sin retry graceful.
Acción: Agregar retry con backoff en el parser de respuesta. Máximo 2 intentos antes de marcar tarea como failed.

R2: El auto-planner genera tareas demasiado grandes o demasiado acopladas
Severidad: Alta
Probabilidad: Media
Mitigación actual: R9 (límite de archivos por tarea). Pero si el planner genera tareas con dependencias circulares complejas, la detección de ciclos bloquea la ejecución.
Acción: Agregar validación del plan en el dashboard antes de ejecutar, con posibilidad de regenerar.

R3: El modelo free de OpenRouter produce output de baja calidad
Severidad: Media
Probabilidad: Alta
Mitigación actual: Model routing por skill. Pero las tareas más simples usan free_basic que puede ser inconsistente.
Acción: Establecer un threshold mínimo: ninguna tarea con skill de "professional" o "premium" usa free_basic. Esto ya está en el config pero necesita auditoría.

R4: El terminal del dashboard no muestra output en tiempo real
Severidad: Alta
Probabilidad: Media
Mitigación actual: EventSource + Socket.io existen.
Acción: Verificar que el spawn del runner en dashboard-service.js pipe correctamente stdout/stderr al EventSource broadcaster.

R5: El usuario no sabe qué hacer después de generar el plan
Severidad: Media
Probabilidad: Alta
Mitigación actual: Ninguna — el flujo no guía al usuario.
Acción: El dashboard debe hacer el botón "Ejecutar" visible y activo automáticamente después de que el plan se genera con éxito.

R6: Los archivos generados por el LLM se sobrescriben en ejecuciones repetidas
Severidad: Alta
Probabilidad: Media
Mitigación actual: El evidence system previene cambios implícitos. Pero si el usuario re-ejecuta sin resetear el estado, las tareas done no se re-ejecutan (comportamiento correcto). El riesgo es cuando el usuario modifica manualmente archivos generados y luego ejecuta de nuevo.
Acción: Documentar claramente que el runner respeta el estado de las tareas. "Done = no se re-ejecuta".

12. Primeras 3 Acciones Concretas para Aterrizar el Sistema
Acción 1: Hacer el flujo end-to-end funcionar de extremo a extremo una sola vez
Objetivo: Demostrar que el sistema completo funciona: goal → plan → execute → archivos reales.

Pasos:

Abrir el dashboard en localhost:3000
Escribir un goal simple: "Crea una landing page básica para una agencia digital con hero, about y contact"
Hacer click en "Generar Plan" → verificar que system/tasks.yaml se genera con tareas válidas
Hacer click en "Ejecutar" → verificar que el runner produce archivos en disco
Revisar system/evidence/ para confirmar que el evidence system funciona
Si cualquiera de estos pasos falla, ese es el bug más crítico del sistema

Excelente. Tengo una lectura completa del repositorio. Ahora produciré el análisis arquitectónico completo.

OrchestOS v1 — Guía de Aterrizaje Definitiva
Análisis del estado real del sistema. Sin especulación, sin features inventadas.

1. Tesis del Producto
OrchestOS es una estación de control que convierte intención ambigua en ejecución ordenada de código.

El problema que resuelve es específico: un desarrollador solo (o un equipo pequeño) tiene un objetivo de software expresado en lenguaje natural, y necesita convertirlo en tareas ejecutables, ejecutarlas con LLMs de manera controlada, validar que el código producido es real, y mantener continuidad entre sesiones sin perder contexto.

No es un chatbot. No es un IDE. No es un agente autónomo. Es un sistema de orquestación con memoria, validación y determinismo.

Para quién sirve:

Desarrolladores que quieren delegar ejecución de tareas concretas a LLMs sin perder el control
Proyectos donde el scope cambia y necesitas replanning sin perder progreso
Casos donde necesitas trazabilidad real (qué se ejecutó, con qué modelo, a qué costo)
Para quién NO sirve (en v1):

Equipos que necesitan colaborar en tiempo real (no hay multi-user)
Automatización 100% desatendida (el executor necesita supervisión)
Proyectos que no generan archivos de código (el sistema está centrado en file output)
2. Borde de OrchestOS v1
Entra en v1
Capacidad	Estado actual
Intake de prompt general en lenguaje natural	Existe, funciona
Auto-planner: descomposición en tasks.yaml	Existe, funciona
Ejecución determinista por batches de ≤3 tareas	Existe, 100% testeado
Validación R9/R10/R11 (tamaño, evidencia, skills)	Existe, testeado
Memoria persistente (file + Engram opcional)	Existe, funciona
Skills library (50+ habilidades de dominio)	Existe, funciona
Mapeo skill → modelo (free / paid / heavy)	Existe, configurable
Recovery: corrective tasks, lock TTL, resume	Existe, testeado
Dashboard web: monitor, prompt, tasks, skills	Existe, en puerto 3000
Soporte proyectos nuevos Y existentes	Parcialmente — planner necesita ajuste
Cost tracking por tarea y modelo	Existe, funciona
Queda fuera de v1
Capacidad	Razón
Multi-user / colaboración	No es el problema central
Ejecución 100% autónoma sin supervisión	Riesgo alto, fuera del scope
Interfaz mobile	No prioritario
Marketplace de skills	Extensión, no núcleo
Integración con GitHub Actions, CI/CD externo	Extensión v2
Editor de código en el dashboard	El executor ya escribe en disco
3. Mapa de Módulos del Sistema

┌─────────────────────────────────────────────────────────┐
│                     DASHBOARD (port 3000)                │
│  [Prompt] → [Tasks] → [Memory] → [Skills] → [Stats]     │
└──────────────┬──────────────────────────────────────────┘
               │ API REST + SSE + Socket.io
               ▼
┌─────────────────────────────────────────────────────────┐
│                      SERVER (Express)                    │
│   api.js · views.js · dashboard-service.js              │
│   realtime-service.js · websocket-service.js            │
└──────────────┬──────────────────────────────────────────┘
               │ spawn / file I/O
               ▼
┌─────────────────────────────────────────────────────────┐
│                    RUNNER (runner.js 85KB)               │
│                                                         │
│  INTAKE → PLAN → EXECUTE → VALIDATE → CHECKPOINT       │
│                                                         │
│  Plan phase:    auto-planner.js + agents/planner.md     │
│  Execute phase: LLM call + agents/executor.md           │
│  Validate:      R9 / R10 / R11 + agents/qa.md          │
│  Memory:        memory-manager.js + engram-client.js    │
│  Skills:        skill-manager.js + autoskills-adapter   │
└──────────────┬──────────────────────────────────────────┘
               │ read/write
               ▼
┌─────────────────────────────────────────────────────────┐
│                   SYSTEM/ (state del proyecto)          │
│  state.json · tasks.yaml · memory.md · goal.md         │
│  plan.md · evidence/ · runs/ · cost.json               │
└─────────────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│              SKILLS & AGENTS (conocimiento)             │
│  skills/ (50+ .md) · agents/ (6 roles) · .agents/      │
└─────────────────────────────────────────────────────────┘
4. Qué Se Mantiene
Estas partes funcionan y cumplen su rol. No tocar sin razón.

runner.js — el núcleo
El motor de 85KB es la pieza más madura. La selección determinista de batches, el sistema de locks, R9/R10/R11, el manejo de ciclos, el cost tracking, el recovery con corrective tasks — todo está testeado y resuelve el problema real. Este archivo no se refactoriza en v1.

Sistema de skills (50+ habilidades)
La biblioteca de skills en skills/ es capital intelectual acumulado. Cada archivo .md encapsula patrones de dominio reales. El mapeo skill → model en config.json es la estrategia de costo correcta. Se mantiene tal cual, solo se extiende con skills nuevos cuando hay proyecto real que los necesite.

Memory manager (file + Engram)
La abstracción con fallback es correcta. Primero escribe en disco, Engram es opcional. La compactación automática a 20 entradas es el límite correcto. No cambia.

Agent definitions (planner, executor, qa, reviewer)
Son los prompts de control. Están bien separados por responsabilidad. Se mantienen. La única que necesita ajuste es planner.md para soporte de proyectos existentes (ver sección 5).

Test suite (14 archivos)
100% de tests pasando. Este es el contrato del sistema. No se rompe nada que cause fallo aquí.

Cost tracking + model mapping
La estrategia de usar modelos baratos para tareas simples y pesados para arquitectura es correcta y está implementada. Se mantiene.

5. Qué Se Corrige
Estas partes existen pero tienen problemas concretos que bloquean el objetivo principal.

Corrección 1 — El planner no distingue proyectos existentes
Problema: auto-planner.js y agents/planner.md generan tasks como si el proyecto siempre empezara desde cero. No hay lógica de introspección del proyecto existente antes de planear.

Corrección concreta:
En auto-planner.js, antes de llamar al LLM, detectar si el system/ tiene un proyecto ya inicializado (goal.md existente + tasks.yaml con tareas completadas). Si existe, el prompt al planner debe incluir:

Lista de archivos actuales del proyecto (glob del working dir)
Tareas ya completadas desde tasks.yaml
Tecnología detectada (package.json, .csproj, composer.json)
En agents/planner.md, agregar una sección explícita: "Si el proyecto ya existe, las primeras tareas deben ser de análisis (leer estructura, leer dependencias, leer código clave), no de creación."

Corrección 2 — El dashboard mezcla responsabilidades en el tab "Prompt"
Problema: El tab "Prompt" tiene: textarea para goal, botones Create/Generate/Run, Y terminal de output. Eso son dos cosas: intake de intención + monitor de ejecución. Están mezcladas, lo que confunde el flujo.

Corrección concreta (ver sección 9 para el diseño):
Separar el área de intake (escribir la intención) del área de ejecución (ver output). La terminal de output debe estar en el sidebar derecho o en una sección siempre visible, no dentro de un tab específico.

Corrección 3 — El tab "Stats" es demasiado pequeño para su contenido
Problema: La visualización de riesgos, coverage y dependency health están comprimidas en un solo tab que no distingue entre "métricas del sistema" y "estado del proyecto actual".

Corrección: Fusionar Stats con el contexto del proyecto actual. Las métricas deben estar visibles como parte del estado general del sistema, no aisladas en un tab.

Corrección 4 — El opencode.json no está integrado con el flujo
Problema: El archivo opencode.json en el root existe pero el runner no lo lee ni lo referencia. Es configuración huérfana.

Corrección: O integrarlo como provider alternativo a OpenRouter, o documentarlo como "solo para desarrollo local con OpenCode IDE" y excluirlo del flujo del runner.

Corrección 5 — El executor no tiene validación de que realmente escribió a disco
Problema: El executor agent (agents/executor.md) produce output de texto, pero el runner confía en que ese output contiene código real. La única validación es R10 (evidencia de archivos). Si el LLM devuelve texto sin archivos reales, el sistema marca la tarea como completada incorrectamente.

Corrección: En runner.js, después de ejecutar una tarea, verificar que al menos 1 archivo de task.output fue modificado (git diff o hash comparison). Si ningún archivo cambió, la tarea debe marcarse como failed, no como done.

6. Qué Se Elimina
Estas partes no contribuyen al objetivo principal o generan ruido.

providers/openrouter.js como archivo separado
El archivo providers/openrouter.js existe pero runner.js tiene la implementación de callOpenRouter() duplicada dentro de sí mismo. Hay dos implementaciones de la misma cosa. La del providers/ se elimina y runner.js usa solo su implementación interna, o al contrario — se centraliza en el provider y runner importa de ahí. Actualmente es deuda técnica activa.

Los 7 archivos de documentación en el root
TECHNICAL.md, USAGE.md, QUICKSTART.md, DOCUMENTACION.md, PROMPTS.md, CHAT_PROMPT_TEMPLATE.md, CONTINUE_FROM_HOME.md — son 7 archivos que probablemente nadie lee completos y algunos están desactualizados. Para v1, consolidar en README.md + CLAUDE.md. La documentación fragmentada en el root es deuda de mantenimiento.

demo/ directory
Si no hay demos funcionales y testeados que sirvan como onboarding a nuevos usuarios, el directorio es ruido. Verificar si tiene contenido real o eliminarlo.

domain-packs/
Patterns for data, finance, ops — si estos no están integrados al skill selector en config.json, son archivos huérfanos. Integrar o eliminar.

7. Qué Se Posterga
Estas partes son válidas pero no deben ejecutarse en v1 para no perder foco.

Autoskills como flujo automático
El autoskills-adapter.js y la detección automática de tecnologías es valiosa, pero en v1 el flujo es: usuario escribe goal → planner sugiere skills → usuario confirma. La detección automática de skills puede automatizarse en v2 cuando el loop básico sea confiable.

Soporte multi-provider (más allá de OpenRouter)
La arquitectura soporta providers alternativos pero en v1 solo OpenRouter importa. La abstracción de provider se mantiene en código pero no se extiende.

Drag-drop en el kanban del dashboard
El board de tareas no necesita drag-drop en v1. Leer, monitorear y ejecutar es suficiente. El reordering manual de tareas se hace editando tasks.yaml directamente o via la API.

Engram como sistema primario de memoria
En v1, Engram es opcional y file-based es el primario. No invertir tiempo en hacer Engram el sistema principal hasta que el flujo básico esté estabilizado.

Ejecución paralela real (varios LLMs simultáneos)
El sistema selecciona batches de hasta 3 tareas, pero actualmente las ejecuta secuencialmente. La paralelización real requiere manejo de concurrencia más sofisticado. Postergado a v2.

8. Flujo Ideal: De Prompt General a Tarea Ejecutada

USUARIO ESCRIBE:
"Construye una landing page para empresa de ciberseguridad,
stack moderno, diseño premium, buenas prácticas"
         │
         ▼
[INTAKE]
 Dashboard recibe el goal
 Se crea system/goal.md
 Se inicializa state.json (phase: planning)
         │
         ▼
[PLANNER — auto-planner.js + agents/planner.md]
 Detecta tier: "premium" (keyword: premium)
 Detecta tipo: "landing" (keyword: landing page)
 Selecciona skill set: landing.premium desde config.json
 → frontend-design-awwwards, animations-expert,
   ux-accessibility, performance-expert, seo
 
 ¿Proyecto existente?
   NO → genera tasks desde cero
   SÍ → primero analiza estructura, luego genera tasks
 
 Llama a LLM (free_advanced = qwen3.6-plus)
 con prompt estructurado
 
 Produce tasks.yaml:
 T1: Setup estructura HTML (html-basic, priority:1)
 T2: Diseño hero section (design-awwwards, priority:1)
 T3: Sección servicios (react-hooks, priority:2, depends:T1)
 T4: Animaciones scroll (animations-expert, priority:3, depends:T2,T3)
 T5: Optimización SEO (seo, priority:4, depends:T1)
 T6: Accesibilidad WCAG (ux-accessibility, priority:4, depends:T1..T5)
 
 Valida: R9 (tamaño OK), ciclos (ninguno), skills (todos existen)
         │
         ▼
[EJECUCIÓN — runner.js run]
 Recalcula estados (T1, T2 → pending sin deps)
 Selecciona batch: [T1, T2] (priority 1, max 3)
 
 Para cada tarea:
   Lee skill file completo (ej: skills/frontend/html-basic.md)
   Construye prompt: goal + plan + tarea + skill + memoria reciente
   Selecciona modelo: html-basic → free_basic (barato)
                      design-awwwards → heavy_architecture (pesado)
   Llama a OpenRouter
   LLM devuelve código
   Runner escribe archivos a disco
   Crea evidence file con hashes
         │
         ▼
[VALIDACIÓN — R10 + opcionalmente agents/qa.md]
 Verifica: archivos en evidence ⊆ task.output
 Verifica: al menos 1 archivo fue modificado realmente
 Si falla → tarea marcada failed → corrective task creada
 Si pasa → tarea marcada done
         │
         ▼
[MEMORIA — memory-manager.js]
 Escribe decisión en system/memory.md:
 "T1 completada. Creado index.html con estructura base. Stack: HTML5."
 Si entries > 20 → compactar
         │
         ▼
[CHECKPOINT / CONTINUIDAD]
 state.json actualizado (tasks_completed, iteration)
 events.log con audit trail
 status.md con progreso legible
 
 Siguiente run:
 Runner lee state, recalcula T3,T4,T5 aún bloqueadas
 T5 ya no bloquea → [T5] en siguiente batch
 Y así hasta que todos los tasks estén done
         │
         ▼
[DASHBOARD REFLEJA EL ESTADO]
 Kanban: T1✓ T2✓ | T3→running | T4,T5,T6→blocked
 Stats: 2/6 done, $0.08 gastados, 0 fallos
 Terminal: output del último run visible
9. Arquitectura Mínima del Dashboard
El dashboard actual tiene la estructura correcta pero las proporciones y agrupaciones están mal. Este es el layout que representa el flujo real del sistema:


┌─────────────────────────────────────────────────────────────────┐
│  OrchestOS   ●Running   [2/6 tareas]   [⚙ Config]  [$0.08]    │  ← Header global
└──────────────────────────────────────────────────────────────────┘

┌────────────────────────┬────────────────────────────────────────┐
│  SIDEBAR IZQUIERDO     │  ÁREA PRINCIPAL                        │
│  (navegación)          │                                        │
│                        │                                        │
│  ◉ Objetivo            │  [Depende del tab activo]              │
│  ○ Tareas              │                                        │
│  ○ Ejecución           │                                        │
│  ○ Memoria             │                                        │
│  ○ Skills              │                                        │
│  ○ Configuración       │                                        │
│                        │                                        │
├────────────────────────┴────────────────────────────────────────┤
│  TERMINAL  (siempre visible, colapsable, altura fija 200px)     │
│  $ node runner.js run                                           │
│  > Batch seleccionado: [T1, T2]                                 │
│  > T1: ejecutando con html-basic / free_basic...                │
└─────────────────────────────────────────────────────────────────┘
Tab: Objetivo (Intake)


┌─────────────────────────────────────────────────────────────────┐
│  ¿Qué quieres construir?                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Escribe tu objetivo aquí...                            │   │
│  │  (textarea grande, mínimo 10 líneas)                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Proyecto existente: [ ] Sí  ●No                               │
│  Si sí: [ruta del proyecto ___________________]                 │
│                                                                 │
│  [Iniciar Proyecto]     [Generar Plan]     [▶ Ejecutar]        │
│                                                                 │
│  Estado: ● Listo para planear                                   │
└─────────────────────────────────────────────────────────────────┘
Tab: Tareas (Board)


┌──────────┬──────────┬──────────┬──────────┬──────────┐
│ Pendiente│En proceso│Completada│  Fallida │ Bloqueada│
│          │          │          │          │          │
│  ┌────┐  │  ┌────┐  │  ┌────┐  │          │  ┌────┐  │
│  │ T3 │  │  │ T1 │  │  │ T2 │  │  (vacío) │  │ T5 │  │
│  │pri2│  │  │    │  │  │ ✓  │  │          │  │    │  │
│  └────┘  │  └────┘  │  └────┘  │          │  └────┘  │
└──────────┴──────────┴──────────┴──────────┴──────────┘
Tab: Ejecución (Monitor)
Este tab reemplaza la terminal embebida en Prompt. Aquí va:

Output de las últimas N ejecuciones
Badge por task ejecutado (modelo usado, tokens, costo, tiempo)
Botón pause/resume
Botón "ver evidencia" por tarea
Tab: Memoria
Queda igual — search bar + resultados. Funciona.

Tab: Skills
Queda igual — browser + editor. Funciona.

Tab: Configuración
Consolida lo que hoy está mezclado:

API keys (OPENROUTER_API_KEY)
Budget / modelo por tier
Provider activo
Engram settings
La terminal inferior es la diferencia clave. Hoy la terminal está dentro del tab Prompt, lo que significa que desaparece cuando cambias de tab. Eso es un error de UX crítico porque la terminal debe ser siempre visible mientras orquestas.

10. Plan de Implementación Ordenado por Prioridad
Prioridad 1 — Cierra el loop básico (1-2 días)
P1.1 — Validación de escritura real a disco
Archivo: runner.js
Función: añadir en la sección post-ejecución de tarea la verificación de que al menos 1 archivo en task.output fue modificado. Usar fs.statSync() + hash o git diff --name-only si git está disponible.

P1.2 — Eliminar duplicación openrouter
Archivos: providers/openrouter.js vs runner.js
Decidir cuál es la implementación canónica, eliminar la otra, verificar que los tests siguen pasando.

P1.3 — Soporte proyecto existente en planner
Archivo: src/integrations/auto-planner.js
Agregar: antes de llamar al LLM, si el working dir tiene package.json / .csproj / composer.json, incluir en el prompt la lista de archivos y framework detectado. Agregar flag existing_project: true/false al estado.

Prioridad 2 — Dashboard funcional y coherente (2-3 días)
P2.1 — Terminal siempre visible
Archivo: src/web/public/dashboard/index.html
Mover el terminal de output fuera del tab Prompt. Crear un panel inferior fijo (height: 200px, colapsable) que persiste entre tabs. El output del runner se muestra ahí siempre.

P2.2 — Tab "Ejecución" separado
Archivo: src/web/public/dashboard/index.html
Crear tab "Ejecución" que muestra el historial de runs con badge por tarea (modelo, costo, tiempo) y botones pause/resume. Sacar eso del tab Prompt.

P2.3 — Tab "Objetivo" limpio
Solo el textarea grande + checkbox proyecto existente + 3 botones. Nada más.

Prioridad 3 — Soporte proyecto existente completo (2-3 días)
P3.1 — Planner introspección de proyecto
Archivo: agents/planner.md
Agregar sección explícita: cuando existing_project: true, las primeras 1-2 tareas son de análisis (leer estructura, identificar stack, detectar puntos de extensión). El planner no propone crear archivos que ya existen.

P3.2 — Executor contexto de proyecto existente
Archivo: agents/executor.md
Agregar regla: antes de crear cualquier archivo, verificar si existe. Si existe, extender — no reemplazar. Incluir diff del archivo existente en el contexto de la tarea cuando sea relevante.

Prioridad 4 — Limpieza de deuda (1 día)
P4.1 — Consolidar documentación
Colapsar los 7 archivos *.md del root en README.md + CLAUDE.md. Eliminar archivos obsoletos.

P4.2 — Integrar o eliminar domain-packs/
Verificar si los patrones en domain-packs/ están mapeados en config.json. Si no, integrarlos al skill selector o eliminarlos.

P4.3 — Documentar opencode.json
Aclarar en un comentario o en CLAUDE.md que opencode.json es para el entorno de desarrollo local y no afecta la orquestación.

11. Riesgos Reales
Riesgo 1 — El executor produce texto, no archivos
Probabilidad: Alta. Impacto: Alto.
El LLM puede devolver código en formato de chat, no en estructura que el runner puede escribir a disco. Si el runner no valida que los archivos realmente se crearon/modificaron, el sistema marca tareas como completadas sin que haya trabajo real. La Corrección 5 de la sección 5 debe resolverse en Prioridad 1.

Riesgo 2 — El planner genera planes genéricos
Probabilidad: Media. Impacto: Alto.
Si el prompt al planner no incluye contexto del proyecto existente, el plan generado va a proponer crear archivos que ya existen, conflictos de stack, o duplicar trabajo ya hecho. Para proyectos nuevos esto no es problema. Para proyectos existentes, el riesgo es que el executor sobreescriba código funcional.

Riesgo 3 — Acumulación de contexto en sesiones largas
Probabilidad: Alta en proyectos grandes. Impacto: Medio.
El sistema no tiene un mecanismo de corte de contexto entre el planner y el executor a medida que aumentan las iteraciones. memory.md crece, plan.md crece, y eventualmente el prompt al LLM excede el contexto útil. La compactación de memoria a 20 entradas ayuda, pero no es suficiente para proyectos de 50+ tareas. Esto es un riesgo conocido que debe monitorearse y planificarse para v2.

Riesgo 4 — Dependencia única en OpenRouter
Probabilidad: Baja. Impacto: Alto.
Si OpenRouter tiene downtime o cambia precios/modelos, el sistema se detiene completamente. La arquitectura soporta múltiples providers pero solo hay uno implementado. Para v1 es aceptable, pero debe tener un fallback documentado.

Riesgo 5 — El dashboard no muestra el estado real
Probabilidad: Media. Impacto: Medio.
Si el terminal de output está oculto cuando el usuario cambia de tab, y el runner falla en background, el usuario no lo ve hasta que regresa al tab Prompt. Esto puede hacer que tareas fallidas pasen desapercibidas. La terminal siempre visible (Prioridad 2.1) resuelve esto.

12. Primeras 3 Acciones Concretas
Acción 1 — Cerrar el loop de validación real
Qué: En runner.js, localizar la función que marca una tarea como done, y antes de esa marca, verificar que algún archivo en task.output fue realmente creado o modificado en disco.

Cómo verificar: Si git está disponible, git diff --name-only HEAD lista los archivos cambiados. Si no, comparar hashes de task.output antes y después de la ejecución. Si ninguno cambió → tarea = failed, no done.

Por qué primero: Este es el único riesgo que hace al sistema mentiroso. Si el executor produce output inerte, el sistema dice que todo está bien cuando no lo está. Mientras este bug exista, el sistema no es confiable.

Archivos a modificar:

runner.js — función de finalización de tarea (buscar markTaskDone o similar)
Acción 2 — Mover la terminal al panel inferior del dashboard
Qué: En src/web/public/dashboard/index.html, extraer el bloque del terminal de output (actualmente dentro del tab Prompt) y convertirlo en un panel inferior fijo con position: sticky; bottom: 0 o un div separado fuera del sistema de tabs.

Cómo: El terminal recibe output via EventSource (SSE) o Socket.io. Esa conexión no necesita estar dentro de ningún tab. El panel inferior debe tener toggle de colapso y quedar visible en todas las vistas.

Por qué segundo: Es la corrección de UX más crítica. Un sistema de orquestación donde no puedes ver lo que está pasando mientras navegas el estado del proyecto no es usable.

Archivos a modificar:

src/web/public/dashboard/index.html
Acción 3 — Agregar soporte de proyecto existente al auto-planner
Qué: En src/integrations/auto-planner.js, antes de construir el prompt, detectar si el directorio de trabajo tiene señales de proyecto existente:

package.json → proyecto Node/React/Vue
*.csproj / *.sln → proyecto .NET
composer.json → proyecto PHP/Laravel
requirements.txt / pyproject.toml → Python
Si se detecta alguno, leer ese archivo y extraer: nombre del proyecto, dependencias clave, versión. Incluir eso en el prompt al planner con instrucción explícita: "Este es un proyecto existente. Analiza antes de modificar. No sobreescribas archivos sin leer su contenido."

Por qué tercero: Es el caso de uso más común en la práctica real. La mayoría de los proyectos que alguien quiere avanzar con OrchestOS ya existen. Sin esto, el planner actúa como si siempre fuera proyecto nuevo y el riesgo de romper código funcional es alto.

Archivos a modificar:

src/integrations/auto-planner.js
agents/planner.md — agregar sección de proyecto existente
Criterio de Terminado para v1
El sistema "sirve" cuando:

Usuario escribe un goal → se genera un plan con tareas reales → se ejecutan → los archivos existen en disco
El dashboard muestra el estado real sin tener que revisar archivos YAML manualmente
Cuando una tarea falla, el sistema lo reporta explícitamente (no la marca como done)
Para un proyecto existente, el planner NO propone sobreescribir código funcional
La terminal de output es visible siempre que el runner está activo
Señales de que todavía no está listo:

El executor devuelve texto y el sistema lo acepta como trabajo completado
El kanban del dashboard no refleja el estado real de tasks.yaml
Un usuario nuevo no puede completar su primer ciclo completo (goal → plan → execute → resultado en disco) en menos de 15 minutos con la documentación existente
Para un proyecto .NET + Vue existente, el planner propone crear archivos que ya existen
Mínimo para uso real propio (no monetización):
Las 3 acciones concretas de arriba, más que el loop completo funcione de principio a fin al menos 3 veces consecutivas con proyectos diferentes sin intervención manual de emergencia.

