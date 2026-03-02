#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SYSTEM_DIR = path.join(ROOT, 'system');
const GOAL_FILE = path.join(SYSTEM_DIR, 'goal.md');
const PLAN_FILE = path.join(SYSTEM_DIR, 'plan.md');
const TASKS_FILE = path.join(SYSTEM_DIR, 'tasks.md');
const STATE_FILE = path.join(SYSTEM_DIR, 'state.json');
const CONFIG_FILE = path.join(SYSTEM_DIR, 'config.json');

const readJSON = (file) => {
  const content = fs.readFileSync(file, 'utf-8');
  return JSON.parse(content);
};

const write = (file, content) => {
  fs.writeFileSync(file, content, 'utf-8');
};

const generateRunId = (goal) => {
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const goalSlug = goal.slice(0, 20).toLowerCase().replace(/[^a-z0-9]/g, '-');
  return `${goalSlug}-${timestamp}`;
};

const createInitialState = (goal, maxIterations) => ({
  version: '1.1',
  run_id: generateRunId(goal),
  phase: 'planning',
  iteration: 0,
  max_iterations: maxIterations || 20,
  status: 'running',
  current_task_id: null,
  awaiting_agent: 'planner',
  completed_tasks: [],
  failed_tasks: [],
  skipped_tasks: [],
  halted: false,
  halt_reason: null,
  last_agent: 'runner',
  last_action: 'awaiting_planner_output',
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
});

const main = () => {
  const cliGoal = process.argv.slice(2).join(' ').trim();
  const goalText = cliGoal || 'Define project goal here';

  if (!fs.existsSync(SYSTEM_DIR)) {
    console.error('[ERROR] system directory not found.');
    process.exit(1);
  }

  const config = fs.existsSync(CONFIG_FILE) ? readJSON(CONFIG_FILE) : {};
  const state = createInitialState(goalText, config.max_iterations);

  write(GOAL_FILE, `# Goal\n\n${goalText}\n`);
  write(PLAN_FILE, '');
  write(TASKS_FILE, '');
  write(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`);

  console.log('[OK] Project context initialized.');
  console.log(`[OK] run_id: ${state.run_id}`);
  console.log('[NEXT] Run Planner to generate plan/tasks.');
};

main();
