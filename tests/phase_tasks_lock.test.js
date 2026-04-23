const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { saveTasksWithLock, applyTasksSaveFailure, computeFileHash } = require('../runner');

const SYSTEM = path.join(__dirname, '..', 'system');
const TASKS_FILE = path.join(SYSTEM, 'tasks.yaml');

function readIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : null;
}

console.log('Testing Phase Tasks Lock...');

const backup = readIfExists(TASKS_FILE);
try {
  const tasksYaml = `
version: "3.0"
generated_at: "2026-03-16T00:00:00Z"
run_id: "lock-test"
tasks:
  - id: "T1"
    title: "Lock test"
    description: "Ensure optimistic lock works"
    skill: "frontend-ux-accessibility"
    estado: "pending"
    priority: 1
    depends_on: []
    attempts: 0
    max_attempts: 2
    input: []
    output: ["demo/lock.txt"]
metadata:
  total_tasks: 1
  completed: 0
  pending: 1
  failed: 0
  blocked: 0
`.trim() + '\n';

  fs.writeFileSync(TASKS_FILE, tasksYaml, 'utf-8');
  const hash = computeFileHash(TASKS_FILE);

  // Simulate external modification
  fs.appendFileSync(TASKS_FILE, '\n# external change\n', 'utf-8');

  const doc = {
    version: '3.0',
    generated_at: '2026-03-16T00:00:00Z',
    run_id: 'lock-test',
    tasks: [
      {
        id: 'T1',
        title: 'Lock test',
        description: 'Ensure optimistic lock works',
        skill: 'frontend-ux-accessibility',
        estado: 'pending',
        priority: 1,
        depends_on: [],
        attempts: 0,
        max_attempts: 2,
        input: [],
        output: ['demo/lock.txt']
      }
    ],
    metadata: {
      total_tasks: 1,
      completed: 0,
      pending: 1,
      failed: 0,
      blocked: 0
    }
  };

  const result = saveTasksWithLock(doc, hash);
  assert(result.ok === false, 'Expected lock conflict');
  assert(result.reason === 'tasks_yaml_conflict', 'Expected tasks_yaml_conflict reason');

  const state = {
    phase: 'execution',
    status: 'running',
    halt_reason: null
  };
  const hardFailure = applyTasksSaveFailure(state, result);
  assert(state.phase === 'needs_review', 'Save conflict should move phase to needs_review');
  assert(state.status === 'needs_review', 'Save conflict should move status to needs_review');
  assert(state.halt_reason === 'tasks_yaml_conflict', 'Save conflict should preserve halt reason');
  assert(hardFailure.failureClass === 'tasks_yaml_conflict', 'Hard failure should preserve conflict class');
  assert(hardFailure.haltReason === 'tasks_yaml_conflict', 'Hard failure should preserve halt reason');

  console.log('✓ Optimistic lock prevents overwriting external changes');
} finally {
  if (backup === null) {
    if (fs.existsSync(TASKS_FILE)) fs.unlinkSync(TASKS_FILE);
  } else {
    fs.writeFileSync(TASKS_FILE, backup, 'utf-8');
  }
}
