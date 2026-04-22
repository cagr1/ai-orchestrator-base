const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { execSync, spawn, spawnSync } = require('child_process');
const { createMemoryManager } = require('../../integrations/memory-manager');
const { generateTasks: autoGenerateTasks } = require('../../integrations/auto-planner');

const RUNNER = path.join(__dirname, '../../..', 'runner.js');

const createDashboardService = ({ rootDir, realtime, websocket }) => {
  let activeRunner = null;

  const isRunnerActive = () => {
    if (!activeRunner || !activeRunner.child) return false;
    const child = activeRunner.child;
    return child.exitCode === null && !child.killed;
  };

  const getActiveRoot = () => {
    const cfg = getDashboardConfig();
    if (!cfg.project_root) return null;
    return path.resolve(cfg.project_root);
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
      configFile: path.join(activeSystem, 'config.json'),
      dashboardFile: path.join(activeSystem, 'dashboard.json')
    };
  };

  const getDashboardConfig = () => {
    const df = path.join(rootDir, 'system', 'dashboard.json');
    return readJSON(df) || { project_root: '', prompt: '' };
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

  const getSnapshot = () => {
    const { stateFile, tasksFile } = getPaths();
    const state = readJSON(stateFile) || { status: 'unknown' };
    const doc = readYAML(tasksFile) || { tasks: [], metadata: {} };
    const tasks = doc.tasks || [];
    const meta = doc.metadata || {};

    const completedIds = new Set(
      tasks.filter(t => t.estado === 'done').map(t => t.id)
    );
    const ejecutables = tasks.filter(t => {
      if (t.estado !== 'pending') return false;
      return (t.depends_on || []).every(depId => completedIds.has(depId));
    });

    return {
      state,
      tasks,
      task_counts: {
        total: meta.total_tasks || tasks.length,
        completed: meta.completed || tasks.filter(t => t.estado === 'done').length,
        pending: meta.pending || tasks.filter(t => t.estado === 'pending').length,
        running: meta.running || tasks.filter(t => t.estado === 'running').length,
        failed: meta.failed || tasks.filter(t => t.estado === 'failed').length,
        blocked: meta.blocked || tasks.filter(t => t.estado === 'blocked').length
      },
      halt_reason: state.halt_reason || null,
      ejecutables: ejecutables.length
    };
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
    broadcast('snapshot:updated', getSnapshot());
    return task;
  };

  const updateTask = (taskId, payload) => {
    const { tasksFile } = getPaths();
    const doc = readYAML(tasksFile) || { version: '3.0', tasks: [], metadata: {} };
    const tasks = doc.tasks || [];
    const task = tasks.find(t => t.id === taskId);
    if (!task) return { error: 'task_not_found' };

    Object.assign(task, payload);
    task.updated_at = new Date().toISOString();
    doc.metadata = doc.metadata || {};
    doc.metadata.total_tasks = tasks.length;
    doc.metadata.completed = tasks.filter(t => t.estado === 'done').length;
    doc.metadata.pending = tasks.filter(t => t.estado === 'pending').length;
    doc.metadata.failed = tasks.filter(t => t.estado === 'failed').length;
    doc.metadata.blocked = tasks.filter(t => t.estado === 'blocked').length;
    writeYAML(tasksFile, doc);
    broadcast('snapshot:updated', getSnapshot());
    return task;
  };

  const triggerRun = (command = 'run') => {
    try {
      const { activeRoot, stateFile } = getPaths();
      if (!activeRoot) {
        return { ok: false, output: 'No valid project_root set. Please set a valid project root path.' };
      }
      const validCommands = ['run', 'resume'];
      if (!validCommands.includes(command)) {
        command = 'run';
      }
      const state = readJSON(stateFile) || {};
      const runId = state.run_id || 'unknown';

      if (isRunnerActive()) {
        return {
          ok: false,
          code: 'runner_already_active',
          pid: activeRunner.pid,
          run_id: activeRunner.runId,
          output: `Runner already active (pid=${activeRunner.pid}, run_id=${activeRunner.runId})`
        };
      }

      const child = spawn('node', [RUNNER, command, '--root', activeRoot], { cwd: activeRoot });
      activeRunner = {
        child,
        pid: child.pid,
        runId,
        root: activeRoot,
        command,
        startedAt: new Date().toISOString()
      };

      broadcast('terminal:output', {
        type: 'info',
        data: `[RUNNER START] pid=${child.pid} run_id=${runId} command=${command} root=${activeRoot}\n`
      });

      child.stdout.on('data', (data) => {
        const output = data.toString();
        broadcast('terminal:output', { type: 'stdout', data: output });
      });

      child.stderr.on('data', (data) => {
        const output = data.toString();
        broadcast('terminal:output', { type: 'stderr', data: output });
      });

      child.on('close', (code) => {
        const ctx = activeRunner && activeRunner.pid === child.pid ? activeRunner : { pid: child.pid, runId };
        broadcast('terminal:output', {
          type: 'info',
          data: `[RUNNER END] pid=${ctx.pid} run_id=${ctx.runId} code=${code}\n`
        });
        if (activeRunner && activeRunner.pid === child.pid) {
          activeRunner = null;
        }
        broadcast('terminal:closed', { code });
        broadcast('snapshot:updated', getSnapshot());

        // Auto-loop: if runner exited cleanly and state is still paused, resume automatically.
        if (code === 0) {
          try {
            const { stateFile } = getPaths();
            const latestState = readJSON(stateFile) || {};
            if (latestState.status === 'paused') {
              broadcast('terminal:output', { type: 'info', data: '[AUTO-RESUME] Batch cap reached — continuing automatically...\n' });
              triggerRun('resume');
            }
          } catch (_e) { /* ignore — auto-loop is best-effort */ }
        }
      });

      child.on('error', (err) => {
        const ctx = activeRunner && activeRunner.pid === child.pid ? activeRunner : { pid: child.pid, runId };
        broadcast('terminal:output', {
          type: 'error',
          data: `[RUNNER ERROR] pid=${ctx.pid} run_id=${ctx.runId} error=${err.message}\n`
        });
        if (activeRunner && activeRunner.pid === child.pid) {
          activeRunner = null;
        }
        broadcast('terminal:error', { error: err.message });
        broadcast('snapshot:updated', getSnapshot());
      });

      broadcast('snapshot:updated', getSnapshot());

      return { ok: true, pid: child.pid, run_id: runId, message: `Runner ${command} started` };
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
    broadcast('snapshot:updated', getSnapshot());
    return state;
  };

  const updateDashboardConfig = (payload) => {
    const current = getDashboardConfig();
    const next = { ...current, ...payload };
    if (next.project_root !== undefined) {
      if (!next.project_root) {
        return { error: 'project_root cannot be empty' };
      }
      if (!path.isAbsolute(next.project_root)) {
        return { error: 'project_root must be an absolute path' };
      }
      next.project_root = path.resolve(next.project_root);
    }
    const df = path.join(rootDir, 'system', 'dashboard.json');
    fs.writeFileSync(df, JSON.stringify(next, null, 2));
    return next;
  };

  const ensureProjectRoot = (projectRoot) => {
    if (!projectRoot) return;
    if (!fs.existsSync(projectRoot)) {
      fs.mkdirSync(projectRoot, { recursive: true });
    }
  };

  const getExistingProjectGuard = (projectRoot) => {
    const systemDir = path.join(projectRoot, 'system');
    const stateFile = path.join(systemDir, 'state.json');
    const tasksFile = path.join(systemDir, 'tasks.yaml');
    const hasState = fs.existsSync(stateFile);
    const hasTasks = fs.existsSync(tasksFile);
    if (!hasState && !hasTasks) return null;

    const state = hasState ? readJSON(stateFile) : null;
    const status = state?.status || 'unknown';
    if (status === 'completed') return null;

    return {
      ok: false,
      error: 'project_exists',
      status,
      output: `Project already exists at ${projectRoot} with status "${status}". Use Resume instead of Create Project.`
    };
  };

  const initProject = (goal, projectRoot) => {
    if (!projectRoot) return { ok: false, output: 'project_root is required' };
    try {
      const next = updateDashboardConfig({ project_root: projectRoot });
      if (next.error) return { ok: false, error: 'invalid_project_root', output: next.error };
      const existingProject = getExistingProjectGuard(next.project_root);
      if (existingProject) return existingProject;
      ensureProjectRoot(next.project_root);
      const safeGoal = (goal || 'Define project goal here').replace(/\r?\n/g, ' ').trim();
      const result = spawnSync('node', [RUNNER, 'init', safeGoal, '--root', next.project_root], {
        cwd: next.project_root,
        timeout: 30000,
        encoding: 'utf-8'
      });
      if (result.status !== 0) {
        const errMsg = result.stderr || result.stdout || 'runner init exited with non-zero code';
        console.error('[initProject] runner init failed:', errMsg);
        return { ok: false, output: errMsg };
      }
      return { ok: true, output: result.stdout };
    } catch (e) {
      return { ok: false, output: e.message };
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
      const activeRoot = getActiveRoot();
      if (!activeRoot) return { ok: false, error: 'No valid project_root set' };
      execSync(`node "${RUNNER}" skills rebuild --root "${activeRoot}"`, { cwd: activeRoot, encoding: 'utf-8' });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.stdout || e.message };
    }
  };

  const detectSkills = (apply = false) => {
    try {
      const activeRoot = getActiveRoot();
      if (!activeRoot) return { ok: false, output: 'No valid project_root set' };
      const cmd = apply ? `node "${RUNNER}" skills install --root "${activeRoot}"` : `node "${RUNNER}" skills detect --root "${activeRoot}"`;
      const output = execSync(cmd, { cwd: activeRoot, encoding: 'utf-8' });
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
        const pending = parts[4]?.match(/pending=(\d+)/)?.[1] || '0';
        meta.tasks_pending = parseInt(pending, 10);
        const total = (meta.tasks_completed || 0) + (meta.tasks_failed || 0) + (meta.tasks_pending || 0);
        meta.tasks_total = total || meta.tasks_completed || 0;
      }
      entries.push(meta);
      if (entries.length >= 20) break;
    }
    return entries;
  };

  const getEffectiveConfig = () => {
    const { configFile, activeRoot } = getPaths();
    const config = readJSON(configFile);
    if (!config) return null;
    const activeProvider = config.active_provider || 'openrouter';
    const providerConfig = (config.providers || {})[activeProvider] || {};
    const modelMapping = config.model_mapping || {};
    const resolved = {};
    for (const [role, key] of Object.entries(modelMapping)) {
      resolved[role] = {
        key,
        model: providerConfig.models?.[key] || null
      };
    }
    return {
      active_provider: activeProvider,
      model_mapping: resolved,
      provider_models: providerConfig.models || {}
    };
  };

  const generateTasks = async (goal) => {
    const { configFile, stateFile, activeRoot } = getPaths();
    const activeConfig = readJSON(configFile);
    const repoConfig = readJSON(path.join(rootDir, 'system', 'config.json'));
    const config = (activeConfig && Object.keys(activeConfig).length > 0) ? activeConfig : (repoConfig || {});
    const state = readJSON(stateFile) || readJSON(path.join(activeRoot, 'system', 'state.json')) || {};
    const systemDir = path.join(activeRoot, 'system');
    const effectiveGoal = goal || state.goal || getDashboardConfig().prompt || 'Build a web project';
    const result = await autoGenerateTasks({ goal: effectiveGoal, systemDir, config, state });
    if (result.ok) broadcast('tasks:updated', result.tasks);
    return result;
  };

  return {
    getActiveRoot,
    getStatus,
    getTasks,
    getSnapshot,
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
    getRunHistory,
    getEffectiveConfig
  };
};

module.exports = { createDashboardService };
