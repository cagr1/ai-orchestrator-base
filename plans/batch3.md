BATCH RC1

Objective:
Eliminar la recursión circular en resolución de project_root/dashboard config dentro del dashboard service.
Files:
[dashboard-service.js](/e:/Carlos/Development Tools/Proyectos/Agents/ai-orchestrator-base/src/web/services/dashboard-service.js)
Functions involved:
getActiveRoot, getPaths, getDashboardConfig, updateDashboardConfig
Exact structural change:
Definir una sola dirección de resolución sin ciclos:
getDashboardConfig debe leer system/dashboard.json del root base del dashboard (rootDir) directamente, sin llamar getPaths.
getActiveRoot debe derivar project_root desde getDashboardConfig (fallback rootDir).
getPaths debe derivar rutas usando getActiveRoot (y nunca llamar de vuelta a getDashboardConfig).
updateDashboardConfig debe escribir dashboard.json en ruta fija base (rootDir/system/dashboard.json), no en una ruta derivada de getPaths.
What dependency/call must be removed:
Quitar el llamado getDashboardConfig -> getPaths (actualmente en getDashboardConfig), que cierra el ciclo getPaths -> getActiveRoot -> getDashboardConfig -> getPaths.
Expected behavior after fix:
No RangeError: Maximum call stack size exceeded; /dashboard/data, /api/v1/status, /api/v1/project, /api/v1/project/start responden sin recursión.
Manual validation:
Abrir dashboard sin crash.
GET /api/v1/project devuelve config.
POST /api/v1/project guarda project_root.
GET /api/v1/status y GET /api/v1/tasks responden normalmente tras guardar project_root.
POST /api/v1/project/start ya no falla por stack overflow.
BATCH RC2

Objective:
Corregir la captura y persistencia de project_root para que sea una ruta usable en runtime y no nombre de carpeta de upload.
Files:
[index.html](/e:/Carlos/Development Tools/Proyectos/Agents/ai-orchestrator-base/src/web/public/dashboard/index.html), [api.js](/e:/Carlos/Development Tools/Proyectos/Agents/ai-orchestrator-base/src/web/routes/api.js), [dashboard-service.js](/e:/Carlos/Development Tools/Proyectos/Agents/ai-orchestrator-base/src/web/services/dashboard-service.js)
Exact structural change:
Remover el mecanismo de input type=file + webkitdirectory como fuente de project_root.
Usar el campo de texto #projectPath como fuente explícita de ruta para POST /api/v1/project y POST /api/v1/project/start.
Mantener validación backend mínima de ruta recibida antes de persistir/usar.
Asegurar que project_root guardado sea el mismo que luego usa initProject/triggerRun/generateTasks.
Expected behavior after fix:
El valor mostrado en projectPath, el valor persistido y la raíz usada por runtime coinciden; no se guarda solo el nombre de carpeta.
Manual validation:
Escribir ruta completa en projectPath y guardar.
Recargar dashboard: projectPath conserva esa ruta.
Ejecutar Create Project: init/plan/run usan esa ruta (ver archivos system/* en esa raíz).
Confirmar que no se usa webkitRelativePath.split('/')[0].
BATCH RC3

Objective:
Unificar fuente de verdad de provider/model para planner y runner en el mismo system/config.json del runtime activo.
Files:
[providers/openrouter.js](/e:/Carlos/Development Tools/Proyectos/Agents/ai-orchestrator-base/providers/openrouter.js), [runner.js](/e:/Carlos/Development Tools/Proyectos/Agents/ai-orchestrator-base/runner.js), [auto-planner.js](/e:/Carlos/Development Tools/Proyectos/Agents/ai-orchestrator-base/src/integrations/auto-planner.js)
Exact structural change:
Evitar que providers/openrouter.js lea configuración fija desde ../system/config.json del repo.
Pasar al provider la configuración runtime efectiva (provider activo + model mapping) desde el flujo que invoca (runner/planner) basado en el root activo.
Mantener OPENROUTER_API_KEY desde process.env como fuente de credencial.
Alinear planner y runner al mismo contrato de selección de modelo/provider.
Expected behavior after fix:
Planner y runner resuelven modelo/proveedor desde la misma configuración runtime del proyecto activo; no hay dependencia implícita al system/config.json del repo root.
Manual validation:
Definir un mapeo/modelo distintivo en system/config.json del root activo.
Generar plan y ejecutar tarea.
Verificar en logs/resultado que ambos caminos usan ese mapeo activo.
Confirmar que opencode.json no participa en resolución runtime.