#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SYSTEM = path.join(ROOT, 'system');
const GOAL = path.join(SYSTEM, 'goal.md');
const PLAN = path.join(SYSTEM, 'plan.md');
const TASKS = path.join(SYSTEM, 'tasks.md');
const STATE = path.join(SYSTEM, 'state.json');

const run = (command) => cp.execSync(command, { cwd: ROOT, encoding: 'utf-8' });
const read = (file) => fs.readFileSync(file, 'utf-8');
const write = (file, content) => fs.writeFileSync(file, content, 'utf-8');
const readState = () => JSON.parse(read(STATE).replace(/^\uFEFF/, ''));

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const testInit = () => {
  run('node scripts/init-project.js "Smoke init goal"');
  const state = readState();
  assert(state.phase === 'planning', 'init: phase must be planning');
  assert(state.awaiting_agent === 'planner', 'init: awaiting_agent must be planner');
  assert(read(PLAN).trim() === '', 'init: plan must be empty');
  assert(read(TASKS).trim() === '', 'init: tasks must be empty');
};

const testInvalidTasksHalt = () => {
  run('node scripts/init-project.js "Smoke invalid schema"');
  write(PLAN, '# Plan\n\nDemo\n');
  write(TASKS, [
    '# Tasks',
    '',
    '| id | estado | resultado | dependencias |',
    '| --- | --- | --- | --- |',
    '| T001 | pending | - | T001 |',
    '| T001 | pending | - | - |'
  ].join('\n'));

  run('node runner.js');
  const state = readState();
  assert(state.halted === true, 'invalid schema: state.halted must be true');
  assert(state.halt_reason === 'invalid_tasks_schema', 'invalid schema: halt_reason must be invalid_tasks_schema');
};

const testDependenciesSelection = () => {
  run('node scripts/init-project.js "Smoke dependencies"');
  write(PLAN, '# Plan\n\nDemo\n');
  write(TASKS, [
    '# Tasks',
    '',
    '| id | estado | resultado | dependencias |',
    '| --- | --- | --- | --- |',
    '| T001 | pending | - | - |',
    '| T002 | pending | - | T001 |'
  ].join('\n'));

  const output = run('node runner.js');
  assert(output.includes('Executor Agent for T001'), 'dependencies: runner must select T001 first');
};

const testRunSnapshots = () => {
  run('node scripts/init-project.js "Smoke snapshots"');
  run('node runner.js');
  const state = readState();
  const runDir = path.join(SYSTEM, 'runs', state.run_id);
  assert(fs.existsSync(runDir), 'snapshots: run directory must exist');
  assert(fs.existsSync(path.join(runDir, 'state.json')), 'snapshots: state snapshot must exist');
  assert(fs.existsSync(path.join(runDir, 'events.log')), 'snapshots: events log must exist');
};

const main = () => {
  console.log('[SMOKE] Running runner smoke tests...');
  testInit();
  testInvalidTasksHalt();
  testDependenciesSelection();
  testRunSnapshots();
  console.log('[SMOKE] All tests passed.');
};

main();
