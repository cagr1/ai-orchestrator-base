#!/usr/bin/env node

/**
 * Agent System Runner v2.0
 *
 * Comando: node runner.js "Build mini ecommerce static catalog with filters"
 *
 * Flujo estandar: goal -> planner -> tasks -> executor -> qa -> reviewer -> memory -> repeat
 *
 * UNBREAKABLE RULE: No task can be marked as done without file-system evidence
 * of real changes in the target project directory.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT_DIR = __dirname;
const SYSTEM_DIR = path.join(ROOT_DIR, 'system');
const GOAL_FILE = path.join(SYSTEM_DIR, 'goal.md');
const PLAN_FILE = path.join(SYSTEM_DIR, 'plan.md');
const TASKS_FILE = path.join(SYSTEM_DIR, 'tasks.md');
const MEMORY_FILE = path.join(SYSTEM_DIR, 'memory.md');
const STATE_FILE = path.join(SYSTEM_DIR, 'state.json');
const CONFIG_FILE = path.join(SYSTEM_DIR, 'config.json');
const RUNS_DIR = path.join(SYSTEM_DIR, 'runs');
const EVIDENCE_DIR = path.join(SYSTEM_DIR, 'evidence');

const readFile = (filepath) => {
  try {
    return fs.readFileSync(filepath, 'utf-8');
  } catch (_e) {
    return null;
  }
};

const writeFile = (filepath, content) => {
  fs.writeFileSync(filepath, content, 'utf-8');
};

const readJSON = (filepath) => {
  const content = readFile(filepath);
  if (!content) return null;
  const sanitized = content.replace(/^\uFEFF/, '');
  return JSON.parse(sanitized);
};

const writeJSON = (filepath, data) => {
  writeFile(filepath, JSON.stringify(data, null, 2));
};

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// ============================================================
// EVIDENCE SYSTEM — File-change tracking for anti-skip guards
// ============================================================

const TRACKED_EXTENSIONS = new Set([
  '.tsx', '.ts', '.js', '.jsx', '.css', '.scss', '.sass', '.less',
  '.html', '.vue', '.svelte', '.json', '.md', '.mdx',
  '.py', '.rb', '.go', '.rs', '.java', '.cs', '.php',
  '.yaml', '.yml', '.toml', '.xml', '.sql', '.graphql',
  '.env', '.config', '.prisma'
]);

const EXCLUDED_DIRS = new Set([
  'node_modules', '.git', '.next', '.nuxt', 'dist', 'build',
  '.agents', 'system', '.cache', '.turbo', '__pycache__',
  'coverage', '.nyc_output', '.vscode', '.idea'
]);

const hashFile = (filepath) => {
  try {
    const content = fs.readFileSync(filepath);
    return crypto.createHash('md5').update(content).digest('hex');
  } catch (_e) {
    return null;
  }
};

const scanProjectFiles = (dir, config) => {
  const files = {};
  if (!dir || !fs.existsSync(dir)) return files;

  const excludedPaths = (config?.evidence?.excluded_paths || []).map(p => p.replace(/\/$/, ''));
  const trackedExts = config?.evidence?.tracked_extensions
    ? new Set(config.evidence.tracked_extensions)
    : TRACKED_EXTENSIONS;

  const walk = (currentDir) => {
    let entries;
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch (_e) {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relativePath = path.relative(dir, fullPath).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        if (EXCLUDED_DIRS.has(entry.name)) continue;
        if (excludedPaths.some(ep => relativePath.startsWith(ep))) continue;
        walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (trackedExts.has(ext)) {
          const hash = hashFile(fullPath);
          if (hash) {
            files[relativePath] = {
              hash,
              size: fs.statSync(fullPath).size,
              mtime: fs.statSync(fullPath).mtime.toISOString()
            };
          }
        }
      }
    }
  };

  walk(dir);
  return files;
};

const createPreSnapshot = (taskId, projectDir, config) => {
  ensureDir(EVIDENCE_DIR);
  const files = scanProjectFiles(projectDir, config);
  const snapshot = {
    task_id: taskId,
    type: 'pre',
    timestamp: new Date().toISOString(),
    project_dir: projectDir,
    file_count: Object.keys(files).length,
    files
  };
  writeJSON(path.join(EVIDENCE_DIR, `${taskId}-pre.json`), snapshot);
  return snapshot;
};

const createPostSnapshotAndDiff = (taskId, projectDir, config) => {
  ensureDir(EVIDENCE_DIR);
  const preFile = path.join(EVIDENCE_DIR, `${taskId}-pre.json`);
  const pre = readJSON(preFile);

  if (!pre) {
    return {
      task_id: taskId,
      error: 'no_pre_snapshot',
      total_changes: 0,
      files_changed: [],
      files_created: [],
      files_deleted: [],
      verified: false
    };
  }

  const postFiles = scanProjectFiles(projectDir, config);
  const filesChanged = [];
  const filesCreated = [];
  const filesDeleted = [];

  // Find modified and deleted files
  for (const [filePath, preInfo] of Object.entries(pre.files)) {
    if (!postFiles[filePath]) {
      filesDeleted.push({ path: filePath, action: 'deleted' });
    } else if (postFiles[filePath].hash !== preInfo.hash) {
      filesChanged.push({
        path: filePath,
        action: 'modified',
        size_before: preInfo.size,
        size_after: postFiles[filePath].size
      });
    }
  }

  // Find new files
  for (const filePath of Object.keys(postFiles)) {
    if (!pre.files[filePath]) {
      filesCreated.push({
        path: filePath,
        action: 'created',
        size: postFiles[filePath].size
      });
    }
  }

  const evidence = {
    task_id: taskId,
    pre_snapshot: pre.timestamp,
    post_snapshot: new Date().toISOString(),
    project_dir: projectDir,
    files_changed: filesChanged,
    files_created: filesCreated,
    files_deleted: filesDeleted,
    total_changes: filesChanged.length + filesCreated.length + filesDeleted.length,
    verified: false
  };

  writeJSON(path.join(EVIDENCE_DIR, `${taskId}.json`), evidence);
  return evidence;
};

const readEvidence = (taskId) => {
  return readJSON(path.join(EVIDENCE_DIR, `${taskId}.json`));
};

const hasPreSnapshot = (taskId) => {
  return fs.existsSync(path.join(EVIDENCE_DIR, `${taskId}-pre.json`));
};

const getProjectRoot = (config) => {
  return config?.evidence?.project_root || null;
};

const stripToken = (resultado, tokenPrefix) => {
  if (!resultado || resultado === '-') return '-';
  const tokens = resultado.split(';').map(t => t.trim()).filter(Boolean);
  const filtered = tokens.filter(t => !t.toLowerCase().startsWith(tokenPrefix.toLowerCase()));
  return filtered.length ? filtered.join('; ') : '-';
};

// ============================================================
// CORE SYSTEM FUNCTIONS
// ============================================================

const snapshotRun = (state, event = 'state_update') => {
  if (!state || !state.run_id) return;

  ensureDir(RUNS_DIR);
  const runDir = path.join(RUNS_DIR, state.run_id);
  ensureDir(runDir);

  writeFile(path.join(runDir, 'goal.md'), readFile(GOAL_FILE) || '');
  writeFile(path.join(runDir, 'plan.md'), readFile(PLAN_FILE) || '');
  writeFile(path.join(runDir, 'tasks.md'), readFile(TASKS_FILE) || '');
  writeFile(path.join(runDir, 'memory.md'), readFile(MEMORY_FILE) || '');
  writeFile(path.join(runDir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);

  const eventLine = `${new Date().toISOString()} | ${event} | phase=${state.phase} | iteration=${state.iteration} | awaiting=${state.awaiting_agent || '-'} | status=${state.status}`;
  fs.appendFileSync(path.join(runDir, 'events.log'), `${eventLine}\n`, 'utf-8');
};

const persistState = (state, event = 'state_update') => {
  writeJSON(STATE_FILE, state);
  snapshotRun(state, event);
};

const logEvidence = (state, taskId, action, details) => {
  if (!state || !state.run_id) return;
  const runDir = path.join(RUNS_DIR, state.run_id);
  ensureDir(runDir);
  const line = `${new Date().toISOString()} | ${action} | task=${taskId} | ${details}`;
  fs.appendFileSync(path.join(runDir, 'events.log'), `${line}\n`, 'utf-8');
};

const writeRunSummary = (state, tasksParsed) => {
  if (!state || !state.run_id) return;

  ensureDir(RUNS_DIR);
  const runDir = path.join(RUNS_DIR, state.run_id);
  ensureDir(runDir);

  const taskLines = tasksParsed && tasksParsed.tasks
    ? tasksParsed.tasks.map((t) => {
        const ev = readEvidence(t.id);
        const changes = ev ? ev.total_changes : 0;
        return `- ${t.id} | skill=${t.skill || '-'} | estado=${t.estado} | resultado=${t.resultado || '-'} | evidence_changes=${changes}`;
      })
    : [];

  const content = [
    '# Run Summary',
    '',
    `- run_id: ${state.run_id}`,
    `- generated_at: ${new Date().toISOString()}`,
    `- phase: ${state.phase}`,
    `- status: ${state.status}`,
    `- iteration: ${state.iteration}/${state.max_iterations}`,
    `- evidence_required: ${state.evidence_required}`,
    '',
    '## Metrics',
    `- tasks_total: ${state.metrics.tasks_total}`,
    `- tasks_done: ${state.metrics.tasks_done}`,
    `- tasks_failed: ${state.metrics.tasks_failed}`,
    `- qa_passes: ${state.metrics.qa_passes}`,
    `- qa_fails: ${state.metrics.qa_fails}`,
    `- review_passes: ${state.metrics.review_passes}`,
    `- review_fails: ${state.metrics.review_fails}`,
    `- evidence_rejections: ${state.metrics.evidence_rejections || 0}`,
    '',
    '## Task Results (with evidence)',
    ...(taskLines.length ? taskLines : ['- no tasks found']),
    '',
    '## Task Lists',
    `- completed_tasks: ${state.completed_tasks.join(', ') || '-'}`,
    `- failed_tasks: ${state.failed_tasks.join(', ') || '-'}`,
    `- skipped_tasks: ${state.skipped_tasks.join(', ') || '-'}`
  ].join('\n');

  writeFile(path.join(runDir, 'summary.md'), `${content}\n`);
};

const resetRunArtifacts = () => {
  writeFile(PLAN_FILE, '');
  writeFile(TASKS_FILE, '');
};

const taskIdPattern = /^T\d+$/i;
const ALLOWED_STATES = new Set(['pending', 'running', 'done', 'failed', 'skipped']);
const DEPENDENCY_COLUMNS = ['dependencias', 'dependencies', 'depends_on', 'deps'];

const parseMarkdownTable = (content) => {
  const lines = content.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => /^\|\s*id\s*\|/i.test(line));

  if (headerIndex === -1 || !lines[headerIndex + 1] || !/^\|[\s:-]+\|/.test(lines[headerIndex + 1])) {
    return null;
  }

  const splitCells = (line) => line.split('|').slice(1, -1).map((cell) => cell.trim());
  const headers = splitCells(lines[headerIndex]).map((h) => h.toLowerCase());

  const rows = [];
  let endIndex = headerIndex + 2;

  for (let i = headerIndex + 2; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim().startsWith('|')) {
      endIndex = i;
      break;
    }

    const cells = splitCells(line);
    if (cells.length === headers.length) {
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = cells[idx];
      });
      rows.push(row);
    }
    endIndex = i + 1;
  }

  return {
    headers,
    rows,
    start: headerIndex,
    end: endIndex,
    lines
  };
};

const serializeMarkdownTable = (table) => {
  const headerLine = `| ${table.headers.join(' | ')} |`;
  const separatorLine = `| ${table.headers.map(() => '---').join(' | ')} |`;
  const body = table.rows.map((row) => {
    const cells = table.headers.map((h) => (row[h] ?? '').toString().trim());
    return `| ${cells.join(' | ')} |`;
  });

  const newLines = [
    ...table.lines.slice(0, table.start),
    headerLine,
    separatorLine,
    ...body,
    ...table.lines.slice(table.end)
  ];

  return newLines.join('\n');
};

const parseTasks = (content) => {
  if (!content || !content.trim()) return null;
  const table = parseMarkdownTable(content);
  if (!table) return null;

  const requiredColumns = ['id', 'skill', 'estado', 'resultado'];
  if (!requiredColumns.every((c) => table.headers.includes(c))) {
    return null;
  }

  const invalidIdRows = table.rows
    .map((row, idx) => ({ row, idx }))
    .filter(({ row }) => {
      const id = (row.id || '').trim();
      return id.length > 0 && !taskIdPattern.test(id);
    })
    .map(({ row, idx }) => ({ rowNumber: idx + 1, id: (row.id || '').trim() }));

  const tasks = table.rows
    .filter((row) => taskIdPattern.test((row.id || '').trim()))
    .map((row) => ({
      id: (row.id || '').trim(),
      skill: (row.skill || '').trim(),
      estado: (row.estado || '').trim().toLowerCase(),
      resultado: (row.resultado || '').trim().toLowerCase(),
      dependencies: [],
      raw: row
    }));

  return { table, tasks, invalidIdRows };
};

const parseDependencies = (value) => {
  if (!value) return [];
  const raw = value.trim().toLowerCase();
  if (!raw || raw === '-' || raw === 'none' || raw === 'n/a') return [];
  const ids = raw.match(/t\d+/gi) || [];
  return Array.from(new Set(ids.map((id) => id.toUpperCase())));
};

const findDependencyColumn = (headers) => headers.find((h) => DEPENDENCY_COLUMNS.includes(h));

const validateTasks = (tasksParsed) => {
  const errors = [];
  if (!tasksParsed || !tasksParsed.tasks || tasksParsed.tasks.length === 0) {
    errors.push('tasks table has no valid task rows');
    return { valid: false, errors };
  }

  if (tasksParsed.invalidIdRows && tasksParsed.invalidIdRows.length > 0) {
    tasksParsed.invalidIdRows.forEach((r) => {
      errors.push(`invalid task id "${r.id}" at table row ${r.rowNumber}`);
    });
  }

  const ids = tasksParsed.tasks.map((t) => t.id.toUpperCase());
  const seen = new Set();
  const duplicates = new Set();
  ids.forEach((id) => {
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  });
  if (duplicates.size > 0) {
    errors.push(`duplicate task ids: ${Array.from(duplicates).join(', ')}`);
  }

  tasksParsed.tasks.forEach((t) => {
    if (!ALLOWED_STATES.has(t.estado)) {
      errors.push(`invalid estado "${t.estado}" in task ${t.id}`);
    }
    if (!t.skill) {
      errors.push(`missing skill in task ${t.id}`);
    }
  });

  const dependencyColumn = findDependencyColumn(tasksParsed.table.headers);
  if (dependencyColumn) {
    tasksParsed.tasks.forEach((t) => {
      t.dependencies = parseDependencies(t.raw[dependencyColumn] || '');
    });

    const idSet = new Set(ids);
    tasksParsed.tasks.forEach((t) => {
      t.dependencies.forEach((depId) => {
        if (!idSet.has(depId)) {
          errors.push(`task ${t.id} references unknown dependency ${depId}`);
        }
        if (depId === t.id.toUpperCase()) {
          errors.push(`task ${t.id} cannot depend on itself`);
        }
      });
    });

    if (errors.length === 0) {
      const graph = new Map(tasksParsed.tasks.map((t) => [t.id.toUpperCase(), t.dependencies]));
      const color = new Map(); // 0 unvisited, 1 visiting, 2 visited
      let hasCycle = false;

      const visit = (node) => {
        if (hasCycle) return;
        const c = color.get(node) || 0;
        if (c === 1) {
          hasCycle = true;
          return;
        }
        if (c === 2) return;
        color.set(node, 1);
        (graph.get(node) || []).forEach((next) => visit(next));
        color.set(node, 2);
      };

      graph.forEach((_v, node) => visit(node));
      if (hasCycle) errors.push('dependency cycle detected in tasks table');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    dependencyColumn: dependencyColumn || null
  };
};

const saveTasks = (table, tasksById) => {
  table.rows = table.rows.map((row) => {
    const taskId = (row.id || '').trim();
    const updated = tasksById.get(taskId);
    if (!updated) return row;

    const next = { ...row };
    if ('estado' in next) next.estado = updated.estado;
    if ('resultado' in next) next.resultado = updated.resultado;
    return next;
  });

  writeFile(TASKS_FILE, serializeMarkdownTable(table));
};

const hasToken = (resultado, tokenPrefix) => {
  if (!resultado || resultado === '-') return false;
  const tokens = resultado.split(';').map((t) => t.trim().toLowerCase()).filter(Boolean);
  return tokens.some((t) => t.startsWith(tokenPrefix));
};

const addToken = (resultado, token) => {
  const current = (!resultado || resultado === '-')
    ? []
    : resultado.split(';').map((t) => t.trim()).filter(Boolean);

  if (!current.some((t) => t.toLowerCase() === token.toLowerCase())) {
    current.push(token);
  }

  return current.length ? current.join('; ') : '-';
};

const hasMemoryEntryForTask = (memoryContent, taskId) => {
  if (!memoryContent) return false;
  return new RegExp(`\\b${taskId}\\b`, 'i').test(memoryContent);
};

const chooseNextPendingTask = (tasks) => {
  const byId = new Map(tasks.map((t) => [t.id.toUpperCase(), t]));
  return tasks.find((t) => {
    if (t.estado !== 'pending') return false;
    const deps = t.dependencies || [];
    return deps.every((depId) => byId.get(depId)?.estado === 'done');
  });
};

const generateRunId = (goal) => {
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const goalSlug = goal.slice(0, 20).toLowerCase().replace(/[^a-z0-9]/g, '-');
  return `${goalSlug}-${timestamp}`;
};

const initializeState = (goal, config) => {
  const runId = generateRunId(goal);
  const state = {
    version: '2.0',
    run_id: runId,
    phase: 'planning',
    iteration: 0,
    max_iterations: config?.max_iterations || 20,
    status: 'running',
    current_task_id: null,
    awaiting_agent: 'planner',
    completed_tasks: [],
    failed_tasks: [],
    skipped_tasks: [],
    halted: false,
    halt_reason: null,
    last_agent: null,
    last_action: null,
    last_updated: new Date().toISOString(),
    evidence_required: true, // UNBREAKABLE — cannot be disabled
    metrics: {
      tasks_total: 0,
      tasks_done: 0,
      tasks_failed: 0,
      review_passes: 0,
      review_fails: 0,
      qa_passes: 0,
      qa_fails: 0,
      evidence_rejections: 0
    }
  };

  persistState(state);
  return state;
};

const loadSystem = () => {
  const state = readJSON(STATE_FILE);
  const config = readJSON(CONFIG_FILE);

  if (state && config && typeof config.max_iterations === 'number') {
    state.max_iterations = config.max_iterations;
  }

  return {
    goal: readFile(GOAL_FILE),
    state,
    config,
    tasks: readFile(TASKS_FILE),
    plan: readFile(PLAN_FILE),
    memory: readFile(MEMORY_FILE)
  };
};

const printAgentPrompt = (agent, taskId, extra) => {
  if (agent === 'planner') {
    console.log('[ACTION] Action required: run Planner Agent to generate system/plan.md and system/tasks.md');
    return;
  }

  if (agent === 'executor') {
    console.log(`[ACTION] Action required: run Executor Agent for ${taskId}`);
    console.log('   Expected token in tasks.resultado: executor:done');
    console.log('   UNBREAKABLE: You MUST make REAL changes to project source files.');
    console.log('   UNBREAKABLE: The runner will verify file changes via hash comparison.');
    console.log('   UNBREAKABLE: If zero project files changed, executor:done is REJECTED.');
    if (extra?.skill) {
      console.log(`   Skill assigned: ${extra.skill}`);
      console.log(`   You MUST read and apply the rules from: skills/${extra.skill.replace(/-/g, '/').replace(/^frontend\//, 'frontend/')}.md`);
    }
    if (extra?.rejected) {
      console.log('   ⚠ PREVIOUS EXECUTION REJECTED — no file changes were detected.');
      console.log('   You must make actual code changes in the project directory.');
    }
    return;
  }

  if (agent === 'qa') {
    console.log(`[ACTION] Action required: run QA Agent for ${taskId}`);
    console.log('   Expected token in tasks.resultado: qa:pass or qa:fail');
    console.log('   UNBREAKABLE: You MUST verify system/evidence/${taskId}.json exists and has real changes.');
    console.log('   UNBREAKABLE: If evidence shows 0 file changes, you MUST qa:fail.');
    return;
  }

  if (agent === 'reviewer') {
    console.log(`[ACTION] Action required: run Reviewer Agent for ${taskId}`);
    console.log('   Expected token in tasks.resultado: review:pass(score=X) or review:fail(score=X)');
    console.log('   UNBREAKABLE: You MUST read the skill file and verify its rules were applied.');
    console.log('   UNBREAKABLE: You MUST check system/evidence/${taskId}.json for actual changes.');
    console.log('   UNBREAKABLE: If evidence is missing or empty, review:fail(score=0).');
    return;
  }

  if (agent === 'memory') {
    console.log(`[ACTION] Action required: append decision log for ${taskId} in system/memory.md`);
    console.log('   MUST reference files changed from system/evidence/${taskId}.json');
  }
};

const markTaskDone = (state, tasksParsed, taskId) => {
  const target = tasksParsed.tasks.find((t) => t.id === taskId);
  if (!target) return;

  target.estado = 'done';
  target.resultado = addToken(target.resultado, 'memory:written');

  // Mark evidence as verified
  const evidence = readEvidence(taskId);
  if (evidence) {
    evidence.verified = true;
    writeJSON(path.join(EVIDENCE_DIR, `${taskId}.json`), evidence);
  }

  const taskMap = new Map(tasksParsed.tasks.map((t) => [t.id, t]));
  saveTasks(tasksParsed.table, taskMap);

  if (!state.completed_tasks.includes(taskId)) {
    state.completed_tasks.push(taskId);
  }

  state.current_task_id = null;
  state.awaiting_agent = null;
  state.last_agent = 'memory';
  state.last_action = 'task_closed';
  state.metrics.tasks_done = state.completed_tasks.length;
};

// ============================================================
// EVIDENCE VALIDATION — The anti-skip gate
// ============================================================

const validateExecutionEvidence = (taskId, projectDir, config) => {
  // If no project root configured, we can't validate — warn but don't block
  if (!projectDir) {
    console.log('[WARN] No project_root configured in system/config.json evidence section.');
    console.log('[WARN] Evidence validation SKIPPED — configure evidence.project_root to enable.');
    return { valid: true, reason: 'no_project_root_configured', warning: true };
  }

  // Check if pre-snapshot exists
  if (!hasPreSnapshot(taskId)) {
    console.log(`[WARN] No pre-snapshot found for ${taskId}. Creating post-snapshot for comparison.`);
    // If no pre-snapshot, we can't diff — but we can still check if evidence was manually provided
    const evidence = readEvidence(taskId);
    if (evidence && evidence.total_changes > 0) {
      return { valid: true, reason: 'manual_evidence_provided' };
    }
    return { valid: false, reason: 'no_pre_snapshot_and_no_evidence' };
  }

  // Create post-snapshot and diff
  const evidence = createPostSnapshotAndDiff(taskId, projectDir, config);

  if (evidence.error) {
    return { valid: false, reason: evidence.error };
  }

  const minChanges = config?.evidence?.min_files_changed || 1;
  if (evidence.total_changes < minChanges) {
    return {
      valid: false,
      reason: 'no_file_changes_detected',
      total_changes: evidence.total_changes,
      min_required: minChanges
    };
  }

  return {
    valid: true,
    reason: 'evidence_validated',
    total_changes: evidence.total_changes,
    files_changed: evidence.files_changed.length,
    files_created: evidence.files_created.length,
    files_deleted: evidence.files_deleted.length
  };
};

// ============================================================
// ORCHESTRATION ENGINE
// ============================================================

const orchestrate = async (system) => {
  const { state, config } = system;
  if (!state) {
    console.log('[ERROR] Missing system/state.json');
    return false;
  }

  console.log(`\n[LOOP] Iteration ${state.iteration}/${state.max_iterations} | Phase: ${state.phase} | Awaiting: ${state.awaiting_agent || '-'}`);

  if (state.halted) {
    console.log(`[HALT] System HALTED: ${state.halt_reason}`);
    return false;
  }

  if (state.iteration >= state.max_iterations) {
    state.halted = true;
    state.halt_reason = 'max_iterations_reached';
    state.status = 'halted';
    state.last_updated = new Date().toISOString();
    persistState(state);
    console.log('[HALT] HALT: max iterations reached');
    return false;
  }

  if (state.phase === 'init' || state.phase === 'idle') {
    state.phase = 'planning';
    state.awaiting_agent = 'planner';
    state.status = 'running';
    state.last_agent = 'runner';
    state.last_action = 'phase_planning';
    state.last_updated = new Date().toISOString();
    persistState(state);
    printAgentPrompt('planner');
    return false;
  }

  const tasksParsed = parseTasks(system.tasks || '');
  const planReady = Boolean(system.plan && system.plan.trim());

  if (state.phase === 'planning') {
    if (tasksParsed && validateTasks(tasksParsed) && !validateTasks(tasksParsed).valid) {
      const tasksValidation = validateTasks(tasksParsed);
      state.halted = true;
      state.halt_reason = 'invalid_tasks_schema';
      state.status = 'halted';
      state.last_agent = 'runner';
      state.last_action = 'invalid_tasks_schema';
      state.last_updated = new Date().toISOString();
      persistState(state);
      console.log('[HALT] HALT: invalid tasks schema detected.');
      tasksValidation.errors.forEach((e) => console.log(`   - ${e}`));
      return false;
    }

    if (!planReady || !tasksParsed || tasksParsed.tasks.length === 0) {
      state.awaiting_agent = 'planner';
      state.last_agent = 'runner';
      state.last_action = 'awaiting_planner_output';
      state.last_updated = new Date().toISOString();
      persistState(state);
      printAgentPrompt('planner');
      return false;
    }

    state.phase = 'execution';
    state.awaiting_agent = null;
    state.last_agent = 'planner';
    state.last_action = 'plan_generated';
    state.metrics.tasks_total = tasksParsed.tasks.length;
    state.last_updated = new Date().toISOString();
    persistState(state);
    console.log(`[OK] Planner output detected. Tasks loaded: ${tasksParsed.tasks.length}`);
    return true;
  }

  if (state.phase === 'execution') {
    const tasksValidation = tasksParsed ? validateTasks(tasksParsed) : null;

    if (tasksParsed && tasksValidation && !tasksValidation.valid) {
      state.halted = true;
      state.halt_reason = 'invalid_tasks_schema';
      state.status = 'halted';
      state.last_agent = 'runner';
      state.last_action = 'invalid_tasks_schema';
      state.last_updated = new Date().toISOString();
      persistState(state);
      console.log('[HALT] HALT: invalid tasks schema detected.');
      tasksValidation.errors.forEach((e) => console.log(`   - ${e}`));
      return false;
    }

    if (!tasksParsed || tasksParsed.tasks.length === 0) {
      state.halted = true;
      state.halt_reason = 'invalid_or_empty_tasks';
      state.status = 'halted';
      state.last_agent = 'runner';
      state.last_action = 'halted_no_tasks';
      state.last_updated = new Date().toISOString();
      persistState(state);
      console.log('[HALT] HALT: tasks.md is missing/invalid. Planner must generate a valid tasks table.');
      return false;
    }

    state.metrics.tasks_total = tasksParsed.tasks.length;

    const allDone = tasksParsed.tasks.every((t) => t.estado === 'done');
    if (allDone) {
      state.phase = 'complete';
      state.status = 'completed';
      state.awaiting_agent = null;
      state.last_agent = 'runner';
      state.last_action = 'all_tasks_done';
      state.metrics.tasks_done = tasksParsed.tasks.length;
      state.last_updated = new Date().toISOString();
      persistState(state, 'run_completed');
      writeRunSummary(state, tasksParsed);
      console.log('[OK] All tasks completed');
      return false;
    }

    if (!state.current_task_id) {
      const nextTask = chooseNextPendingTask(tasksParsed.tasks);
      if (!nextTask) {
        const hasPending = tasksParsed.tasks.some((t) => t.estado === 'pending');
        if (hasPending) {
          console.log('[INFO] Pending tasks are blocked by dependencies. Complete prerequisite tasks first.');
        } else {
          console.log('[INFO] No pending tasks available. Check task statuses/dependencies.');
        }
        return false;
      }

      // === EVIDENCE: Create pre-snapshot before executor runs ===
      const projectDir = getProjectRoot(config);
      if (projectDir) {
        console.log(`[EVIDENCE] Creating pre-execution snapshot for ${nextTask.id}...`);
        createPreSnapshot(nextTask.id, projectDir, config);
        logEvidence(state, nextTask.id, 'pre_snapshot_created', `project_dir=${projectDir}`);
      } else {
        console.log('[WARN] No project_root in config.json — evidence tracking disabled.');
        console.log('[WARN] Set evidence.project_root in system/config.json to enable anti-skip protection.');
      }

      state.current_task_id = nextTask.id;
      state.awaiting_agent = 'executor';
      state.last_agent = 'runner';
      state.last_action = 'task_selected';
      state.last_updated = new Date().toISOString();
      persistState(state);
      printAgentPrompt('executor', nextTask.id, { skill: nextTask.skill });
      return false;
    }

    const task = tasksParsed.tasks.find((t) => t.id === state.current_task_id);
    if (!task) {
      state.current_task_id = null;
      state.awaiting_agent = null;
      state.last_agent = 'runner';
      state.last_action = 'task_not_found_reset';
      state.last_updated = new Date().toISOString();
      persistState(state);
      return true;
    }

    if (!state.awaiting_agent || state.awaiting_agent === 'executor') {
      if (!hasToken(task.resultado, 'executor:done')) {
        state.awaiting_agent = 'executor';
        state.last_updated = new Date().toISOString();
        persistState(state);
        printAgentPrompt('executor', task.id, { skill: task.skill });
        return false;
      }

      // === EVIDENCE GATE: Validate real file changes before accepting executor:done ===
      const projectDir = getProjectRoot(config);
      if (projectDir) {
        const validation = validateExecutionEvidence(task.id, projectDir, config);

        if (!validation.valid) {
          // REJECT executor:done — strip the token
          console.log(`[REJECT] executor:done REJECTED for ${task.id} — ${validation.reason}`);
          console.log('[REJECT] The executor must make REAL changes to project source files.');
          logEvidence(state, task.id, 'evidence_rejected', `reason=${validation.reason}`);

          // Strip the executor:done token from resultado
          task.resultado = stripToken(task.resultado, 'executor:done');
          const taskMap = new Map(tasksParsed.tasks.map((t) => [t.id, t]));
          saveTasks(tasksParsed.table, taskMap);

          // Increment rejection counter
          if (!state.metrics.evidence_rejections) state.metrics.evidence_rejections = 0;
          state.metrics.evidence_rejections++;

          // Re-create pre-snapshot for next attempt
          console.log(`[EVIDENCE] Re-creating pre-snapshot for ${task.id} retry...`);
          createPreSnapshot(task.id, projectDir, config);

          state.awaiting_agent = 'executor';
          state.last_agent = 'runner';
          state.last_action = 'executor_rejected_no_evidence';
          state.last_updated = new Date().toISOString();
          persistState(state);
          printAgentPrompt('executor', task.id, { skill: task.skill, rejected: true });
          return false;
        }

        console.log(`[EVIDENCE] Validated for ${task.id}: ${validation.total_changes} file(s) changed`);
        logEvidence(state, task.id, 'evidence_validated', `changes=${validation.total_changes} files_changed=${validation.files_changed} files_created=${validation.files_created}`);
      }

      state.awaiting_agent = 'qa';
      state.last_agent = 'executor';
      state.last_action = 'executor_done';
      state.last_updated = new Date().toISOString();
      persistState(state);
      printAgentPrompt('qa', task.id);
      return false;
    }

    if (state.awaiting_agent === 'qa') {
      if (hasToken(task.resultado, 'qa:fail')) {
        state.metrics.qa_fails++;

        // Re-create pre-snapshot for executor retry
        const projectDir = getProjectRoot(config);
        if (projectDir) {
          createPreSnapshot(task.id, projectDir, config);
        }

        state.awaiting_agent = 'executor';
        state.last_agent = 'qa';
        state.last_action = 'qa_failed';
        state.last_updated = new Date().toISOString();
        persistState(state);
        printAgentPrompt('executor', task.id, { skill: task.skill });
        return false;
      }

      if (!hasToken(task.resultado, 'qa:pass')) {
        state.last_updated = new Date().toISOString();
        persistState(state);
        printAgentPrompt('qa', task.id);
        return false;
      }

      state.metrics.qa_passes++;
      state.awaiting_agent = 'reviewer';
      state.last_agent = 'qa';
      state.last_action = 'qa_passed';
      state.last_updated = new Date().toISOString();
      persistState(state);
      printAgentPrompt('reviewer', task.id);
      return false;
    }

    if (state.awaiting_agent === 'reviewer') {
      if (hasToken(task.resultado, 'review:fail')) {
        state.metrics.review_fails++;

        // Re-create pre-snapshot for executor retry
        const projectDir = getProjectRoot(config);
        if (projectDir) {
          createPreSnapshot(task.id, projectDir, config);
        }

        state.awaiting_agent = 'executor';
        state.last_agent = 'reviewer';
        state.last_action = 'review_failed';
        state.last_updated = new Date().toISOString();
        persistState(state);
        printAgentPrompt('executor', task.id, { skill: task.skill });
        return false;
      }

      if (!hasToken(task.resultado, 'review:pass')) {
        state.last_updated = new Date().toISOString();
        persistState(state);
        printAgentPrompt('reviewer', task.id);
        return false;
      }

      state.metrics.review_passes++;
      state.awaiting_agent = 'memory';
      state.last_agent = 'reviewer';
      state.last_action = 'review_passed';
      state.last_updated = new Date().toISOString();
      persistState(state);
      printAgentPrompt('memory', task.id);
      return false;
    }

    if (state.awaiting_agent === 'memory') {
      if (!hasMemoryEntryForTask(system.memory || '', task.id)) {
        state.last_updated = new Date().toISOString();
        persistState(state);
        printAgentPrompt('memory', task.id);
        return false;
      }

      markTaskDone(state, tasksParsed, task.id);
      state.iteration++;
      state.last_updated = new Date().toISOString();
      persistState(state);
      console.log(`[OK] Task ${task.id} closed. Continuing with next pending task.`);
      return true;
    }
  }

  if (state.phase === 'complete') {
    if (tasksParsed && tasksParsed.tasks && tasksParsed.tasks.length > 0) {
      writeRunSummary(state, tasksParsed);
    }
    console.log('\n[OK] PROJECT COMPLETED SUCCESSFULLY');
    console.log(`   Tasks done: ${state.metrics.tasks_done}`);
    console.log(`   Review passes: ${state.metrics.review_passes}`);
    console.log(`   QA passes: ${state.metrics.qa_passes}`);
    console.log(`   Evidence rejections: ${state.metrics.evidence_rejections || 0}`);
    return false;
  }

  return false;
};

const printStatus = () => {
  const system = loadSystem();
  const state = system.state;
  if (!state) {
    console.log('[ERROR] Missing system/state.json');
    return;
  }

  const tasksParsed = parseTasks(system.tasks || '');
  const total = tasksParsed?.tasks?.length || 0;
  const pending = tasksParsed?.tasks?.filter((t) => t.estado === 'pending').length || 0;
  const running = tasksParsed?.tasks?.filter((t) => t.estado === 'running').length || 0;
  const done = tasksParsed?.tasks?.filter((t) => t.estado === 'done').length || 0;
  const failed = tasksParsed?.tasks?.filter((t) => t.estado === 'failed').length || 0;

  const projectDir = getProjectRoot(system.config);

  console.log('[STATUS] Current run state');
  console.log(`- run_id: ${state.run_id || '-'}`);
  console.log(`- phase: ${state.phase}`);
  console.log(`- iteration: ${state.iteration}/${state.max_iterations}`);
  console.log(`- status: ${state.status}`);
  console.log(`- halted: ${state.halted} (${state.halt_reason || '-'})`);
  console.log(`- current_task_id: ${state.current_task_id || '-'}`);
  console.log(`- awaiting_agent: ${state.awaiting_agent || '-'}`);
  console.log(`- evidence_required: ${state.evidence_required !== false}`);
  console.log(`- project_root: ${projectDir || 'NOT SET (evidence disabled)'}`);
  console.log(`- tasks: total=${total}, pending=${pending}, running=${running}, done=${done}, failed=${failed}`);
  console.log(`- qa: pass=${state.metrics.qa_passes}, fail=${state.metrics.qa_fails}`);
  console.log(`- review: pass=${state.metrics.review_passes}, fail=${state.metrics.review_fails}`);
  console.log(`- evidence_rejections: ${state.metrics.evidence_rejections || 0}`);
};

const runOneStep = async () => {
  const system = loadSystem();
  await orchestrate(system);
  console.log('\n[END] Runner next-step finished\n');
};

const runLoop = async (goalFromArgs) => {
  let goal = readFile(GOAL_FILE);
  const config = readJSON(CONFIG_FILE);
  let state = readJSON(STATE_FILE);
  let startedNewRun = false;

  if (goalFromArgs) {
    console.log(`\n[GOAL] Goal from command line: ${goalFromArgs}`);
    writeFile(GOAL_FILE, `# Goal\n\n${goalFromArgs}\n`);
    goal = goalFromArgs;
    resetRunArtifacts();
    console.log('[INIT] New goal detected. Starting a fresh run.');
    state = initializeState(goal, config);
    startedNewRun = true;
  } else if (!goal) {
    console.error('\n[ERROR] ERROR: No goal provided');
    console.error("   Use: node runner.js 'Your goal here'");
    console.error('   Or create system/goal.md manually');
    process.exit(1);
  }

  if (!state || state.status === 'complete' || state.phase === 'complete') {
    console.log('\n[INIT] Initializing new run...');
    state = initializeState(goal, config);
    startedNewRun = true;
  } else if (!startedNewRun) {
    console.log(`\n[STATE] Resuming run: ${state.run_id || '(missing run id)'}`);
  }

  let shouldContinue = true;
  while (shouldContinue) {
    const system = loadSystem();
    shouldContinue = await orchestrate(system);
  }
};

const main = async () => {
  const args = process.argv.slice(2);
  const command = (args[0] || '').toLowerCase();
  const knownCommands = new Set(['init', 'start', 'status', 'next']);

  console.log('\n[RUNNER] Agent System Runner v2.0 (Evidence-Enforced)');
  console.log('=====================================================');

  if (command === 'init') {
    const goal = args.slice(1).join(' ').trim() || 'Define project goal here';
    const config = readJSON(CONFIG_FILE);
    writeFile(GOAL_FILE, `# Goal\n\n${goal}\n`);
    resetRunArtifacts();
    const state = initializeState(goal, config);
    console.log(`[INIT] New run initialized: ${state.run_id}`);
    const projectDir = getProjectRoot(config);
    if (!projectDir) {
      console.log('[WARN] No project_root configured. Set evidence.project_root in system/config.json');
    } else {
      console.log(`[INIT] Project root: ${projectDir}`);
    }
    console.log('\n[END] Runner finished\n');
    return;
  }

  if (command === 'start') {
    const goal = args.slice(1).join(' ').trim() || 'Define project goal here';
    const config = readJSON(CONFIG_FILE);
    writeFile(GOAL_FILE, `# Goal\n\n${goal}\n`);
    resetRunArtifacts();
    const state = initializeState(goal, config);
    console.log(`[INIT] New run initialized: ${state.run_id}`);
    const projectDir = getProjectRoot(config);
    if (!projectDir) {
      console.log('[WARN] No project_root configured. Set evidence.project_root in system/config.json');
    } else {
      console.log(`[INIT] Project root: ${projectDir}`);
    }
    await runOneStep();
    return;
  }

  if (command === 'status') {
    printStatus();
    console.log('\n[END] Runner finished\n');
    return;
  }

  if (command === 'next') {
    await runOneStep();
    return;
  }

  const goalFromArgs = knownCommands.has(command) ? '' : args.join(' ');
  await runLoop(goalFromArgs);
  console.log('\n[END] Runner finished\n');
};

if (require.main === module) {
  main().catch((err) => {
    console.error('[ERROR] Error:', err);
    process.exit(1);
  });
}

module.exports = { main, loadSystem, orchestrate, scanProjectFiles, createPreSnapshot, createPostSnapshotAndDiff, validateExecutionEvidence };
