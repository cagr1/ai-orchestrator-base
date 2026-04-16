BATCH 1

Objective: Limpiar UX de project_root para que la ruta objetivo externa se capture manualmente, se guarde explícitamente y se comunique sin ambigüedad.
Files: [index.html](/e:/Carlos/Development Tools/Proyectos/Agents/ai-orchestrator-base/src/web/public/dashboard/index.html), [dashboard-service.js](/e:/Carlos/Development Tools/Proyectos/Agents/ai-orchestrator-base/src/web/services/dashboard-service.js), [api.js](/e:/Carlos/Development Tools/Proyectos/Agents/ai-orchestrator-base/src/web/routes/api.js)
Functions/components: #projectPath, #projectSaveBtn, browseFolderBtn handler, copy/textos de panel Config, updateDashboardConfig, getDashboardConfig, /api/v1/project, /dashboard/data
Exact change:
Quitar Browse como mecanismo primario (retirar botón/handler de selección por input type=file con webkitdirectory).
Mantener projectPath como input manual de ruta absoluta.
Mantener Save como única acción de persistencia (POST /api/v1/project).
Ajustar copy UI a:
“Target project root”
“External project path”
“OrchestOS runs against this folder”
Mantener validación backend de absoluta y persistencia en system/dashboard.json, devolviendo error claro si inválida.
Manual validation:
Escribir ruta absoluta externa en projectPath y pulsar Save.
Verificar que system/dashboard.json guarda exactamente esa ruta.
Recargar dashboard y confirmar que projectPath se rellena con la misma ruta desde /dashboard/data.
Ejecutar Create Project y Run; confirmar que runtime usa ese root y no ruta de upload-style prompt.

BATCH 2

Objective: Exponer y alinear configuración efectiva de provider/model que realmente usa runtime, y pasar defaults a modelo pago low-cost (MiniMax M2.7).
Files: [providers/openrouter.js](/e:/Carlos/Development Tools/Proyectos/Agents/ai-orchestrator-base/providers/openrouter.js), [runner.js](/e:/Carlos/Development Tools/Proyectos/Agents/ai-orchestrator-base/runner.js), [auto-planner.js](/e:/Carlos/Development Tools/Proyectos/Agents/ai-orchestrator-base/src/integrations/auto-planner.js), [dashboard-service.js](/e:/Carlos/Development Tools/Proyectos/Agents/ai-orchestrator-base/src/web/services/dashboard-service.js), [api.js](/e:/Carlos/Development Tools/Proyectos/Agents/ai-orchestrator-base/src/web/routes/api.js), [index.html](/e:/Carlos/Development Tools/Proyectos/Agents/ai-orchestrator-base/src/web/public/dashboard/index.html), [config.json](/e:/Carlos/Development Tools/Proyectos/Agents/ai-orchestrator-base/system/config.json)
Functions/components: callOpenRouter, runLLM, planner model selection in generateTasks, runtime config loading (system/config.json del root activo), Config panel (read-only/controlled fields), endpoint de runtime config efectivo
Exact change:
Eliminar dependencia fija de providers/openrouter.js a repo/system/config.json; pasarle config efectiva del root activo (provider activo + model_mapping + provider models).
Mantener OPENROUTER_API_KEY desde process.env.
Definir defaults efectivos:
model_mapping.planner -> key low-cost que resuelve a minimax/minimax-m2.7
model_mapping.default -> misma key low-cost (para ejecución runtime por defecto)
Exponer en dashboard (sin discovery dinámico):
active_provider efectivo
model_mapping efectivo que usa planner/runner
modelo resuelto para planner/default
Persistir solo en system/config.json del runtime activo.
Manual validation:
En root activo, configurar mapping default/planner a MiniMax M2.7.
Generar plan y ejecutar run.
Verificar en logs/resultado que planner y runner usan provider/model del mismo system/config.json activo.
Verificar en dashboard que provider y mappings mostrados coinciden con archivo efectivo y persisten tras recarga.