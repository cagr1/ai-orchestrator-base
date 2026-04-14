---

## 6. PROBLEMAS DETECTADOS EN USO REAL (post v6-improvement — 2026-04-14)

> Sesión de prueba manual: usuario escribe goal en Prompt Studio, presiona "Create Project",
> espera tasks. Resultado: tasks en loading permanente, no se generan, no se ejecutan.

### BUG-1 — `initProject` usa `execSync` bloqueante sin timeout y con CWD incorrecto
- **Archivo**: `src/web/services/dashboard-service.js` línea 163
- **Síntoma**: El botón "Create Project" no genera tareas. El call a `execSync` corre
  `node runner.js init` en `project_root` (el path configurado en el dashboard), pero
  `runner.js` solo existe en el directorio raíz del repo — si `project_root` es distinto,
  el proceso falla silenciosamente. Además `execSync` sin timeout puede colgar el servidor.
- **Fix**: Usar siempre el path absoluto a `runner.js` (del repo), y pasar el `cwd` como
  argumento o variable de entorno. Ejemplo:
  ```javascript
  const RUNNER = path.join(__dirname, '../../..', 'runner.js');
  execSync(`node "${RUNNER}" init "${goal}"`, { cwd: rootDir, timeout: 15000, encoding: 'utf-8' });
  ```

### BUG-2 — "Create Project" no arranca el runner después de init
- **Archivo**: `src/web/public/dashboard/index.html` línea 970 / `src/web/routes/api.js` línea 47
- **Síntoma**: El botón solo llama a `/api/v1/project/init` (que hace `runner.js init`),
  pero nunca llama a `/api/v1/execute` (que hace `runner.js run`). El usuario ve el goal
  guardado en Stats, pero el runner no arranca, no se generan tareas, y el terminal
  queda vacío. El flujo completo debería ser: init → run (en ese orden).
- **Fix**: Después de `init` exitoso, hacer POST a `/api/v1/execute` automáticamente,
  o exponer un endpoint combinado `/api/v1/project/start` que haga ambas operaciones.

### BUG-3 — Tasks siempre en "loading" — `getTasks` devuelve array vacío hasta que hay `tasks.yaml` con tareas reales
- **Archivo**: `src/web/services/dashboard-service.js` línea 59 / `src/web/public/dashboard/index.html`
- **Síntoma**: Después de `runner.js init`, el `tasks.yaml` generado es un template vacío
  (0 tareas reales). El dashboard muestra spinner/loading infinito porque `renderTasks([])`
  no tiene estado vacío visual claro — el usuario no sabe si está cargando o si no hay tareas.
- **Fix**: 
  1. Añadir empty state en el kanban: "No tasks yet. Run the planner to generate tasks."
  2. El verdadero problema es que no hay auto-planner: `runner.js init` solo crea el
     template pero no genera tareas. Se necesita que el LLM o el usuario provea un
     `tasks.yaml` con tareas reales antes de que `run` tenga algo que ejecutar.

### BUG-4 — No existe flujo LLM end-to-end: el sistema no genera tareas desde un goal
- **Componente**: Ausente — no existe `auto-planner.js` ni integración LLM en el planner
- **Síntoma**: El usuario escribe "realiza una landing page para una empresa de seguridad",
  presiona Create Project, y no pasa nada útil. El sistema necesita un LLM que lea
  `system/goal.md` y produzca `system/tasks.yaml` con tareas concretas.
- **Opciones de fix** (en orden de complejidad):
  1. **Manual (mínimo viable)**: Después de "Create Project", mostrar instrucciones claras
     de que el usuario debe editar `tasks.yaml` manualmente o usar el editor del dashboard.
  2. **Semi-automático**: Añadir botón "Generate Tasks" que llame a un endpoint que use
     el LLM configurado (OpenRouter/OpenAI) con el goal como prompt para generar el YAML.
  3. **Automático**: Implementar `auto-planner.js` que use el LLM para generar tareas
     al hacer `runner.js plan`.

### BUG-5 — Engram status: "not responding" en el dashboard
- **Archivo**: `src/web/routes/api.js` línea 106 / `src/web/public/dashboard/index.html`
- **Síntoma**: El panel "Engram Status" en tab Stats muestra error. Engram es un servicio
  externo que no está corriendo (ni instalado). El error es esperado pero la UX es mala:
  el usuario ve un error rojo sin instrucciones de qué hacer.
- **Fix**:
  1. Mejorar el mensaje de error para que explique claramente que Engram es opcional.
  2. Cuando Engram no responde y `config.json` tiene `provider: "engram"`, cambiar
     automáticamente a `provider: "file"` en la UI y mostrar badge "Using local memory".
  3. El botón "Install Engram" ya existe pero solo muestra instrucciones en texto —
     podría ejecutar el comando directamente si el OS lo permite.

### BUG-6 — `triggerRun` usa CWD incorrecto cuando `project_root ≠ rootDir`
- **Archivo**: `src/web/services/dashboard-service.js` línea 107
- **Síntoma**: `spawn('node', ['runner.js', 'run'], { cwd: activeRoot })` asume que
  `runner.js` existe en `activeRoot`. Solo existe en el root del repo. Si el usuario
  configura un `project_root` diferente, el proceso falla con "Cannot find module".
- **Fix**: Usar path absoluto al runner igual que BUG-1:
  ```javascript
  const RUNNER = path.join(__dirname, '../../..', 'runner.js');
  spawn('node', [RUNNER, 'run'], { cwd: rootDir });
  ```

---

### ORDEN DE EJECUCIÓN SUGERIDO (próxima sesión)

```
BUG-1 → BUG-6 → BUG-2 → BUG-3 → BUG-5 → BUG-4
```

- BUG-1 y BUG-6 son el mismo problema de path — resolverlos juntos desbloquea todo lo demás.
- BUG-2 conecta init con run — sin esto el botón nunca ejecuta nada.
- BUG-3 mejora la UX mientras se espera el planner.
- BUG-5 es UX del Engram — no bloquea el flujo principal.
- BUG-4 es la feature más grande — el auto-planner LLM.

---

## 1. CURRENT STATE SUMMARY

### ✅ Funciona completamente
| Componente | Estado | Evidencia |
|---|---|---|
| `runner.js` core (init/run/resume/status/fail/done/retry) | ✅ | Tests pasan, lógica sólida |
| Sistema de tareas (`tasks.yaml` CRUD, validaciones R9/R10/R11) | ✅ | 13 archivos de test, todos OK excepto 1 |
| Lock TTL, batch selection, cooldown, dependency cycles | ✅ | Phases 1-18 tests |
| Dashboard server (Express, inicia en `:3000`) | ✅ | Levanta sin errores |
| API REST `/api/v1/*` (todas las rutas) | ✅ | Código completo, estructura correcta |
| WebSocket hub (`/api/v1/ws`) | ✅ | Implementado y funcional |
| `dashboard-service.js` (bridge orquestador↔UI) | ✅ | Todas las operaciones implementadas |
| Autoskills adapter | ✅ | Integrado en runner.js |
| Memory manager (file + Engram fallback) | ✅ | Funcional, con compaction |

### ⚠️ Parcialmente implementado
| Componente | Problema |
|---|---|
| **Test de compaction** (`phase_memory_compaction.test.js` Test 10) | Falla: `appendToMemoryWithCompaction` no actualiza `countEntries` correcto post-append |
| **CSS del dashboard** (`dashboard.css`) | El bloque duplicado "CORREGIDO" fue parcialmente eliminado — verificar que quedó limpio |
| **HTML del dashboard** | Carga HTMX/Hyperscript desde CDN (unpkg) en lugar de local `/assets/` |
| **`global-header`** | El HTML tiene la clase pero no existe estilo en `dashboard.css` |
| **`prompt-editor`** | Div con clase en HTML, sin estilo definido en CSS |
| **WebSocket en frontend** | El JS del dashboard conecta al WS pero el evento `terminal:output` no tiene panel receptor en el HTML |
| **`triggerRun()`** | Usa `spawn`, transmite output via WS, pero el frontend no tiene ningún elemento que lo muestre |

### ❌ Roto / No implementado
| Componente | Problema Exacto |
|---|---|
| **Una parte del CSS duplicado puede seguir ahí** | El `multi_edit` falló, el `single_find_and_replace` removió el comentario pero el cuerpo del segundo bloque aún puede estar presente |
| **Terminal output panel** | No existe en el HTML. `triggerRun()` emite `terminal:output` via WS pero nadie lo consume en UI |
| **`/dashboard/data`** | Ruta existe y funciona, pero `init_project` usa `execSync` bloqueante sin timeout |
| **Auto-planner** | No existe ningún archivo `auto-planner.js` ni integración LLM en el planner |
| **Dockerfile / CI** | No existen |
| **`start-orchestos.js`** | Existe en raíz pero no fue inspeccionado |

---

## 2. DEFINITION OF DONE (qué significa "completo")

**Mínimo viable estricto** — nada más:

1. `npm test` pasa al 100% (todos los tests, sin fallo)
2. `npm run dashboard` levanta sin errores en Windows
3. El dashboard muestra estado real del sistema (status, tasks, memoria)
4. El botón "Run" del dashboard ejecuta `runner.js run` y muestra output en tiempo real
5. El CSS está limpio (sin duplicados), la UI es usable
6. La carga de assets es local (sin dependencia de CDN)
7. Los 3 cambios UI solicitados están aplicados: header con lang-toggle, textarea full-width, panel-headers compactos

---

## 3. PHASES

| Phase | Objetivo | Output testeable |
|---|---|---|
| **P1** | Reparar test fallido + verificar todos los tests pasan | `npm test` = 100% OK |
| **P2** | Limpiar CSS definitivamente + aplicar 3 mejoras UI | Dashboard visualmente correcto en navegador |
| **P3** | Corregir carga de assets (CDN → local) + `global-header` styles | DevTools sin errores de red, HTMX funciona offline |
| **P4** | Terminal output panel funcional en frontend | Click "Run" → output aparece en UI en tiempo real |
| **P5** | Smoke test end-to-end completo | Flujo init→run→dashboard funciona sin tocar terminal |

---

## 4. TASK LIST

### PHASE 1 — Reparar test fallido

#### TASK 1.1 — Diagnosticar fallo exacto en test de compaction
- **Archivo**: `tests/phase_memory_compaction.test.js` línea 189
- **Acción**: Leer el test, leer `memory-manager.js::appendWithCompaction`, identificar por qué `countEntries` retorna valor incorrecto post-append
- **Expected**: El test espera `count === 6` después de hacer append de una entrada a un file con 5 entradas
- **Sospecha**: `appendWithCompaction` cuando `provider === 'file'` hace `append(content)` pero el contenido que se pasa es `"## Entry 6\n- Task: T6\n"` sin newline final — puede contar mal los `##`
- **Cómo verificar**: `node -e "const m = require('./src/integrations/memory-manager.js'); ..."` ad-hoc

#### TASK 1.2 — Aplicar fix en `memory-manager.js`
- **Archivo**: `src/integrations/memory-manager.js`
- **Cambio**: En `append()`, asegurar que el contenido siempre termina con `\n` antes de concatenar, para que `countEntries` detecte correctamente los `##` en línea nueva
- **Verificar**: `node tests/run-all.js` → `=== ALL TESTS PASSED ===`

---

### PHASE 2 — Limpiar CSS + aplicar 3 mejoras UI

#### TASK 2.1 — Verificar estado actual de `dashboard.css`
- **Archivo**: `src/web/public/assets/dashboard.css`
- **Acción**: Leer el archivo completo y confirmar que el bloque duplicado fue eliminado (buscar `:root { --bg-primary` o `font-family: 'Inter'`)
- **Expected**: Sólo un bloque `:root`, sólo `Space Grotesk`, sin `--bg-primary`
- **Si aún hay duplicado**: Usar `multi_edit` para eliminar desde el segundo `:root {` hasta el final

#### TASK 2.2 — Añadir estilos para `.global-header`
- **Archivo**: `src/web/public/assets/dashboard.css` (al final, antes del `@media`)
- **Cambio**: Añadir estos estilos exactos:
```css
/* Global Header */
.global-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 24px;
  background: var(--panel);
  border-bottom: 1px solid rgba(148, 163, 184, 0.15);
  position: sticky;
  top: 0;
  z-index: 100;
}
.global-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  font-size: 16px;
}
.global-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}
.global-btn {
  background: transparent;
  border: 1px solid rgba(148,163,184,0.3);
  color: var(--muted);
  padding: 4px 10px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 12px;
  font-family: inherit;
  transition: all 0.2s;
}
.global-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}
/* Prompt editor */
.prompt-editor {
  display: grid;
  gap: 10px;
}
.prompt-editor .textbox.xl {
  width: 100%;
  box-sizing: border-box;
}
.prompt-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
/* Panel header compacto */
.panel-header {
  padding-bottom: 10px;
  min-height: unset;
}
```
- **Verificar**: Abrir `http://localhost:3000` → header visible arriba con botón lang, textarea ocupa ancho completo

#### TASK 2.3 — Ajustar el `shell.layout` para respetar el header global
- **Archivo**: `src/web/public/assets/dashboard.css`
- **Cambio**: El `.shell` tiene `padding: 40px 24px 60px` — con el header sticky esto causa solapamiento. Cambiar a `padding: 20px 24px 60px`
- **Verificar**: No hay solapamiento visual entre header y contenido

---

### PHASE 3 — Corregir carga de assets

#### TASK 3.1 — Cambiar CDN por assets locales en index.html
- **Archivo**: `src/web/public/dashboard/index.html`
- **Cambio**: Reemplazar:
  ```html
  <script src="https://unpkg.com/htmx.org@1.9.12"></script>
  <script src="https://unpkg.com/hyperscript.org@0.9.12"></script>
  ```
  Por:
  ```html
  <script src="/assets/htmx.min.js"></script>
  <script src="/assets/_hyperscript.min.js"></script>
  ```
- **Verificar**: DevTools → Network tab → no hay requests a `unpkg.com`

#### TASK 3.2 — Verificar que los archivos locales existen y tienen contenido válido
- **Archivos**: `src/web/public/assets/htmx.min.js`, `src/web/public/assets/_hyperscript.min.js`
- **Acción**: Verificar tamaño (`ls -la` o PowerShell `Get-Item`)
- **Expected**: Ambos > 50KB
- **Si están vacíos o faltan**: Copiar desde `node_modules` si existe, o descargar

---

### PHASE 4 — Terminal output panel

#### TASK 4.1 — Añadir panel de terminal output en el HTML
- **Archivo**: `src/web/public/dashboard/index.html`
- **Ubicación**: Dentro de `<section id="tab-stats">`, añadir un panel nuevo después del "Realtime Feed":
  ```html
  <div class="panel">
    <div class="panel-header">
      <h2>Terminal Output</h2>
      <button class="btn ghost" id="clearTerminalBtn">Clear</button>
    </div>
    <div class="terminal" id="terminalOutput">
      <div class="terminal-line info">Ready. Click Run to start.</div>
    </div>
  </div>
  ```
- **Verificar**: Visible en tab Stats

#### TASK 4.2 — Conectar WebSocket a panel terminal en el JS del dashboard
- **Archivo**: `src/web/public/dashboard/index.html` (bloque `<script>`)
- **Cambio**: En la función `connectRealtime()`, añadir handler para el evento `terminal:output`:
  ```javascript
  if (msg.event === 'terminal:output') {
    const terminal = document.getElementById('terminalOutput');
    if (terminal) {
      const line = document.createElement('div');
      line.className = `terminal-line ${msg.payload.type === 'stderr' ? 'error' : 'info'}`;
      line.textContent = msg.payload.data;
      terminal.appendChild(line);
      terminal.scrollTop = terminal.scrollHeight;
    }
  }
  if (msg.event === 'terminal:closed') {
    logEvent(`process exited (code ${msg.payload.code})`);
  }
  ```
- **También**: Añadir handler del botón clear:
  ```javascript
  document.getElementById('clearTerminalBtn').addEventListener('click', () => {
    document.getElementById('terminalOutput').innerHTML = '';
  });
  ```
- **Verificar**: Click "Run" en dashboard → output del runner aparece en el panel Terminal

#### TASK 4.3 — Mover el tab de terminal al tab correcto (Prompt Studio)
- **Razonamiento**: El usuario clickea "Run" desde Prompt Studio, tiene más sentido ver el output ahí
- **Archivo**: `src/web/public/dashboard/index.html`
- **Cambio**: Mover el panel de terminal al final del `<section id="tab-prompt">` en lugar de tab-stats
- **Verificar**: Click Run desde Prompt Studio → output visible en el mismo tab

---

### PHASE 5 — Smoke test end-to-end

#### TASK 5.1 — Test manual completo
- **Acción**: Ejecutar en secuencia:
  1. `node runner.js init "Test project"` → Verifica `system/state.json` actualizado
  2. `npm run dashboard` → Verifica que carga en `http://localhost:3000`
  3. Dashboard muestra status "planning" y 0 tareas
  4. Click "Run" → Panel terminal muestra output del runner
  5. `npm test` → Todos los tests pasan

#### TASK 5.2 — Actualizar `plans/v5-upgrade-high.md` con estado real
- **Archivo**: `plans/v5-upgrade-high.md`
- **Cambio**: Marcar como `[x]` los items completados en esta sesión, añadir fecha

---

## 5. RISKS Y UNKNOWNS

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| **El CSS duplicado sigue ahí parcialmente** | Alta (el `multi_edit` falló) | Alto | TASK 2.1 lo verifica primero con `read_file` antes de editar |
| **`htmx.min.js` local está vacío/corrupto** | Media | Alto | TASK 3.2 verifica tamaño antes; si está roto hay que copiar de unpkg manualmente |
| **Test 10 de compaction falla por race condition async** | Media | Bajo | El fix en TASK 1.2 es sincrónico; si persiste, el test necesita ajuste no el código |
| **`triggerRun()` usa `spawn` con cwd incorrecto** | Media | Medio | Si `activeRoot` es distinto al directorio del proyecto real, el runner no encuentra `system/`. Verificar en TASK 5.1 |
| **`start-orchestos.js`** | Desconocido | Desconocido | Ignorar hasta que los 5 phases estén completos; no bloquea nada |
| **`fetch` global en Node.js** | Baja | Bajo | `engram-client.js` usa `fetch` global — disponible en Node 18+, el `package.json` no especifica engines |

---

## ORDEN DE EJECUCIÓN INMEDIATO

```
TASK 1.1 → 1.2 → [npm test = verde] → 2.1 → 2.2 → 2.3 → 3.1 → 3.2 → 4.1 → 4.2 → 4.3 → 5.1 → 5.2
```

Cada tarea < 20 minutos. Total estimado: **~3 horas** para tener el sistema completamente funcional y testeable.