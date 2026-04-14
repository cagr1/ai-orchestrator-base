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
  execSync(cmd, { stdio: 'ignore', cwd: ROOT });
}

// Quote path to handle directories with spaces
const RUNNER_QUOTED = `"${RUNNER}"`;

console.log('Testing Phase SDD Full Flow...');

const snapshot = backupSystem();
try {
  run(`node ${RUNNER_QUOTED} init "SDD Flow Test"`);
  run(`node ${RUNNER_QUOTED} plan "Create login module"`);

  const plan = `
# Plan

## Run ID
${readIfExists(path.join(SYSTEM, 'state.json')) ? JSON.parse(readIfExists(path.join(SYSTEM, 'state.json'))).run_id : 'sdd-flow'}

## Generado por
planner.md  iteracion 0

## Fases

### FASE 1: Core
- Objetivo: login demo
- Skills: frontend-ux-accessibility, security-api-security
- Criterio de salida: artefactos definidos

## Dependencias entre fases
FASE 1 depende de: -
`.trim() + '\n';

  fs.writeFileSync(path.join(SYSTEM, 'plan.md'), plan, 'utf-8');

  const tasksYaml = `
version: "3.0"
generated_at: "2026-03-16T00:00:00Z"
run_id: "sdd-flow"
tasks:
  - id: "T1"
    title: "UX login"
    description: "Define UX login"
    skill: "frontend-ux-accessibility"
    estado: "pending"
    priority: 1
    depends_on: []
    attempts: 0
    max_attempts: 2
    input: []
    output: ["demo/sdd-ux.md"]
  - id: "T2"
    title: "Auth contract"
    description: "Define auth contract"
    skill: "security-api-security"
    estado: "pending"
    priority: 2
    depends_on: ["T1"]
    attempts: 0
    max_attempts: 2
    input: ["demo/sdd-ux.md"]
    output: ["demo/sdd-auth.md"]
metadata:
  total_tasks: 2
  completed: 0
  pending: 2
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
  fs.writeFileSync(path.join(ROOT, 'demo', 'sdd-ux.md'), 'ux', 'utf-8');

  run(`node ${RUNNER_QUOTED} run`);
  run(`node ${RUNNER_QUOTED} done T1 demo/sdd-ux.md`);

  fs.writeFileSync(path.join(ROOT, 'demo', 'sdd-auth.md'), 'auth', 'utf-8');
  run(`node ${RUNNER_QUOTED} run`);
  run(`node ${RUNNER_QUOTED} done T2 demo/sdd-auth.md`);

  run(`node ${RUNNER_QUOTED} run`);

  const state = JSON.parse(readIfExists(path.join(SYSTEM, 'state.json')));
  assert(state.status === 'completed', 'Flow should complete');

  console.log('✓ SDD flow completes end-to-end');
} finally {
  restoreSystem(snapshot);
}
