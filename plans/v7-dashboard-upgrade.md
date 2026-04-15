# v7 — Dashboard Upgrade: Estación de Control de Ejecución

> Última actualización: 2026-04-14
> Estado: Semana 1 en progreso
> Fuente de verdad para el rediseño del dashboard.

---

## CONTEXTO

El dashboard actual fue construido como un panel genérico. El objetivo de v7 es convertirlo en una **estación de control de ejecución** enfocada en 3 flujos reales:

1. **Escribir goal/prompt** — el centro de trabajo
2. **Ejecutar acciones** — Create Project → Generate Tasks → Run
3. **Observar resultados/estado** — terminal, tasks, realtime feed

---

## DIAGNÓSTICO DE ARQUITECTURA ACTUAL

### Mapa de lo que existe

```
Global Header          → Logo + lang toggle + help
Sidebar (280px)        → Brand (h1 grande) + Nav (7 tabs) + Status card + Pending panel
Content Header         → Tab title + [Run] [Save] [Create Project]  ← SIEMPRE VISIBLE (problema)
Tab: Prompt Studio     → Textarea (rows=12 fijo) + Terminal Output
Tab: Tasks             → Kanban 5 cols + Task details panel
Tab: Memory            → Search + Results
Tab: Skills            → List + Actions + Editor
Tab: Project           → File list + File editor + Next Steps checklist
Tab: Stats             → Controls (phase/status) + Project Root + Realtime + Memory + API Keys
Tab: Commands          → Lista estática de 6 comandos CLI
```

### Problemas — Producto (decisiones de alcance/visión)

| Problema | Síntoma |
|---|---|
| Commands no es una feature | Es documentación disfrazada de tab |
| Stats mezcla 3 cosas distintas | Monitoreo + configuración + debug tools en el mismo panel |
| "Next Steps" checklist | Estático e inútil después del primer setup |
| `sendPromptBtn` | El botón "Send" no hace nada definido |
| `savePromptBtn` en el header | Guarda el prompt pero no está claro dónde ni para qué |

### Problemas — UX (experiencia de uso)

| Problema | Síntoma |
|---|---|
| Run/Save/Create Project siempre visibles | Botones de contexto expuestos como globales |
| Prompt textarea fixed rows=12 | No crece, no es el centro de trabajo |
| Sidebar de 280px | Consume ~23% del ancho con brand gigante y nav simple |
| Duplicate "Pending" | En sidebar Y en kanban |
| Duplicate ID `#pendingCount` | En sidebar y kanban — uno queda desactualizado |
| Dos botones "Run" | Content-header (HTMX) + task-details (HTMX) |
| Terminal solo visible en Prompt Studio | Si el usuario está en Tasks y hace Run, no ve output |

### Problemas — Deuda técnica

| Problema | Síntoma |
|---|---|
| Inline styles | Todos los bug fixes usaron `style=""` directo |
| `projectGoal` en Stats + `promptInput` en Prompt | Dos inputs para el mismo dato (el goal) |
| `projectInitBtn` en Stats + `createProjectBtn` en header | Dos rutas de init distintas |
| HTMX en Run + fetch JS en Create Project | Dos paradigmas mezclados |
| Indentación inconsistente en HTML | Mezcla de 2, 4 y 6 espacios |
| `shell` con `max-width: 1200px` + padding excesivo | Terminal se corta en pantallas < 1400px |

---

## NUEVA ARQUITECTURA PROPUESTA

### Layout general

```
┌─────────────────────────────────────────────────────────────┐
│ ◈ OrchestOS  [planning · iter 0/20]         [Config] [EN]  │  ← 44px sticky
├──────┬──────────────────────────────────────────────────────┤
│  ▶   │                                                       │
│  ──  │  EXECUTE   │  TASKS   │  OBSERVE   │  SKILLS  │ MEM │
│  nav │ ─────────────────────────────────────────────────── │
│ icon │                                                       │
│      │  [Execute tab — default]                              │
│  sta │  ┌────────────────────────┐  ┌───────────────────┐   │
│  tus │  │  Goal / Prompt         │  │  Terminal Output  │   │
│      │  │  (textarea que crece)  │  │  (scroll interno) │   │
│  [0] │  │                        │  │                   │   │
│  pnd │  └────────────────────────┘  └───────────────────┘   │
│      │  [Create Project] [Generate Tasks] [Run ▶]           │
└──────┴──────────────────────────────────────────────────────┘
```

### Tabs finales (7 → 5)

| Tab anterior | Acción | Tab nuevo |
|---|---|---|
| Prompt Studio | Renombrar + restructurar | **Execute** |
| Tasks | Mantener igual | **Tasks** |
| Stats | Limpiar: solo monitoring | **Observe** |
| Skills | Mantener igual | **Skills** |
| Memory | Mantener igual | **Memory** |
| Project | Eliminar | → fusionar en Config |
| Commands | Eliminar | → mover al botón `?` |

### Config (no tab — panel/modal en header)

Al hacer clic en `[Config]` en el header. Contiene:
```
  ├── Project Root  (input + browse)
  ├── Project Goal  (input único)
  ├── API Keys      (openrouter key)
  └── Memory        (engram status + test)
```

### Sidebar nuevo (52px, solo iconos)

```
▶  Execute
☰  Tasks
📡 Observe
⚡ Skills
🗂 Memory
```

Status y pending count pasan al global header como badges compactos.

### Execute tab — split pane

```css
#tab-execute {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr auto;
  gap: 16px;
  height: calc(100vh - 44px - 32px);
}
.prompt-pane textarea { flex: 1; resize: none; }
.terminal-pane { overflow-y: auto; }
.execute-actions { display: flex; gap: 8px; }
```

---

## ELEMENTOS A ELIMINAR

| Elemento | Razón |
|---|---|
| **Tab Commands** | Documentación, no interacción → va al `?` help |
| **Tab Project** | Project Files/Editor no están en el flujo normal |
| **`savePromptBtn`** | No conectado a nada crítico, nadie sabe qué hace |
| **`sendPromptBtn`** | Sin acción definida |
| **`projectInitBtn` en Stats** | Duplica `createProjectBtn` |
| **`projectGoal` input en Stats** | Duplica `promptInput` |
| **"Next Steps" checklist** | Estática, nunca actualizada |
| **`.brand` en sidebar** | Global header ya tiene brand |
| **`Controls` panel en Stats** | Debug tool de desarrollo, no feature |
| **`.topbar` CSS** | Ya no se usa |

---

## PLAN DE IMPLEMENTACIÓN

### ✅ COMPLETADO ANTES DE v7 (bugs v6)

- [x] BUG-1/6: Path absoluto a runner.js (`RUNNER` const)
- [x] BUG-2: Create Project ahora hace init + run (`/project/start`)
- [x] BUG-3: Empty state en kanban ("No tasks yet...")
- [x] BUG-4: Auto-planner LLM (`src/integrations/auto-planner.js`)
- [x] BUG-5: Engram UX — panel Memory con badge, mensajes no alarmistas
- [x] API Keys panel en Stats (OpenRouter key → `.env`)

---

### SEMANA 1 — Impacto visual máximo, sin romper flujo

**Objetivo**: Que el dashboard se vea y sienta como una estación de control real.

#### TASK S1.1 — Eliminar content-header global; mover botones al tab Execute
- **Archivo**: `index.html`
- **Quitar**: `<header class="content-header">` con Run, Save, Create Project
- **Mover**: Create Project, Generate Tasks, Run → `.execute-actions` dentro del tab Execute
- **Estado**: ✅ completado 2026-04-14

#### TASK S1.2 — Restructurar sidebar a 52px con iconos
- **Archivos**: `index.html`, `dashboard.css`
- **Cambios**: nav-item a solo icono con `title=""` tooltip; `.brand` del sidebar oculto vía CSS; `.shell.layout` a `56px 1fr`
- **Estado**: ✅ completado 2026-04-14

#### TASK S1.3 — Restructurar tab Execute en split pane
- **Archivos**: `index.html`, `dashboard.css`
- **Cambios**: `.execute-layout` grid 2 cols; `.execute-textarea` con `flex:1`; `.terminal-pane` col derecha; botones en `.execute-actions`
- **Estado**: ✅ completado 2026-04-14

#### TASK S1.4 — Eliminar tab Commands
- **Archivo**: `index.html`
- **Cambios**: nav-item eliminado; `<section id="tab-commands">` eliminado
- **Estado**: ✅ completado 2026-04-14

#### TASK S1.5 — Eliminar tab Project
- **Archivo**: `index.html`
- **Cambios**: nav-item eliminado; `<section id="tab-project">` eliminado; `projectGoal` y `projectInitBtn` (duplicados) también eliminados
- **Estado**: ✅ completado 2026-04-14

#### TASK S1.6 — Fixear ID collision `#pendingCount`
- **Archivo**: `index.html`
- **Cambios**: sidebar usa `#sidebarPendingCount`; JS actualizado en la referencia del sidebar
- **Estado**: ✅ completado 2026-04-14

#### TASK S1.7 — Limpiar JS: referencias muertas + nuevo #runBtn
- **Archivo**: `index.html`
- **Eliminados**: `savePromptBtn`, `sendPromptBtn`, `filesRefreshBtn`, `fileLoadBtn`, `fileSaveBtn` y sus handlers; claves i18n obsoletas (`tab_project`, `tab_commands`, `project_goal`, `next_steps`, etc.)
- **Añadido**: handler de `#runBtn` → `POST /api/v1/execute` con spinner y toast
- **Estado**: ✅ completado 2026-04-14

---

### SEMANA 2 — Consolidar configuración

#### TASK S2.1 — Crear panel Config (off-canvas)
- Botón `[Config]` en global header
- Panel deslizable desde la derecha con: project root, goal, API keys, memory
- Mover contenido de config desde Stats

#### TASK S2.2 — Renombrar Stats → Observe, limpiar
- Quitar: Controls (phase/status override), Project Root, API Keys
- Dejar: Realtime Feed, Memory status, métricas de estado

#### TASK S2.3 — Eliminar elementos muertos
- `savePromptBtn`, `sendPromptBtn`, `projectInitBtn`, `projectGoal`
- "Next Steps" checklist
- `.brand` del sidebar

---

### SEMANA 3 — Deuda técnica

#### TASK S3.1 — Limpiar inline styles → clases CSS
- Mover todos los `style=""` de bug fixes a `dashboard.css`

#### TASK S3.2 — Eliminar HTMX del botón Run
- Usar fetch JS como el resto de las acciones

#### TASK S3.3 — Indentación consistente del HTML

---

## CRITERIO DE DONE PARA SEMANA 1

- [x] No hay content-header con botones flotantes
- [x] Sidebar ocupa ≤ 60px (56px)
- [x] Tab Execute tiene prompt a la izquierda y terminal a la derecha
- [x] Textarea crece para llenar el espacio disponible
- [x] Botones Create Project / Generate Tasks / Run están en la fila de acciones del tab Execute
- [x] Tab Commands eliminado
- [x] Tab Project eliminado
- [x] No hay ID duplicado `#pendingCount`
- [ ] El dashboard carga sin errores en consola  ← **VERIFICAR en browser**
