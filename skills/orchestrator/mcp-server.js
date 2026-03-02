/**
 * MCP Server - Integración con Model Context Protocol
 * 
 * Este servidor expone las herramientas del Project Manager como herramientas MCP.
 * Optimizado para reducir tokens manteniendo el contexto necesario.
 * 
 * Uso:
 *   node mcp-server.js
 * 
 * O integrado con otro servidor MCP
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ORCHESTRATOR_DIR = path.join(__dirname, 'projects');

// ==================== HELPERS ====================

function loadIndex() {
  const indexPath = path.join(ORCHESTRATOR_DIR, '_index.json');
  return JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
}

function loadProjectState(projectId) {
  const statePath = path.join(ORCHESTRATOR_DIR, projectId, 'state.json');
  if (!fs.existsSync(statePath)) return null;
  return JSON.parse(fs.readFileSync(statePath, 'utf-8'));
}

function loadTasks(projectId) {
  const tasksPath = path.join(ORCHESTRATOR_DIR, projectId, 'tasks.json');
  if (!fs.existsSync(tasksPath)) return null;
  return JSON.parse(fs.readFileSync(tasksPath, 'utf-8'));
}

function loadDecisions(projectId) {
  const decisionsPath = path.join(ORCHESTRATOR_DIR, projectId, 'decisions.json');
  if (!fs.existsSync(decisionsPath)) return null;
  return JSON.parse(fs.readFileSync(decisionsPath, 'utf-8'));
}

function loadAgentRegistry() {
  const registryPath = path.join(__dirname, 'agents', 'registry.json');
  return JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
}

function getCurrentProject() {
  const index = loadIndex();
  return index.projects.find(p => p.id === index.last_active);
}

// ==================== MCP TOOLS ====================

/**
 * Obtener estado actual del proyecto
 * Contexto: ~50 tokens
 */
function getProjectStatus() {
  const project = getCurrentProject();
  if (!project) {
    return { error: 'No hay proyecto activo' };
  }

  const state = loadProjectState(project.id);
  const tasks = loadTasks(project.id);

  return {
    project: project.name,
    id: project.id,
    phase: project.phase,
    health: project.health,
    stack: project.stack,
    url: project.url,
    metrics: {
      completed: tasks?.completed_count || 0,
      pending: tasks?.pending_count || 0,
      in_progress: tasks?.in_progress_count || 0
    },
    top_priority: state?.top_priority || 'None',
    blockers: state?.current_blockers || []
  };
}

/**
 * Obtener siguiente tarea sugerida
 * Contexto: ~100 tokens
 */
function getNextTask() {
  const project = getCurrentProject();
  if (!project) {
    return { error: 'No hay proyecto activo' };
  }

  const tasks = loadTasks(project.id);
  if (!tasks) {
    return { error: 'No hay tareas' };
  }

  // Encontrar tareas relevantes
  const inProgress = tasks.tasks.find(t => t.status === 'in_progress');
  const nextPending = tasks.tasks.find(t => t.status === 'pending');

  const result = {
    project: project.name,
    in_progress: inProgress ? {
      id: inProgress.id,
      title: inProgress.title,
      agents: inProgress.agent_needed || [],
      blockers: inProgress.blockers || []
    } : null,
    next: nextPending ? {
      id: nextPending.id,
      title: nextPending.title,
      agents: nextPending.agent_needed || [],
      dependencies: nextPending.dependencies || [],
      priority: nextPending.priority || 'normal'
    } : null
  };

  return result;
}

/**
 * Obtener contexto resumido para el modelo
 * Contexto optimizado: ~200 tokens
 */
function getContext() {
  const project = getCurrentProject();
  if (!project) {
    return { error: 'No hay proyecto activo' };
  }

  const state = loadProjectState(project.id);
  const tasks = loadTasks(project.id);
  const decisions = loadDecisions(project.id);
  const registry = loadAgentRegistry();

  // Encontrar agentes relevantes para el proyecto
  const relevantAgents = Object.entries(registry.agents)
    .filter(([id, agent]) => 
      agent.projects?.some(p => p === project.id || p === project.type.toLowerCase()) ||
      agent.stack?.some(s => project.stack.includes(s))
    )
    .map(([id, agent]) => ({ id, name: agent.name, role: agent.role }))
    .slice(0, 5);

  // Últimas decisiones (solo IDs para optimizar)
  const recentDecisionIds = decisions?.decisions.slice(-5).map(d => d.id) || [];

  return {
    // Resumen del proyecto (50 tokens)
    summary: {
      project: project.name,
      phase: project.phase,
      health: project.health,
      top_priority: state?.top_priority || 'None',
      tasks_summary: `${tasks?.completed_count || 0} done, ${tasks?.pending_count || 0} pending`
    },
    
    // Próximas tareas (100 tokens)
    next_tasks: tasks?.tasks
      .filter(t => t.status === 'pending' || t.status === 'in_progress')
      .slice(0, 3)
      .map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        agents: t.agent_needed || []
      })) || [],
    
    // Decisiones recientes (IDs, 50 tokens)
    recent_decisions: recentDecisionIds,
    
    // Agentes relevantes para este proyecto
    relevant_agents: relevantAgents
  };
}

/**
 * Listar todos los proyectos
 */
function listProjects() {
  const index = loadIndex();
  return {
    projects: index.projects
      .sort((a, b) => a.priority - b.priority)
      .map(p => ({
        id: p.id,
        name: p.name,
        phase: p.phase,
        health: p.health,
        priority: p.priority
      })),
    active: index.last_active
  };
}

/**
 * Agregar tarea
 */
function addTask(title, options = {}) {
  const project = getCurrentProject();
  if (!project) {
    return { error: 'No hay proyecto activo' };
  }

  const tasks = loadTasks(project.id);
  if (!tasks) {
    return { error: 'No hay archivo de tareas' };
  }

  const newId = `task_${String(tasks.tasks.length + 1).padStart(3, '0')}`;
  
  const newTask = {
    id: newId,
    title: title,
    description: options.description || '',
    status: 'pending',
    created_at: new Date().toISOString(),
    agent_needed: options.agents || [],
    priority: options.priority || 'normal',
    dependencies: options.dependencies || [],
    blockers: []
  };

  tasks.tasks.push(newTask);
  tasks.pending_count = (tasks.pending_count || 0) + 1;

  const tasksPath = path.join(ORCHESTRATOR_DIR, project.id, 'tasks.json');
  fs.writeFileSync(tasksPath, JSON.stringify(tasks, null, 2));

  return {
    success: true,
    task: newTask
  };
}

/**
 * Completar tarea
 */
function completeTask(taskId, notes = '') {
  const project = getCurrentProject();
  if (!project) {
    return { error: 'No hay proyecto activo' };
  }

  const tasks = loadTasks(project.id);
  if (!tasks) {
    return { error: 'No hay archivo de tareas' };
  }

  const taskIndex = tasks.tasks.findIndex(t => t.id === taskId);
  if (taskIndex === -1) {
    return { error: `Tarea no encontrada: ${taskId}` };
  }

  tasks.tasks[taskIndex].status = 'done';
  tasks.tasks[taskIndex].completed_at = new Date().toISOString();
  if (notes) {
    tasks.tasks[taskIndex].notes = notes;
  }

  // Recalcular counts
  tasks.completed_count = tasks.tasks.filter(t => t.status === 'done').length;
  tasks.in_progress_count = tasks.tasks.filter(t => t.status === 'in_progress').length;
  tasks.pending_count = tasks.tasks.filter(t => t.status === 'pending').length;

  const tasksPath = path.join(ORCHESTRATOR_DIR, project.id, 'tasks.json');
  fs.writeFileSync(tasksPath, JSON.stringify(tasks, null, 2));

  // Actualizar state con siguiente prioridad
  const nextTask = tasks.tasks.find(t => t.status === 'pending' || t.status === 'in_progress');
  if (nextTask) {
    const state = loadProjectState(project.id);
    if (state) {
      state.top_priority = nextTask.title;
      const statePath = path.join(ORCHESTRATOR_DIR, project.id, 'state.json');
      fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
    }
  }

  return {
    success: true,
    task: tasks.tasks[taskIndex]
  };
}

/**
 * Cambiar proyecto activo
 */
function switchProject(projectId) {
  const index = loadIndex();
  
  const project = index.projects.find(p => p.id === projectId);
  if (!project) {
    return { 
      error: `Proyecto no encontrado: ${projectId}`,
      available: index.projects.map(p => p.id)
    };
  }

  index.last_active = projectId;
  const indexPath = path.join(ORCHESTRATOR_DIR, '_index.json');
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));

  return {
    success: true,
    project: project.name,
    phase: project.phase,
    stack: project.stack
  };
}

/**
 * Obtener decisiones del proyecto
 */
function getDecisions(projectId = null) {
  const project = projectId 
    ? { id: projectId }
    : getCurrentProject();
    
  if (!project) {
    return { error: 'No hay proyecto activo' };
  }

  const decisions = loadDecisions(project.id);
  return decisions || { decisions: [] };
}

// ==================== MCP MANIFEST ====================

const manifest = {
  name: "agents-orchestrator",
  version: "1.0.0",
  description: "Sistema de orquestación de agentes - Gestiona estado de proyectos, tareas y decisiones",
  tools: [
    {
      name: "pm_status",
      description: "Obtener estado actual del proyecto activo",
      input: {},
      output: {
        type: "object",
        properties: {
          project: { type: "string" },
          phase: { type: "string" },
          health: { type: "string" },
          metrics: { type: "object" },
          top_priority: { type: "string" }
        }
      }
    },
    {
      name: "pm_next",
      description: "Obtener siguiente tarea sugerida",
      input: {},
      output: {
        type: "object",
        properties: {
          in_progress: { type: "object" },
          next: { type: "object" }
        }
      }
    },
    {
      name: "pm_context",
      description: "Obtener contexto resumido optimizado para el modelo (~200 tokens)",
      input: {},
      output: {
        type: "object",
        properties: {
          summary: { type: "object" },
          next_tasks: { type: "array" },
          recent_decisions: { type: "array" },
          relevant_agents: { type: "array" }
        }
      }
    },
    {
      name: "pm_list",
      description: "Listar todos los proyectos",
      input: {},
      output: {
        type: "object",
        properties: {
          projects: { type: "array" },
          active: { type: "string" }
        }
      }
    },
    {
      name: "pm_add",
      description: "Agregar nueva tarea",
      input: {
        type: "object",
        required: ["title"],
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          agents: { type: "array", items: { type: "string" } },
          priority: { type: "string", enum: ["low", "normal", "high"] }
        }
      }
    },
    {
      name: "pm_done",
      description: "Completar una tarea",
      input: {
        type: "object",
        required: ["taskId"],
        properties: {
          taskId: { type: "string" },
          notes: { type: "string" }
        }
      }
    },
    {
      name: "pm_use",
      description: "Cambiar a otro proyecto",
      input: {
        type: "object",
        required: ["projectId"],
        properties: {
          projectId: { type: "string" }
        }
      }
    },
    {
      name: "pm_decisions",
      description: "Obtener historial de decisiones técnicas",
      input: {
        type: "object",
        properties: {
          projectId: { type: "string" }
        }
      }
    }
  ]
};

// ==================== HTTP HANDLER (para MCP) ====================

/**
 * Handler para HTTP MCP server
 * Integrate with FastMCP or similar
 */
export function handleMCPRequest(toolName, params) {
  switch (toolName) {
    case 'pm_status':
      return getProjectStatus();
    case 'pm_next':
      return getNextTask();
    case 'pm_context':
      return getContext();
    case 'pm_list':
      return listProjects();
    case 'pm_add':
      return addTask(params.title, params);
    case 'pm_done':
      return completeTask(params.taskId, params.notes);
    case 'pm_use':
      return switchProject(params.projectId);
    case 'pm_decisions':
      return getDecisions(params.projectId);
    default:
      return { error: `Herramienta desconocida: ${toolName}` };
  }
}

// Exportar para uso directo
export {
  getProjectStatus,
  getNextTask,
  getContext,
  listProjects,
  addTask,
  completeTask,
  switchProject,
  getDecisions,
  manifest
};

// ==================== CLI ====================

if (import.meta.url === `file://${process.argv[1]}`) {
  // CLI mode
  const args = process.argv.slice(2);
  
  if (args[0] === 'manifest') {
    console.log(JSON.stringify(manifest, null, 2));
  } else if (args[0] === 'status') {
    console.log(JSON.stringify(getProjectStatus(), null, 2));
  } else if (args[0] === 'next') {
    console.log(JSON.stringify(getNextTask(), null, 2));
  } else if (args[0] === 'context') {
    console.log(JSON.stringify(getContext(), null, 2));
  } else if (args[0] === 'list') {
    console.log(JSON.stringify(listProjects(), null, 2));
  } else {
    console.log('Uso:');
    console.log('  node mcp-server.js manifest  - Ver manifest de herramientas');
    console.log('  node mcp-server.js status    - Ver estado del proyecto');
    console.log('  node mcp-server.js next     - Ver siguiente tarea');
    console.log('  node mcp-server.js context  - Ver contexto resumido');
    console.log('  node mcp-server.js list     - Listar proyectos');
  }
}
