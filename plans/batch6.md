FIX PLAN

BATCH 1

Objective: Asegurar que lo que se guarda como project_root sea siempre una ruta absoluta válida y exactamente la que el usuario quiere.
Files: [index.html](/e:/Carlos/Development Tools/Proyectos/Agents/ai-orchestrator-base/src/web/public/dashboard/index.html), [dashboard-service.js](/e:/Carlos/Development Tools/Proyectos/Agents/ai-orchestrator-base/src/web/services/dashboard-service.js), [api.js](/e:/Carlos/Development Tools/Proyectos/Agents/ai-orchestrator-base/src/web/routes/api.js)
Functions: handler browseFolderBtn, handler projectSaveBtn, updateDashboardConfig, endpoint POST /project
Exact change: Eliminar captura basada en webkitRelativePath.split('/')[0]; usar #projectPath textual como única fuente; mantener validación estricta backend de absoluta/normalizada y respuesta de error explícita al guardar inválido.
Manual validation:
Escribir ruta absoluta manual en projectPath y guardar.
Confirmar system/dashboard.json contiene exactamente esa ruta.
Recargar dashboard y verificar que se re-renderiza igual.

BATCH 2

Objective: Garantizar que ejecución y resume usen de forma confiable el project_root persistido.
Files: [api.js](/e:/Carlos/Development Tools/Proyectos/Agents/ai-orchestrator-base/src/web/routes/api.js), [dashboard-service.js](/e:/Carlos/Development Tools/Proyectos/Agents/ai-orchestrator-base/src/web/services/dashboard-service.js)
Functions: triggerRun, endpoints POST /execute, POST /resume, export del servicio
Exact change: Corregir el contrato API/servicio para que la validación de root no dependa de método no exportado (getPaths) y se valide desde una función pública estable (getActiveRoot/equivalente); mantener triggerRun(... --root activeRoot) como única vía.
Manual validation:
Con root guardado válido, Run y Resume responden ok y ejecutan sobre ese root.
Sin root válido, Run/Resume devuelven error controlado (sin crash de ruta).
Verificar que system/state.json, system/tasks.yaml y system/evidence/* se escriben en el root seleccionado.