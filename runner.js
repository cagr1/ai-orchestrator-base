#!/usr/bin/env node

/**
 * Agent System Runner
 *
 * Comando: node runner.js "Build mini ecommerce static catalog with filters"
 *
 * Flujo estandar: goal -> planner -> tasks -> executor -> qa -> reviewer -> memory -> repeat
 */

const fs = require('fs');
const path = require('path');

const SYSTEM_DIR = './system';
const GOAL_FILE = path.join(SYSTEM_DIR, 'goal.md');
const PLAN_FILE = path.join(SYSTEM_DIR, 'plan.md');
const TASKS_FILE = path.join(SYSTEM_DIR, 'tasks.md');
const MEMORY_FILE = path.join(SYSTEM_DIR, 'memory.md');
const STATE_FILE = path.join(SYSTEM_DIR, 'state.json');
const CONFIG_FILE = path.join(SYSTEM_DIR, 'config.json');

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
  return content ? JSON.parse(content) : null;
};

const writeJSON = (filepath, data) => {
  writeFile(filepath, JSON.stringify(data, null, 2));
};

const resetRunArtifacts = () => {
  writeFile(PLAN_FILE, '');
  writeFile(TASKS_FILE, '');
};

const taskIdPattern = /^T\d+$/i;

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

  const requiredColumns = ['id', 'estado', 'resultado'];
  if (!requiredColumns.every((c) => table.headers.includes(c))) {
    return null;
  }

  const tasks = table.rows
    .filter((row) => taskIdPattern.test((row.id || '').trim()))
    .map((row) => ({
      id: (row.id || '').trim(),
      estado: (row.estado || '').trim().toLowerCase(),
      resultado: (row.resultado || '').trim().toLowerCase(),
      raw: row
    }));

  return { table, tasks };
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

const chooseNextPendingTask = (tasks) => tasks.find((t) => t.estado === 'pending');

const generateRunId = (goal) => {
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const goalSlug = goal.slice(0, 20).toLowerCase().replace(/[^a-z0-9]/g, '-');
  return `${goalSlug}-${timestamp}`;
};

const initializeState = (goal, config) => {
  const runId = generateRunId(goal);
  const state = {
    version: '1.1',
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
    metrics: {
      tasks_total: 0,
      tasks_done: 0,
      tasks_failed: 0,
      review_passes: 0,
      review_fails: 0,
      qa_passes: 0,
      qa_fails: 0
    }
  };

  writeJSON(STATE_FILE, state);
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

const printAgentPrompt = (agent, taskId) => {
  if (agent === 'planner') {
    console.log('[ACTION] Action required: run Planner Agent to generate system/plan.md and system/tasks.md');
    return;
  }

  if (agent === 'executor') {
    console.log(`[ACTION] Action required: run Executor Agent for ${taskId}`);
    console.log('   Expected token in tasks.resultado: executor:done');
    return;
  }

  if (agent === 'qa') {
    console.log(`[ACTION] Action required: run QA Agent for ${taskId}`);
    console.log('   Expected token in tasks.resultado: qa:pass or qa:fail');
    return;
  }

  if (agent === 'reviewer') {
    console.log(`[ACTION] Action required: run Reviewer Agent for ${taskId}`);
    console.log('   Expected token in tasks.resultado: review:pass(score=X) or review:fail(score=X)');
    return;
  }

  if (agent === 'memory') {
    console.log(`[ACTION] Action required: append decision log for ${taskId} in system/memory.md`);
  }
};

const markTaskDone = (state, tasksParsed, taskId) => {
  const target = tasksParsed.tasks.find((t) => t.id === taskId);
  if (!target) return;

  target.estado = 'done';
  target.resultado = addToken(target.resultado, 'memory:written');

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

const orchestrate = async (system) => {
  const { state } = system;
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
    writeJSON(STATE_FILE, state);
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
    writeJSON(STATE_FILE, state);
    printAgentPrompt('planner');
    return false;
  }

  const tasksParsed = parseTasks(system.tasks || '');
  const planReady = Boolean(system.plan && system.plan.trim());

  if (state.phase === 'planning') {
    if (!planReady || !tasksParsed || tasksParsed.tasks.length === 0) {
      state.awaiting_agent = 'planner';
      state.last_agent = 'runner';
      state.last_action = 'awaiting_planner_output';
      state.last_updated = new Date().toISOString();
      writeJSON(STATE_FILE, state);
      printAgentPrompt('planner');
      return false;
    }

    state.phase = 'execution';
    state.awaiting_agent = null;
    state.last_agent = 'planner';
    state.last_action = 'plan_generated';
    state.metrics.tasks_total = tasksParsed.tasks.length;
    state.last_updated = new Date().toISOString();
    writeJSON(STATE_FILE, state);
    console.log(`[OK] Planner output detected. Tasks loaded: ${tasksParsed.tasks.length}`);
    return true;
  }

  if (state.phase === 'execution') {
    if (!tasksParsed || tasksParsed.tasks.length === 0) {
      state.halted = true;
      state.halt_reason = 'invalid_or_empty_tasks';
      state.status = 'halted';
      state.last_agent = 'runner';
      state.last_action = 'halted_no_tasks';
      state.last_updated = new Date().toISOString();
      writeJSON(STATE_FILE, state);
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
      writeJSON(STATE_FILE, state);
      console.log('[OK] All tasks completed');
      return false;
    }

    if (!state.current_task_id) {
      const nextTask = chooseNextPendingTask(tasksParsed.tasks);
      if (!nextTask) {
        console.log('[INFO] No pending tasks available. Check task statuses/dependencies.');
        return false;
      }

      state.current_task_id = nextTask.id;
      state.awaiting_agent = 'executor';
      state.last_agent = 'runner';
      state.last_action = 'task_selected';
      state.last_updated = new Date().toISOString();
      writeJSON(STATE_FILE, state);
      printAgentPrompt('executor', nextTask.id);
      return false;
    }

    const task = tasksParsed.tasks.find((t) => t.id === state.current_task_id);
    if (!task) {
      state.current_task_id = null;
      state.awaiting_agent = null;
      state.last_agent = 'runner';
      state.last_action = 'task_not_found_reset';
      state.last_updated = new Date().toISOString();
      writeJSON(STATE_FILE, state);
      return true;
    }

    if (!state.awaiting_agent || state.awaiting_agent === 'executor') {
      if (!hasToken(task.resultado, 'executor:done')) {
        state.awaiting_agent = 'executor';
        state.last_updated = new Date().toISOString();
        writeJSON(STATE_FILE, state);
        printAgentPrompt('executor', task.id);
        return false;
      }

      state.awaiting_agent = 'qa';
      state.last_agent = 'executor';
      state.last_action = 'executor_done';
      state.last_updated = new Date().toISOString();
      writeJSON(STATE_FILE, state);
      printAgentPrompt('qa', task.id);
      return false;
    }

    if (state.awaiting_agent === 'qa') {
      if (hasToken(task.resultado, 'qa:fail')) {
        state.metrics.qa_fails++;
        state.awaiting_agent = 'executor';
        state.last_agent = 'qa';
        state.last_action = 'qa_failed';
        state.last_updated = new Date().toISOString();
        writeJSON(STATE_FILE, state);
        printAgentPrompt('executor', task.id);
        return false;
      }

      if (!hasToken(task.resultado, 'qa:pass')) {
        state.last_updated = new Date().toISOString();
        writeJSON(STATE_FILE, state);
        printAgentPrompt('qa', task.id);
        return false;
      }

      state.metrics.qa_passes++;
      state.awaiting_agent = 'reviewer';
      state.last_agent = 'qa';
      state.last_action = 'qa_passed';
      state.last_updated = new Date().toISOString();
      writeJSON(STATE_FILE, state);
      printAgentPrompt('reviewer', task.id);
      return false;
    }

    if (state.awaiting_agent === 'reviewer') {
      if (hasToken(task.resultado, 'review:fail')) {
        state.metrics.review_fails++;
        state.awaiting_agent = 'executor';
        state.last_agent = 'reviewer';
        state.last_action = 'review_failed';
        state.last_updated = new Date().toISOString();
        writeJSON(STATE_FILE, state);
        printAgentPrompt('executor', task.id);
        return false;
      }

      if (!hasToken(task.resultado, 'review:pass')) {
        state.last_updated = new Date().toISOString();
        writeJSON(STATE_FILE, state);
        printAgentPrompt('reviewer', task.id);
        return false;
      }

      state.metrics.review_passes++;
      state.awaiting_agent = 'memory';
      state.last_agent = 'reviewer';
      state.last_action = 'review_passed';
      state.last_updated = new Date().toISOString();
      writeJSON(STATE_FILE, state);
      printAgentPrompt('memory', task.id);
      return false;
    }

    if (state.awaiting_agent === 'memory') {
      if (!hasMemoryEntryForTask(system.memory || '', task.id)) {
        state.last_updated = new Date().toISOString();
        writeJSON(STATE_FILE, state);
        printAgentPrompt('memory', task.id);
        return false;
      }

      markTaskDone(state, tasksParsed, task.id);
      state.iteration++;
      state.last_updated = new Date().toISOString();
      writeJSON(STATE_FILE, state);
      console.log(`[OK] Task ${task.id} closed. Continuing with next pending task.`);
      return true;
    }
  }

  if (state.phase === 'complete') {
    console.log('\n[OK] PROJECT COMPLETED SUCCESSFULLY');
    console.log(`   Tasks done: ${state.metrics.tasks_done}`);
    console.log(`   Review passes: ${state.metrics.review_passes}`);
    console.log(`   QA passes: ${state.metrics.qa_passes}`);
    return false;
  }

  return false;
};

const main = async () => {
  const goalFromArgs = process.argv.slice(2).join(' ');

  console.log('\n[RUNNER] Agent System Runner v1.1');
  console.log('============================');

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
  } else {
    if (!startedNewRun) {
      console.log(`\n[STATE] Resuming run: ${state.run_id || '(missing run id)'}`);
    }
  }

  let shouldContinue = true;
  while (shouldContinue) {
    const system = loadSystem();
    shouldContinue = await orchestrate(system);
  }

  console.log('\n[END] Runner finished\n');
};

if (require.main === module) {
  main().catch((err) => {
    console.error('[ERROR] Error:', err);
    process.exit(1);
  });
}

module.exports = { main, loadSystem, orchestrate };




