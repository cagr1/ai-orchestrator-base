#!/usr/bin/env node

/**
 * Project Manager - CLI del Orquestador de Agentes
 * 
 * Este es el "cerebro" central que:
 * - Gestiona el estado de proyectos
 * - Recuerda decisiones técnicas
 * - Sugiere siguiente paso
 * - Optimiza contexto para el modelo
 * 
 * Uso:
 *   pm status           - Ver estado actual
 *   pm next             - Ver siguiente tarea
 *   pm add "task"       - Agregar tarea
 *   pm done <id>        - Completar tarea
 *   pm decide "text"    - Registrar decisión
 *   pm use <project>    - Cambiar proyecto
 *   pm context          - Ver contexto resumido
 *   pm list             - Listar todos los proyectos
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ORCHESTRATOR_DIR = path.join(__dirname, 'projects');

// Colores para terminal
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  gray: '\x1b[90m'
};

// ==================== HELPERS ====================

function loadIndex() {
  const indexPath = path.join(ORCHESTRATOR_DIR, '_index.json');
  return JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
}

function saveIndex(data) {
  const indexPath = path.join(ORCHESTRATOR_DIR, '_index.json');
  fs.writeFileSync(indexPath, JSON.stringify(data, null, 2));
}

function loadProjectState(projectId) {
  const statePath = path.join(ORCHESTRATOR_DIR, projectId, 'state.json');
  if (!fs.existsSync(statePath)) return null;
  return JSON.parse(fs.readFileSync(statePath, 'utf-8'));
}

function saveProjectState(projectId, data) {
  const statePath = path.join(ORCHESTRATOR_DIR, projectId, 'state.json');
  fs.writeFileSync(statePath, JSON.stringify(data, null, 2));
}

function loadTasks(projectId) {
  const tasksPath = path.join(ORCHESTRATOR_DIR, projectId, 'tasks.json');
  if (!fs.existsSync(tasksPath)) return null;
  return JSON.parse(fs.readFileSync(tasksPath, 'utf-8'));
}

function saveTasks(projectId, data) {
  const tasksPath = path.join(ORCHESTRATOR_DIR, projectId, 'tasks.json');
  fs.writeFileSync(tasksPath, JSON.stringify(data, null, 2));
}

function loadDecisions(projectId) {
  const decisionsPath = path.join(ORCHESTRATOR_DIR, projectId, 'decisions.json');
  if (!fs.existsSync(decisionsPath)) return null;
  return JSON.parse(fs.readFileSync(decisionsPath, 'utf-8'));
}

function getCurrentProject() {
  const index = loadIndex();
  return index.projects.find(p => p.id === index.last_active);
}

// ==================== COMMANDS ====================

function cmdStatus() {
  const project = getCurrentProject();
  if (!project) {
    console.log(`${colors.red}No hay proyecto activo${colors.reset}`);
    return;
  }

  const state = loadProjectState(project.id);
  const tasks = loadTasks(project.id);

  console.log(`\n${colors.bright}${colors.cyan}═══ ${project.name} ═══${colors.reset}`);
  console.log(`${colors.gray}Descripción:${colors.reset} ${project.description}`);
  console.log(`${colors.gray}Fase:${colors.reset} ${colors.yellow}${project.phase}${colors.reset}`);
  console.log(`${colors.gray}Stack:${colors.reset} ${project.stack.join(', ')}`);
  console.log(`${colors.gray}URL:${colors.reset} ${project.url}`);
  
  if (state) {
    console.log(`\n${colors.gray}Métricas:${colors.reset}`);
    console.log(`  ✅ Completadas: ${tasks?.completed_count || 0}`);
    console.log(`  🔄 En progreso: ${tasks?.in_progress_count || 0}`);
    console.log(`  ⏳ Pendientes: ${tasks?.pending_count || 0}`);
    
    if (state.top_priority) {
      console.log(`\n${colors.bright}${colors.green}🎯 Prioridad actual:${colors.reset} ${state.top_priority}`);
    }
    
    if (state.current_blockers?.length > 0) {
      console.log(`\n${colors.red}🚧 Blockers:${colors.reset}`);
      state.current_blockers.forEach(b => console.log(`  - ${b}`));
    }
  }
  
  console.log('');
}

function cmdNext() {
  const project = getCurrentProject();
  if (!project) {
    console.log(`${colors.red}No hay proyecto activo${colors.reset}`);
    return;
  }

  const tasks = loadTasks(project.id);
  if (!tasks) {
    console.log(`${colors.red}No hay tareas${colors.reset}`);
    return;
  }

  // Encontrar siguiente tarea
  const inProgress = tasks.tasks.find(t => t.status === 'in_progress');
  const nextPending = tasks.tasks.find(t => t.status === 'pending');

  if (inProgress) {
    console.log(`\n${colors.bright}${colors.yellow}🔄 En progreso:${colors.reset} ${inProgress.title}`);
    console.log(`${colors.gray}Descripción:${colors.reset} ${inProgress.description || ''}`);
    if (inProgress.agent_needed) {
      console.log(`${colors.gray}Agente(s):${colors.reset} ${inProgress.agent_needed.join(', ')}`);
    }
    if (inProgress.blockers?.length > 0) {
      console.log(`${colors.red}Blockers:${colors.reset} ${inProgress.blockers.join(', ')}`);
    }
  }

  if (nextPending && !inProgress) {
    console.log(`\n${colors.bright}${colors.green}➡️  Siguiente tarea:${colors.reset} ${nextPending.title}`);
    console.log(`${colors.gray}Descripción:${colors.reset} ${nextPending.description || ''}`);
    if (nextPending.agent_needed) {
      console.log(`${colors.gray}Agente(s) sugerido(s):${colors.reset} ${colors.cyan}${nextPending.agent_needed.join(', ')}${colors.reset}`);
    }
    if (nextPending.dependencies?.length > 0) {
      const deps = nextPending.dependencies.map(d => {
        const dep = tasks.tasks.find(t => t.id === d);
        return dep ? dep.title : d;
      });
      console.log(`${colors.gray}Dependencias:${colors.reset} ${deps.join(', ')}`);
    }
  }

  console.log('');
}

function cmdAdd(args) {
  const project = getCurrentProject();
  if (!project) {
    console.log(`${colors.red}No hay proyecto activo${colors.reset}`);
    return;
  }

  const tasks = loadTasks(project.id);
  if (!tasks) {
    console.log(`${colors.red}No hay archivo de tareas${colors.reset}`);
    return;
  }

  const title = args.join(' ');
  const newId = `task_${String(tasks.tasks.length + 1).padStart(3, '0')}`;
  
  const newTask = {
    id: newId,
    title: title,
    status: 'pending',
    created_at: new Date().toISOString(),
    agent_needed: []
  };

  tasks.tasks.push(newTask);
  tasks.pending_count = (tasks.pending_count || 0) + 1;
  
  saveTasks(project.id, tasks);
  console.log(`${colors.green}✅ Tarea agregada:${colors.reset} ${title} [${newId}]`);
}

function cmdDone(args) {
  const project = getCurrentProject();
  if (!project) {
    console.log(`${colors.red}No hay proyecto activo${colors.reset}`);
    return;
  }

  const taskId = args[0];
  const notes = args.slice(1).join(' ');

  const tasks = loadTasks(project.id);
  if (!tasks) {
    console.log(`${colors.red}No hay archivo de tareas${colors.reset}`);
    return;
  }

  const taskIndex = tasks.tasks.findIndex(t => t.id === taskId);
  if (taskIndex === -1) {
    console.log(`${colors.red}Tarea no encontrada: ${taskId}${colors.reset}`);
    return;
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

  saveTasks(project.id, tasks);
  console.log(`${colors.green}✅ Tarea completada:${colors.reset} ${tasks.tasks[taskIndex].title}`);
}

function cmdDecide(args) {
  const project = getCurrentProject();
  if (!project) {
    console.log(`${colors.red}No hay proyecto activo${colors.reset}`);
    return;
  }

  const decisionText = args.join(' ');
  const decisions = loadDecisions(project.id);
  
  if (!decisions) {
    console.log(`${colors.red}No hay archivo de decisiones${colors.reset}`);
    return;
  }

  const newId = `dec_${String(decisions.decisions.length + 1).padStart(3, '0')}`;
  
  const newDecision = {
    id: newId,
    date: new Date().toISOString(),
    category: "general",
    title: decisionText,
    decision: decisionText,
    status: "pending_context"
  };

  decisions.decisions.push(newDecision);
  
  const decisionsPath = path.join(ORCHESTRATOR_DIR, project.id, 'decisions.json');
  fs.writeFileSync(decisionsPath, JSON.stringify(decisions, null, 2));
  
  console.log(`${colors.green}✅ Decisión registrada:${colors.reset} ${decisionText} [${newId}]`);
  console.log(`${colors.gray}Nota: Usa el flag --category y --reason para completar la decisión${colors.reset}`);
}

function cmdSwitch(args) {
  const projectId = args[0];
  const index = loadIndex();
  
  const project = index.projects.find(p => p.id === projectId);
  if (!project) {
    console.log(`${colors.red}Proyecto no encontrado: ${projectId}${colors.reset}`);
    console.log(`${colors.gray}Proyectos disponibles:${colors.reset}`);
    index.projects.forEach(p => console.log(`  - ${p.id} (${p.name})`));
    return;
  }

  index.last_active = projectId;
  saveIndex(index);
  
  console.log(`${colors.green}✅ Cambiado a:${colors.reset} ${project.name} (${project.id})`);
}

function cmdList() {
  const index = loadIndex();
  const current = index.last_active;

  console.log(`\n${colors.bright}${colors.cyan}═══ Proyectos ═══${colors.reset}\n`);
  
  index.projects
    .sort((a, b) => a.priority - b.priority)
    .forEach(p => {
      const marker = p.id === current ? `${colors.green}▶${colors.reset}` : ' ';
      const healthColor = p.health === 'active' ? colors.green : 
                         p.health === 'completed' ? colors.blue : colors.gray;
      
      console.log(`${marker} ${colors.bright}${p.id}${colors.reset} - ${p.name}`);
      console.log(`   ${colors.gray}Fase:${colors.reset} ${p.phase} | ${colors.gray}Salud:${colors.reset} ${healthColor}${p.health}${colors.reset}`);
      console.log(`   ${colors.gray}Stack:${colors.reset} ${p.stack.slice(0, 3).join(', ')}...`);
      console.log('');
    });
}

function cmdContext() {
  const project = getCurrentProject();
  if (!project) {
    console.log(`${colors.red}No hay proyecto activo${colors.reset}`);
    return;
  }

  const state = loadProjectState(project.id);
  const tasks = loadTasks(project.id);
  const decisions = loadDecisions(project.id);

  console.log(`\n${colors.bright}${colors.cyan}═══ Contexto para el Modelo ═══${colors.reset}\n`);

  // Summary ligero
  const summary = {
    project: project.name,
    phase: project.phase,
    health: project.health,
    top_priority: state?.top_priority || 'None',
    tasks_summary: {
      completed: tasks?.completed_count || 0,
      pending: tasks?.pending_count || 0
    },
    recent_decisions: decisions?.decisions.slice(-3).map(d => ({
      id: d.id,
      title: d.title,
      category: d.category
    })) || []
  };

  console.log(`${colors.gray}// Resumen (50 tokens)${colors.reset}`);
  console.log(JSON.stringify(summary, null, 2));

  // Próximas tareas
  console.log(`\n${colors.gray}// Próximas tareas${colors.reset}`);
  const nextTasks = tasks?.tasks
    .filter(t => t.status === 'pending' || t.status === 'in_progress')
    .slice(0, 3)
    .map(t => ({
      id: t.id,
      title: t.title,
      status: t.status,
      agents: t.agent_needed || []
    }));
  console.log(JSON.stringify(nextTasks, null, 2));

  console.log('');
}

function cmdResume() {
  const project = getCurrentProject();
  if (!project) {
    console.log(`${colors.red}No hay proyecto activo${colors.reset}`);
    return;
  }

  const state = loadProjectState(project.id);
  const tasks = loadTasks(project.id);
  const decisions = loadDecisions(project.id);

  // Generar prompt compacto para pegar en nueva conversación
  const inProgress = tasks?.tasks.find(t => t.status === 'in_progress');
  const nextPending = tasks?.tasks.find(t => t.status === 'pending');
  const recentDecisions = decisions?.decisions.slice(-3).map(d => `${d.title}`).join(', ') || 'ninguna';
  const completedTitles = tasks?.tasks.filter(t => t.status === 'done').map(t => t.title).join(', ') || 'ninguna';
  const pendingTitles = tasks?.tasks.filter(t => t.status === 'pending').slice(0, 5).map(t => t.title).join(', ') || 'ninguna';
  const blockers = state?.current_blockers?.length > 0 ? state.current_blockers.join(', ') : 'ninguno';

  // Encontrar agentes relevantes del registry
  let relevantAgents = [];
  try {
    const registryPath = path.join(__dirname, 'agents', 'registry.json');
    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
    relevantAgents = Object.entries(registry.agents)
      .filter(([id, agent]) =>
        agent.projects?.some(p => p === project.id || project.id.startsWith(p.replace('*', ''))) ||
        agent.stack?.some(s => project.stack.some(ps => ps.toLowerCase().includes(s.toLowerCase())))
      )
      .map(([id]) => id)
      .slice(0, 5);
  } catch (e) {}

  const prompt = `---
CONTEXTO DEL PROYECTO (auto-generado por pm resume)
Proyecto: ${project.name} | Tipo: ${project.type} | Fase: ${project.phase} | Salud: ${project.health}
Stack: ${project.stack.join(', ')}
URL: ${project.url || 'N/A'}

Estado: ${tasks?.completed_count || 0} tareas completadas, ${tasks?.in_progress_count || 0} en progreso, ${tasks?.pending_count || 0} pendientes
Tarea actual: ${inProgress ? `${inProgress.id} - ${inProgress.title}` : 'ninguna en progreso'}
Siguiente tarea: ${nextPending ? `${nextPending.id} - ${nextPending.title}` : 'todas completadas'}
Bloqueadores: ${blockers}

Últimas decisiones: ${recentDecisions}
Ya completado: ${completedTitles}
Pendiente: ${pendingTitles}

Agentes relevantes: ${relevantAgents.join(', ') || 'general'}
---`;

  console.log(`\n${colors.bright}${colors.cyan}═══ PROMPT PARA NUEVA CONVERSACIÓN ═══${colors.reset}`);
  console.log(`${colors.gray}Copia y pega esto al inicio de tu nueva conversación:${colors.reset}\n`);
  console.log(prompt);
  console.log('');
}

function cmdInit(args) {
  const projectTypes = {
    'landing': {
      stack: ['Vue 3', 'GSAP', 'TailwindCSS', 'Vercel'],
      phase: 'discovery',
      tasks: [
        { title: 'Setup proyecto (Vite + Vue/React)', priority: 'high' },
        { title: 'Configurar TailwindCSS + fonts', priority: 'high' },
        { title: 'Hero section con animación GSAP', priority: 'high' },
        { title: 'Secciones principales (About, Services, Contact)', priority: 'high' },
        { title: 'Animaciones scroll (ScrollTrigger)', priority: 'medium' },
        { title: 'Responsive mobile', priority: 'high' },
        { title: 'SEO meta tags + OG images', priority: 'medium' },
        { title: 'Performance audit (Lighthouse 95+)', priority: 'medium' },
        { title: 'Deploy Vercel', priority: 'high' },
        { title: 'Analytics (Google Analytics/Plausible)', priority: 'low' }
      ],
      agents: ['landing-stack', 'frontend-animations', 'devops-deploy']
    },
    'saas': {
      stack: ['Next.js', 'React', 'Prisma', 'PostgreSQL', 'TailwindCSS'],
      phase: 'discovery',
      tasks: [
        { title: 'Setup Next.js + Prisma + PostgreSQL', priority: 'high' },
        { title: 'Schema de base de datos (multi-tenant si aplica)', priority: 'high' },
        { title: 'Autenticación (NextAuth/Clerk)', priority: 'high' },
        { title: 'RBAC - Roles y permisos', priority: 'high' },
        { title: 'API endpoints core', priority: 'high' },
        { title: 'Dashboard principal', priority: 'high' },
        { title: 'Billing integration (Paddle/Stripe)', priority: 'medium' },
        { title: 'Rate limiting + security', priority: 'medium' },
        { title: 'Email notifications', priority: 'medium' },
        { title: 'Tests endpoints críticos', priority: 'medium' },
        { title: 'CI/CD pipeline', priority: 'medium' },
        { title: 'Deploy staging', priority: 'high' },
        { title: 'Beta testing (5 usuarios)', priority: 'high' }
      ],
      agents: ['backend-node', 'frontend-react', 'database-prisma', 'database-postgres', 'security-api', 'devops-ci', 'devops-deploy']
    },
    'erp': {
      stack: ['.NET 8', 'Vue 3', 'EF Core', 'SQL Server'],
      phase: 'discovery',
      tasks: [
        { title: 'Setup .NET 8 Web API + EF Core', priority: 'high' },
        { title: 'Setup Vue 3 + Vite + Pinia', priority: 'high' },
        { title: 'Docker compose (API + DB)', priority: 'high' },
        { title: 'Schema de base de datos', priority: 'high' },
        { title: 'Autenticación JWT', priority: 'high' },
        { title: 'CRUD módulo principal', priority: 'high' },
        { title: 'Dashboard con gráficos', priority: 'medium' },
        { title: 'Reportes/exportación', priority: 'medium' },
        { title: 'Tests de servicios', priority: 'medium' },
        { title: 'Deploy staging', priority: 'high' }
      ],
      agents: ['backend-dotnet', 'frontend-vue', 'database-migrations', 'devops-docker', 'devops-ci', 'security-api']
    },
    'mcp': {
      stack: ['Node.js', 'MCP SDK', 'TypeScript'],
      phase: 'discovery',
      tasks: [
        { title: 'Setup proyecto MCP', priority: 'high' },
        { title: 'Definir tools/resources', priority: 'high' },
        { title: 'Implementar handlers', priority: 'high' },
        { title: 'Tests', priority: 'medium' },
        { title: 'Documentación', priority: 'medium' },
        { title: 'Publicar', priority: 'high' }
      ],
      agents: ['backend-node']
    }
  };

  if (args.length < 2) {
    console.log(`\n${colors.bright}${colors.cyan}═══ Iniciar Nuevo Proyecto ═══${colors.reset}\n`);
    console.log(`Uso: ${colors.yellow}pm init <tipo> <nombre>${colors.reset}\n`);
    console.log(`Tipos disponibles:`);
    Object.keys(projectTypes).forEach(type => {
      console.log(`  ${colors.green}${type}${colors.reset} → Stack: ${projectTypes[type].stack.slice(0, 3).join(', ')}`);
    });
    console.log(`\nEjemplo: ${colors.yellow}pm init landing mi-cliente${colors.reset}`);
    return;
  }

  const type = args[0].toLowerCase();
  const projectName = args.slice(1).join('-');
  const projectId = projectName.toLowerCase().replace(/\s+/g, '-');

  if (!projectTypes[type]) {
    console.log(`${colors.red}Tipo no reconocido: ${type}${colors.reset}`);
    console.log(`Tipos disponibles: ${Object.keys(projectTypes).join(', ')}`);
    return;
  }

  const template = projectTypes[type];
  const index = loadIndex();

  // Verificar que no exista
  if (index.projects.find(p => p.id === projectId)) {
    console.log(`${colors.red}Ya existe un proyecto con id: ${projectId}${colors.reset}`);
    return;
  }

  // Crear directorio del proyecto
  const projectDir = path.join(ORCHESTRATOR_DIR, projectId);
  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true });
  }

  // Crear state.json
  const state = {
    project_id: projectId,
    project_name: projectName,
    description: `Proyecto tipo ${type}`,
    current_phase: template.phase,
    health: 'active',
    priority: index.projects.length + 1,
    last_updated: new Date().toISOString(),
    stack: template.stack,
    url: '',
    metrics: { tasks_completed: 0, tasks_pending: template.tasks.length, agents_used: [] },
    current_blockers: [],
    top_priority: template.tasks[0].title
  };
  fs.writeFileSync(path.join(projectDir, 'state.json'), JSON.stringify(state, null, 2));

  // Crear tasks.json
  const tasks = {
    project_id: projectId,
    tasks: template.tasks.map((t, i) => ({
      id: `task_${String(i + 1).padStart(3, '0')}`,
      title: t.title,
      status: 'pending',
      created_at: new Date().toISOString(),
      agent_needed: [],
      priority: t.priority
    })),
    completed_count: 0,
    in_progress_count: 0,
    pending_count: template.tasks.length
  };
  fs.writeFileSync(path.join(projectDir, 'tasks.json'), JSON.stringify(tasks, null, 2));

  // Crear decisions.json
  const decisions = { project_id: projectId, decisions: [] };
  fs.writeFileSync(path.join(projectDir, 'decisions.json'), JSON.stringify(decisions, null, 2));

  // Agregar al índice
  index.projects.push({
    id: projectId,
    name: projectName,
    description: `Proyecto tipo ${type}`,
    url: '',
    stack: template.stack,
    phase: template.phase,
    health: 'active',
    priority: index.projects.length + 1,
    type: type.charAt(0).toUpperCase() + type.slice(1),
    folder: projectId
  });
  index.last_active = projectId;
  saveIndex(index);

  console.log(`\n${colors.bright}${colors.green}✅ Proyecto creado: ${projectName}${colors.reset}`);
  console.log(`${colors.gray}Tipo:${colors.reset} ${type}`);
  console.log(`${colors.gray}Stack:${colors.reset} ${template.stack.join(', ')}`);
  console.log(`${colors.gray}Tareas:${colors.reset} ${template.tasks.length} pendientes`);
  console.log(`${colors.gray}Agentes:${colors.reset} ${template.agents.join(', ')}`);
  console.log(`\n${colors.yellow}Proyecto activo cambiado a: ${projectId}${colors.reset}`);
  console.log(`${colors.gray}Usa 'pm next' para ver la primera tarea${colors.reset}\n`);
}

function cmdLearn(args) {
  const lesson = args.join(' ');
  if (!lesson) {
    console.log(`${colors.red}Uso: pm learn "Nunca usar CDN de Tailwind en producción"${colors.reset}`);
    return;
  }

  // Cargar o crear archivo de lecciones
  const lessonsPath = path.join(__dirname, 'lessons.json');
  let lessons = { lessons: [] };
  if (fs.existsSync(lessonsPath)) {
    lessons = JSON.parse(fs.readFileSync(lessonsPath, 'utf-8'));
  }

  // Detectar categoría automáticamente
  const keywords = {
    frontend: ['css', 'tailwind', 'react', 'vue', 'component', 'animation', 'gsap', 'ui', 'ux', 'responsive', 'layout'],
    backend: ['api', 'endpoint', 'controller', 'service', 'middleware', 'auth', 'jwt', 'express', 'next.js', 'laravel', '.net'],
    database: ['query', 'prisma', 'sql', 'index', 'migration', 'schema', 'n+1', 'postgres', 'supabase'],
    devops: ['docker', 'deploy', 'ci', 'cd', 'vercel', 'railway', 'pipeline', 'cdn', 'build', 'production'],
    security: ['cors', 'xss', 'injection', 'secret', 'token', 'rate limit', 'vulnerability'],
    testing: ['test', 'coverage', 'mock', 'jest', 'vitest', 'assert']
  };

  let detectedCategory = 'general';
  const lowerLesson = lesson.toLowerCase();
  for (const [category, words] of Object.entries(keywords)) {
    if (words.some(w => lowerLesson.includes(w))) {
      detectedCategory = category;
      break;
    }
  }

  const newLesson = {
    id: `lesson_${String(lessons.lessons.length + 1).padStart(3, '0')}`,
    date: new Date().toISOString(),
    category: detectedCategory,
    lesson: lesson,
    applied_to_agent: null
  };

  lessons.lessons.push(newLesson);
  fs.writeFileSync(lessonsPath, JSON.stringify(lessons, null, 2));

  console.log(`${colors.green}✅ Lección registrada:${colors.reset} ${lesson}`);
  console.log(`${colors.gray}Categoría detectada:${colors.reset} ${detectedCategory}`);
  console.log(`${colors.gray}ID:${colors.reset} ${newLesson.id}`);
  console.log(`${colors.yellow}Tip: Revisa el agente de ${detectedCategory} para agregar esta regla manualmente${colors.reset}`);
}

function cmdSprint() {
  const project = getCurrentProject();
  if (!project) {
    console.log(`${colors.red}No hay proyecto activo${colors.reset}`);
    return;
  }

  const tasks = loadTasks(project.id);
  if (!tasks) {
    console.log(`${colors.red}No hay tareas${colors.reset}`);
    return;
  }

  // Obtener tareas pendientes y en progreso
  const inProgress = tasks.tasks.filter(t => t.status === 'in_progress');
  const pending = tasks.tasks.filter(t => t.status === 'pending');
  const done = tasks.tasks.filter(t => t.status === 'done');

  // Calcular sprint sugerido (máximo 5 tareas)
  const sprintTasks = [...inProgress];
  
  // Agregar pendientes priorizadas
  const highPriority = pending.filter(t => t.priority === 'high');
  const mediumPriority = pending.filter(t => t.priority === 'medium');
  const lowPriority = pending.filter(t => t.priority === 'low');
  const normalPriority = pending.filter(t => !t.priority || t.priority === 'normal');

  const prioritized = [...highPriority, ...mediumPriority, ...normalPriority, ...lowPriority];
  
  // Filtrar por dependencias resueltas
  const available = prioritized.filter(t => {
    if (!t.dependencies || t.dependencies.length === 0) return true;
    return t.dependencies.every(depId => {
      const dep = tasks.tasks.find(dt => dt.id === depId);
      return dep && dep.status === 'done';
    });
  });

  // Llenar sprint hasta 5 tareas
  for (const task of available) {
    if (sprintTasks.length >= 5) break;
    if (!sprintTasks.find(t => t.id === task.id)) {
      sprintTasks.push(task);
    }
  }

  console.log(`\n${colors.bright}${colors.cyan}═══ Sprint Sugerido: ${project.name} ═══${colors.reset}`);
  console.log(`${colors.gray}Progreso general: ${done.length}/${tasks.tasks.length} tareas completadas (${Math.round(done.length/tasks.tasks.length*100)}%)${colors.reset}\n`);

  if (sprintTasks.length === 0) {
    console.log(`${colors.green}🎉 ¡Todas las tareas completadas!${colors.reset}`);
    return;
  }

  sprintTasks.forEach((task, i) => {
    const statusIcon = task.status === 'in_progress' ? '🔄' : '⏳';
    const priorityColor = task.priority === 'high' ? colors.red :
                          task.priority === 'medium' ? colors.yellow : colors.gray;
    
    console.log(`  ${statusIcon} ${colors.bright}${task.id}${colors.reset} - ${task.title}`);
    console.log(`     ${colors.gray}Prioridad:${colors.reset} ${priorityColor}${task.priority || 'normal'}${colors.reset}`);
    if (task.agent_needed?.length > 0) {
      console.log(`     ${colors.gray}Agentes:${colors.reset} ${colors.cyan}${task.agent_needed.join(', ')}${colors.reset}`);
    }
    if (task.dependencies?.length > 0) {
      console.log(`     ${colors.gray}Depende de:${colors.reset} ${task.dependencies.join(', ')}`);
    }
    console.log('');
  });

  // Tareas bloqueadas
  const blocked = pending.filter(t => {
    if (!t.dependencies || t.dependencies.length === 0) return false;
    return t.dependencies.some(depId => {
      const dep = tasks.tasks.find(dt => dt.id === depId);
      return dep && dep.status !== 'done';
    });
  });

  if (blocked.length > 0) {
    console.log(`${colors.red}🚧 Tareas bloqueadas:${colors.reset}`);
    blocked.forEach(t => {
      const blockingTasks = t.dependencies
        .map(depId => tasks.tasks.find(dt => dt.id === depId))
        .filter(dep => dep && dep.status !== 'done')
        .map(dep => dep.title);
      console.log(`  - ${t.title} ${colors.gray}(esperando: ${blockingTasks.join(', ')})${colors.reset}`);
    });
    console.log('');
  }
}

function cmdHelp() {
  console.log(`
${colors.bright}${colors.cyan}Project Manager - Orquestador de Agentes${colors.reset}

${colors.green}Estados:${colors.reset}
  ${colors.yellow}pm status${colors.reset}         - Ver estado del proyecto actual
  ${colors.yellow}pm next${colors.reset}           - Ver siguiente tarea sugerida
  ${colors.yellow}pm list${colors.reset}           - Listar todos los proyectos
  ${colors.yellow}pm context${colors.reset}        - Ver contexto resumido para el modelo
  ${colors.yellow}pm resume${colors.reset}         - Generar prompt para nueva conversación
  ${colors.yellow}pm sprint${colors.reset}         - Ver sprint sugerido (5 tareas priorizadas)

${colors.green}Gestión:${colors.reset}
  ${colors.yellow}pm add "tarea"${colors.reset}      - Agregar nueva tarea
  ${colors.yellow}pm done <id>${colors.reset}         - Completar tarea
  ${colors.yellow}pm decide "text"${colors.reset}     - Registrar decisión técnica
  ${colors.yellow}pm use <project>${colors.reset}     - Cambiar proyecto activo

${colors.green}Nuevo Proyecto:${colors.reset}
  ${colors.yellow}pm init <tipo> <nombre>${colors.reset} - Crear proyecto (landing/saas/erp/mcp)

${colors.green}Aprendizaje:${colors.reset}
  ${colors.yellow}pm learn "lección"${colors.reset}  - Registrar lección aprendida

${colors.green}Ejemplos:${colors.reset}
  pm resume                              → Prompt para nueva conversación
  pm init landing mi-cliente             → Crear proyecto landing
  pm init saas nueva-app                 → Crear proyecto SaaS
  pm sprint                              → Ver sprint sugerido
  pm learn "No usar CDN Tailwind en prod" → Registrar lección
  pm add "Implementar dark mode"
  pm done task_005
  pm use citasbot
`);
}

// ==================== MAIN ====================

const command = process.argv[2];
const args = process.argv.slice(3).filter(a => !a.startsWith('--'));

switch (command) {
  case 'status':
  case 's':
    cmdStatus();
    break;
  case 'next':
  case 'n':
    cmdNext();
    break;
  case 'list':
  case 'ls':
    cmdList();
    break;
  case 'add':
    cmdAdd(args);
    break;
  case 'done':
  case 'complete':
    cmdDone(args);
    break;
  case 'decide':
  case 'd':
    cmdDecide(args);
    break;
  case 'use':
  case 'switch':
    cmdSwitch(args);
    break;
  case 'context':
  case 'ctx':
    cmdContext();
    break;
  case 'resume':
  case 'r':
    cmdResume();
    break;
  case 'init':
  case 'new':
    cmdInit(args);
    break;
  case 'learn':
  case 'l':
    cmdLearn(args);
    break;
  case 'sprint':
  case 'sp':
    cmdSprint();
    break;
  case 'help':
  case '-h':
  case '--help':
    cmdHelp();
    break;
  default:
    // Por defecto mostrar status
    cmdStatus();
}
