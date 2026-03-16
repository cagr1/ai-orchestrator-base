const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SYSTEM = path.join(ROOT, 'system');
const EVIDENCE_DIR = path.join(SYSTEM, 'evidence');
const RUNNER = path.join(ROOT, 'runner.js');

const filesToBackup = [
  'goal.md',
  'plan.md',
  'plan_request.md',
  'tasks.yaml',
  'state.json',
  'config.json',
  'memory.md',
  'context.md',
  'status.md',
  'events.log'
];

function readIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : null;
}

function writeIfNotNull(filePath, content) {
  if (content === null || content === undefined) return;
  fs.writeFileSync(filePath, content, 'utf-8');
}

function backupSystem() {
  const backup = {};
  for (const file of filesToBackup) {
    const full = path.join(SYSTEM, file);
    backup[file] = readIfExists(full);
  }

  const evidenceFiles = fs.existsSync(EVIDENCE_DIR)
    ? fs.readdirSync(EVIDENCE_DIR).filter(f => f !== '.gitkeep')
    : [];
  const evidenceBackup = {};
  for (const file of evidenceFiles) {
    const full = path.join(EVIDENCE_DIR, file);
    evidenceBackup[file] = readIfExists(full);
  }

  return { backup, evidenceBackup };
}

function restoreSystem(snapshot) {
  for (const file of filesToBackup) {
    const full = path.join(SYSTEM, file);
    if (snapshot.backup[file] === null) {
      if (fs.existsSync(full)) fs.unlinkSync(full);
    } else {
      writeIfNotNull(full, snapshot.backup[file]);
    }
  }

  if (!fs.existsSync(EVIDENCE_DIR)) {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  }
  const current = fs.readdirSync(EVIDENCE_DIR).filter(f => f !== '.gitkeep');
  for (const file of current) {
    fs.unlinkSync(path.join(EVIDENCE_DIR, file));
  }
  for (const [file, content] of Object.entries(snapshot.evidenceBackup)) {
    fs.writeFileSync(path.join(EVIDENCE_DIR, file), content, 'utf-8');
  }
  if (!fs.existsSync(path.join(EVIDENCE_DIR, '.gitkeep'))) {
    fs.writeFileSync(path.join(EVIDENCE_DIR, '.gitkeep'), '');
  }
}

function run(cmd) {
  execSync(cmd, { stdio: 'ignore' });
}

console.log('Testing Phase CLI Commands...');

const snapshot = backupSystem();
try {
  run(`node ${RUNNER} init "CLI Test"`);
  run(`node ${RUNNER} plan "Add login module"`);

  const planRequest = readIfExists(path.join(SYSTEM, 'plan_request.md'));
  assert(planRequest && planRequest.includes('Add login module'), 'plan_request.md should include latest request');

  const tasksYaml = `
version: "3.0"
generated_at: "2026-03-16T00:00:00Z"
run_id: "cli-test"
tasks:
  - id: "T1"
    title: "Create demo file"
    description: "Create a demo file for CLI test"
    skill: "frontend-ux-accessibility"
    estado: "pending"
    priority: 1
    depends_on: []
    attempts: 0
    max_attempts: 2
    input: []
    output: ["demo/cli-test.txt"]
metadata:
  total_tasks: 1
  completed: 0
  pending: 1
  failed: 0
  blocked: 0
`.trim() + '\n';

  fs.writeFileSync(path.join(SYSTEM, 'tasks.yaml'), tasksYaml, 'utf-8');

  const config = JSON.parse(readIfExists(path.join(SYSTEM, 'config.json')) || '{}');
  config.evidence = { required: true, min_files_changed: 1, excluded_paths: ['system/'] };
  config.review_criteria = { require_acceptance_criteria: false };
  fs.writeFileSync(path.join(SYSTEM, 'config.json'), JSON.stringify(config, null, 2));

  if (!fs.existsSync(path.join(ROOT, 'demo'))) {
    fs.mkdirSync(path.join(ROOT, 'demo'), { recursive: true });
  }
  fs.writeFileSync(path.join(ROOT, 'demo', 'cli-test.txt'), 'ok', 'utf-8');

  run(`node ${RUNNER} done T1 demo/cli-test.txt`);

  const updated = readIfExists(path.join(SYSTEM, 'tasks.yaml'));
  assert(updated && updated.includes('estado: done'), 'Task should be marked done');

  const evidenceFile = readIfExists(path.join(EVIDENCE_DIR, 'T1.json'));
  assert(evidenceFile && evidenceFile.includes('demo/cli-test.txt'), 'Evidence should reference demo/cli-test.txt');

  run(`node ${RUNNER} verify`);

  console.log('✓ CLI commands work (plan, done, evidence, verify)');
} finally {
  restoreSystem(snapshot);
}
