# Sistema de Orquestación de Agentes v2

> Tu "segundo cerebro" para programar x10. Recuerda todo, sugiere qué hacer, y nunca repites contexto.

## El Problema que Resuelve

Antes:
- ❌ Cada conversación nueva = re-explicar todo desde cero
- ❌ No sabías qué tarea seguía
- ❌ No recordabas qué decisiones tomaste
- ❌ Empezar proyecto nuevo = setup manual cada vez
- ❌ Lecciones aprendidas se perdían

Ahora:
- ✅ `pm resume` → Prompt listo para pegar en nueva conversación
- ✅ `pm next` → Te dice exactamente qué hacer
- ✅ `pm sprint` → Sprint priorizado con dependencias
- ✅ `pm init landing mi-cliente` → Proyecto nuevo en 1 comando
- ✅ `pm learn "lección"` → Captura conocimiento

## Estructura

```
orchestrator/
├── pm.js                    # CLI principal (el cerebro)
├── mcp-server.js            # Integración MCP
├── package.json
├── lessons.json             # Lecciones aprendidas
├── agents/
│   └── registry.json        # 20 agentes registrados
├── projects/
│   ├── _index.json          # 8 proyectos configurados
│   └── citasbot/
│       ├── state.json       # Estado actual
│       ├── tasks.json       # Tareas con dependencias
│       └── decisions.json   # Decisiones técnicas
├── SPEC.md                  # Especificación técnica
└── GAP_ANALYSIS.md          # Análisis de gaps y plan de mejora
```

## Comandos

### 🔄 Flujo Diario

```bash
# Al iniciar el día: ver qué hacer
pm status
pm sprint

# Al abrir nueva conversación con AI: pegar contexto
pm resume

# Al terminar una tarea
pm done task_005 --notes="Dashboard con Recharts"

# Al tomar una decisión técnica
pm decide "Usar Resend para emails"
```

### 📋 Gestión de Estado

| Comando | Alias | Descripción |
|---------|-------|-------------|
| `pm status` | `pm s` | Estado del proyecto actual |
| `pm next` | `pm n` | Siguiente tarea sugerida |
| `pm sprint` | `pm sp` | Sprint de 5 tareas priorizadas |
| `pm list` | `pm ls` | Listar todos los proyectos |
| `pm resume` | `pm r` | **Prompt para nueva conversación** |
| `pm context` | `pm ctx` | Contexto JSON para el modelo |

### ✏️ Gestión de Tareas

| Comando | Descripción |
|---------|-------------|
| `pm add "tarea"` | Agregar nueva tarea |
| `pm done <id>` | Completar tarea |
| `pm decide "text"` | Registrar decisión técnica |
| `pm use <proyecto>` | Cambiar proyecto activo |

### 🚀 Nuevo Proyecto

```bash
pm init landing mi-cliente    # Landing con GSAP + Vue
pm init saas nueva-app        # SaaS con Next.js + Prisma
pm init erp sistema-x         # ERP con .NET + Vue
pm init mcp mi-herramienta    # MCP server
```

Cada `pm init` crea automáticamente:
- `state.json` con stack y fase
- `tasks.json` con tareas pre-definidas por tipo
- `decisions.json` vacío
- Entrada en `_index.json`

### 🧠 Aprendizaje

```bash
pm learn "Nunca usar CDN de Tailwind en producción"
# → Categoría detectada: frontend
# → Guardado en lessons.json

pm learn "Siempre agregar .dockerignore"
# → Categoría detectada: devops
```

## Ejemplo: Flujo Completo

```bash
# 1. Crear proyecto nuevo
pm init landing restaurante-gourmet

# 2. Ver primera tarea
pm next
# → "Setup proyecto (Vite + Vue/React)"

# 3. Abrir conversación con AI
pm resume
# → Copia el prompt y pégalo

# 4. Trabajar en la tarea...

# 5. Completar
pm done task_001 --notes="Vite + Vue 3 + TailwindCSS"

# 6. Ver sprint
pm sprint
# → Muestra las 5 tareas priorizadas

# 7. Registrar decisión
pm decide "Usar Vue en lugar de React para esta landing"

# 8. Aprender algo nuevo
pm learn "Lenis smooth scroll conflicta con ScrollTrigger pin"
```

## Optimización de Tokens

| Comando | Tokens aprox. | Cuándo usarlo |
|---------|---------------|---------------|
| `pm resume` | ~150 | **Cada conversación nueva** |
| `pm status` | ~50 | Revisión rápida |
| `pm next` | ~100 | Antes de trabajar |
| `pm context` | ~200 | Contexto JSON completo |

## Proyectos Configurados

| Proyecto | Tipo | Fase | Salud |
|----------|------|------|-------|
| CitasBot SaaS | SaaS | build | 🟢 active |
| Cisepro ERP | ERP | build | 🟢 active |
| AI Core Multi-Model | MCP | build | 🟢 active |
| Premom Landing | Landing | ship | 🔵 completed |
| Arquitect Nine | Landing | ship | 🔵 completed |
| EHDU Music | Landing | ship | 🔵 completed |
| Jen & Co | Landing | ship | 🔵 completed |
| Portfolio Carlos | Portfolio | ship | 🔵 completed |

## Agentes Registrados (20)

| Agente | Dominio | Archivo |
|--------|---------|---------|
| Decision Classifier | Clasificación | `classifier/decision-classifier.md` |
| Shipping Agent | Velocidad | `classifier/shipping-agent.md` |
| Global Architect | Arquitectura | `architecture/global-architect.md` |
| Node.js Backend | Backend | `backend/node-api.md` |
| .NET Backend | Backend | `backend/dotnet-data-sqlserver.md` |
| Laravel API | Backend | `backend/laravel-api.md` |
| React Frontend | Frontend | `frontend/react-hooks.md` |
| Vue Frontend | Frontend | `frontend/vue-composition.md` |
| Animations | Frontend | `frontend/animations.md` |
| PostgreSQL | Database | `database/postgres-schema.md` |
| Prisma | Database | `database/prisma-queries.md` |
| Migrations | Database | `database/migrations-dotnet-prisma.md` |
| CI/CD | DevOps | `devops/ci-cd.md` |
| Docker | DevOps | `devops/docker.md` |
| Deployment | DevOps | `devops/deployment.md` |
| API Security | Security | `security/api-security.md` |
| Backend Tests | Testing | `testing/backend-test.md` |
| CitasBot Stack | Stack | `stacks/citasbot.-stack.md` |
| Cisepro Stack | Stack | `stacks/cisepro-stack.md` |
| Landing Stack | Stack | `stacks/landing-stack.md` |

## Relación con ai-core

Este sistema (`agents/`) contiene las **reglas y conocimiento** (markdown).
El `ai-core` contiene el **motor de ejecución** (código).

```
agents/ (este repo)          ai-core (otro repo)
├── Reglas por agente    →   ├── Scanner (detecta proyecto)
├── Stacks por proyecto  →   ├── Router (selecciona agente)
├── Decision Classifier  →   ├── Orchestrator (coordina)
├── PM CLI (estado)      →   ├── Memory (persistencia)
└── Lessons learned      →   └── MCP Server (integración)
```

**Próximo paso**: Conectar ambos para que ai-core cargue automáticamente las reglas de agents/ según el proyecto detectado.

## Filosofía

> "El desarrollador solo direcciona y orquesta. La máquina recuerda y ejecuta."

- **Hecho > Perfecto** (shipping-agent)
- **No over-engineering** (global-architect)
- **Contexto mínimo, máximo impacto** (pm resume)
- **Aprender de cada proyecto** (pm learn)
