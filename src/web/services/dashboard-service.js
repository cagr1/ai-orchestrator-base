const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { execSync, spawn } = require('child_process');
const { createMemoryManager } = require('../../integrations/memory-manager');
const { generateTasks: autoGenerateTasks } = require('../../integrations/auto-planner');

const RUNNER = path.join(__dirname, '../../..', 'runner.js');

const createDashboardService = ({ rootDir, realtime, websocket }) => {
  const systemDir = path.join(rootDir, 'system');
  const dashboardFile = path.join(systemDir, 'dashboard.json');

  const getActiveRoot = () => {
    const cfg = getDashboardConfig();
    return cfg.project_root || rootDir;
  };

  const getPaths = () => {
    const activeRoot = getActiveRoot();
    const activeSystem = path.join(activeRoot, 'system');
    return {
      activeRoot,
      stateFile: path.join(activeSystem, 'state.json'),
      tasksFile: path.join(activeSystem, 'tasks.yaml'),
      skillsIndexFile: path.join(activeSystem, 'skills_index.json'),
      memoryFile: path.join(activeSystem, 'memory.md'),
      configFile: path.join(activeSystem, 'config.json')
    };
  };

  const readJSON = (file) => {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch (_e) {
      return null;
    }
  };

  const readYAML = (file) => {
    try {
      return yaml.load(fs.readFileSync(file, 'utf-8'));
    } catch (_e) {
      return null;
    }
  };

  const writeYAML = (file, data) => {
    fs.writeFileSync(file, yaml.dump(data, { indent: 2 }), 'utf-8');
  };

  const broadcast = (event, payload) => {
    realtime.broadcast(event, payload);
    websocket?.broadcast?.(event, payload);
  };

  const getStatus = () => {
    const { stateFile } = getPaths();
    return readJSON(stateFile) || { status: 'unknown' };
  };

  const getTasks = () => {
    const { tasksFile } = getPaths();
    const doc = readYAML(tasksFile) || { tasks: [] };
    return doc.tasks || [];
  };

  const createTask = (payload) => {
    const { tasksFile } = getPaths();
    const doc = readYAML(tasksFile) || { version: '3.0', tasks: [], metadata: {} };
    const tasks = doc.tasks || [];
    const nextId = `T${tasks.length + 1}`;
    const task = {
      id: nextId,
      title: payload.title || 'Nueva tarea',
      description: payload.description || '',
      skill: payload.skill || 'frontend-html-basic',
      estado: 'pending',
      priority: payload.priority || 2,
      depends_on: payload.depends_on || [],
      input: payload.input || [],
      output: payload.output || []
    };
    tasks.push(task);
    doc.tasks = tasks;
    doc.metadata = doc.metadata || {};
    doc.metadata.total_tasks = tasks.length;
    doc.metadata.pending = (doc.metadata.pending || 0) + 1;
    writeYAML(tasksFile, doc);
    broadcast('tasks:updated', tasks);
    return task;
  };

  const updateTask = (taskId, payload) => {
    const { tasksFile } = getPaths();
    const doc = readYAML(tasksFile) || { tasks: [] };
    const tasks = doc.tasks || [];
    const task = tasks.find(t => t.id === taskId);
    if (!task) return { error: 'task_not_found' };

    Object.assign(task, payload);
    writeYAML(tasksFile, doc);
    broadcast('tasks:updated', tasks);
    return task;
  };

const triggerRun = () => {
    try {
      const child = spawn('node', [RUNNER, 'run'], { cwd: rootDir });
      
      child.stdout.on('data', (data) => {
        const output = data.toString();
        broadcast('terminal:output', { type: 'stdout', data: output });
      });
      
      child.stderr.on('data', (data) => {
        const output = data.toString();
        broadcast('terminal:output', { type: 'stderr', data: output });
      });
      
      child.on('close', (code) => {
        broadcast('terminal:closed', { code });
      });
      
      child.on('error', (err) => {
        broadcast('terminal:error', { error: err.message });
      });
      
      return { ok: true, pid: child.pid, message: 'Runner started' };
    } catch (e) {
      return { ok: false, output: e.message };
    }
  };

  const applyControl = (payload) => {
    const { stateFile } = getPaths();
    const state = readJSON(stateFile) || {};
    if (payload.status) state.status = payload.status;
    if (payload.phase) state.phase = payload.phase;
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
    broadcast('status:updated', state);
    return state;
  };

  const getDashboardConfig = () => readJSON(dashboardFile) || { project_root: rootDir, prompt: '' };

  const updateDashboardConfig = (payload) => {
    const current = getDashboardConfig();
    const next = { ...current, ...payload };
    fs.writeFileSync(dashboardFile, JSON.stringify(next, null, 2));
    return next;
  };

  const ensureProjectRoot = (projectRoot) => {
    if (!projectRoot) return;
    if (!fs.existsSync(projectRoot)) {
      fs.mkdirSync(projectRoot, { recursive: true });
    }
  };

  const initProject = (goal, projectRoot) => {
    try {
      const next = updateDashboardConfig({ project_root: projectRoot || getActiveRoot() });
      ensureProjectRoot(next.project_root);
      const output = execSync(`node "${RUNNER}" init "${goal || 'Define project goal here'}"`, {
        cwd: rootDir,
        timeout: 15000,
        encoding: 'utf-8'
      });
      return { ok: true, output };
    } catch (e) {
      return { ok: false, output: e.stdout || e.message };
    }
  };

  const listProjectFiles = () => {
    const { activeRoot } = getPaths();
    const exclude = new Set(['node_modules', '.git', 'dist', 'build']);
    const files = [];
    const walk = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (exclude.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else {
          files.push(path.relative(activeRoot, full).replace(/\\/g, '/'));
        }
      }
    };
    walk(activeRoot);
    return files.sort();
  };

  const readProjectFile = (relPath) => {
    const { activeRoot } = getPaths();
    const full = path.resolve(activeRoot, relPath);
    if (!full.startsWith(activeRoot)) return { error: 'invalid_path' };
    try {
      const content = fs.readFileSync(full, 'utf-8');
      return { ok: true, content, path: relPath };
    } catch (e) {
      return { error: e.message };
    }
  };

  const writeProjectFile = (relPath, content) => {
    const { activeRoot } = getPaths();
    const full = path.resolve(activeRoot, relPath);
    if (!full.startsWith(activeRoot)) return { error: 'invalid_path' };
    const dir = path.dirname(full);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(full, content || '', 'utf-8');
    return { ok: true, path: relPath };
  };

  const listSkills = () => {
    try {
      const { skillsIndexFile } = getPaths();
      const data = JSON.parse(fs.readFileSync(skillsIndexFile, 'utf-8'));
      return data.items || [];
    } catch (_e) {
      return [];
    }
  };

  const listSkillFiles = () => {
    const { activeRoot } = getPaths();
    const skillsDir = path.join(activeRoot, 'skills');
    if (!fs.existsSync(skillsDir)) return [];
    const files = [];
    const walk = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        if (entry.name.endsWith('.md')) {
          files.push(path.relative(skillsDir, full).replace(/\\/g, '/'));
        }
      }
    };
    walk(skillsDir);
    return files.sort();
  };

  const readSkillFile = (relPath) => {
    const { activeRoot } = getPaths();
    const skillsDir = path.join(activeRoot, 'skills');
    const full = path.resolve(skillsDir, relPath);
    if (!full.startsWith(skillsDir)) return { error: 'invalid_path' };
    try {
      const content = fs.readFileSync(full, 'utf-8');
      return { ok: true, content, path: relPath };
    } catch (e) {
      return { error: e.message };
    }
  };

  const writeSkillFile = (relPath, content) => {
    const { activeRoot } = getPaths();
    const skillsDir = path.join(activeRoot, 'skills');
    const full = path.resolve(skillsDir, relPath);
    if (!full.startsWith(skillsDir)) return { error: 'invalid_path' };
    const dir = path.dirname(full);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(full, content || '', 'utf-8');
    return { ok: true, path: relPath };
  };

  const refreshSkills = () => {
    try {
      execSync(`node "${RUNNER}" skills rebuild`, { cwd: rootDir, encoding: 'utf-8' });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.stdout || e.message };
    }
  };

  const detectSkills = (apply = false) => {
    try {
      const cmd = apply ? `node "${RUNNER}" skills install` : `node "${RUNNER}" skills detect`;
      const output = execSync(cmd, { cwd: rootDir, encoding: 'utf-8' });
      return { ok: true, output };
    } catch (e) {
      return { ok: false, output: e.stdout || e.message };
    }
  };

  const searchMemory = async (query) => {
    const { memoryFile, configFile, activeRoot } = getPaths();
    const memoryManager = createMemoryManager({ memoryFile, configFile });
    const project = path.basename(activeRoot);
    return memoryManager.search({ query, project, limit: 10 });
  };

  const getRunHistory = () => {
    const { activeRoot } = getPaths();
    const runsDir = path.join(activeRoot, 'system', 'runs');
    if (!fs.existsSync(runsDir)) return [];
    const entries = [];
    const runDirs = fs.readdirSync(runsDir).sort().reverse();
    for (const dir of runDirs) {
      const runPath = path.join(runsDir, dir);
      if (!fs.statSync(runPath).isDirectory()) continue;
      const historyFile = path.join(runPath, 'history.log');
      const taskFile = path.join(runPath, 'tasks.yaml');
      let meta = { run_id: dir };
      if (fs.existsSync(historyFile)) {
        const lines = fs.readFileSync(historyFile, 'utf-8').trim().split('\n');
        const last = lines[lines.length - 1] || '';
        const parts = last.split(' | ');
        meta.timestamp = parts[0] || '';
        meta.phase = parts[1]?.replace('phase=', '') || '';
        meta.status = parts[2]?.replace('status=', '') || '';
        const completed = parts[3]?.match(/completed=(\d+)/)?.[1] || '0';
        const failed = parts[5]?.match(/failed=(\d+)/)?.[1] || '0';
        meta.tasks_completed = parseInt(completed, 10);
        meta.tasks_failed = parseInt(failed, 10);
      }
      if (fs.existsSync(taskFile)) {
        try {
          const doc = yaml.load(fs.readFileSync(taskFile, 'utf-8'));
          meta.tasks_total = doc.tasks?.length || 0;
          meta.tasks = doc.tasks || [];
        } catch (_e) {}
      }
      entries.push(meta);
      if (entries.length >= 20) break;
    }
    return entries;
  };

  const generateTasks = async (goal) => {
    const { configFile, stateFile } = getPaths();
    const config = readJSON(configFile) || readJSON(path.join(rootDir, 'system', 'config.json')) || {};
    const state = readJSON(stateFile) || readJSON(path.join(rootDir, 'system', 'state.json')) || {};
    const systemDir = path.join(rootDir, 'system');
    const effectiveGoal = goal || state.goal || getDashboardConfig().prompt || 'Build a web project';
    const result = await autoGenerateTasks({ goal: effectiveGoal, systemDir, config, state });
    if (result.ok) broadcast('tasks:updated', result.tasks);
    return result;
  };

  return {
    getStatus,
    getTasks,
    createTask,
    updateTask,
    triggerRun,
    applyControl,
    getDashboardConfig,
    updateDashboardConfig,
    initProject,
    generateTasks,
    listSkills,
    listSkillFiles,
    readSkillFile,
    writeSkillFile,
    listProjectFiles,
    readProjectFile,
    writeProjectFile,
    refreshSkills,
    detectSkills,
    searchMemory,
    getRunHistory
  };
};

module.exports = { createDashboardService };
