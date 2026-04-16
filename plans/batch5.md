BATCH 1

Objective: Garantizar que el root runtime siempre sea una ruta explícita y válida del proyecto objetivo.
Files: [index.html](/e:/Carlos/Development Tools/Proyectos/Agents/ai-orchestrator-base/src/web/public/dashboard/index.html), [api.js](/e:/Carlos/Development Tools/Proyectos/Agents/ai-orchestrator-base/src/web/routes/api.js), [dashboard-service.js](/e:/Carlos/Development Tools/Proyectos/Agents/ai-orchestrator-base/src/web/services/dashboard-service.js)
Functions: browseFolderBtn handler, projectSaveBtn handler, updateDashboardConfig, initProject, getActiveRoot
Exact change: Quitar dependencia de webkitRelativePath.split('/')[0]; usar #projectPath textual como única fuente; validar en backend (no vacío, absoluta, existente/directorio o política clara de creación); rechazar /execute si no hay root válido en vez de caer al repo root.
Manual validation: Guardar ruta absoluta en projectPath, recargar dashboard, confirmar persistencia exacta y ejecución en esa raíz (archivos en <root>/system/*).

BATCH 2
Objective: Corregir flujo de ejecución para que el sistema sepa cuándo iniciar, reanudar o exigir reset, evitando halts confusos.
Files: [api.js](/e:/Carlos/Development Tools/Proyectos/Agents/ai-orchestrator-base/src/web/routes/api.js), [dashboard-service.js](/e:/Carlos/Development Tools/Proyectos/Agents/ai-orchestrator-base/src/web/services/dashboard-service.js), [runner.js](/e:/Carlos/Development Tools/Proyectos/Agents/ai-orchestrator-base/runner.js), [index.html](/e:/Carlos/Development Tools/Proyectos/Agents/ai-orchestrator-base/src/web/public/dashboard/index.html)
Functions: triggerRun, /execute, /resume, ensureSessionBaseline, loop auto-exec (updateTask usage), appendRunHistory
Exact change: Soportar explícitamente run vs resume en API/servicio; hacer que Resume invoque runner resume; agregar criterio backend para “fresh start requerido”; corregir updateTask(tasksDoc, task) por actualización válida con metadata; registrar historial después del batch ejecutado.
Manual validation: Caso pausado → Resume real reanuda; caso sesión vieja → sistema indica reset/start; Run no cae a no_executable_tasks por estado stale cuando sí hay trabajo pendiente.

BATCH 3
Objective: Unificar visibilidad y control del dashboard con una sola fuente de verdad de estado runtime.
Files: [dashboard-service.js](/e:/Carlos/Development Tools/Proyectos/Agents/ai-orchestrator-base/src/web/services/dashboard-service.js), [views.js](/e:/Carlos/Development Tools/Proyectos/Agents/ai-orchestrator-base/src/web/routes/views.js), [index.html](/e:/Carlos/Development Tools/Proyectos/Agents/ai-orchestrator-base/src/web/public/dashboard/index.html), [runner.js](/e:/Carlos/Development Tools/Proyectos/Agents/ai-orchestrator-base/runner.js)
Functions: getStatus, getTasks, getRunHistory, loadInitial, renderTasks, renderStatus, renderRunHistory, logEvent
Exact change: Exponer snapshot unificado (state + task counts + halt_reason + ejecutables); usarlo para Header/Kanban/Execution/Observe; dejar de depender de runs/<id>/tasks.yaml inexistente o comenzar a escribirlo explícitamente en runner.
Manual validation: Los contadores de header, columnas kanban, execution tab y observe coinciden en un mismo momento de ejecución y tras eventos websocket.