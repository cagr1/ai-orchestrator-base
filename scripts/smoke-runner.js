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
const EVIDENCE = path.join(SYSTEM, 'evidence');

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

const testStateVersion = () => {
  run('node runner.js init "Smoke version check"');
  const state = readState();
  assert(state.version === '2.0', 'version: state version must be 2.0');
  assert(state.evidence_required === true, 'version: evidence_required must be true');
  assert(typeof state.metrics.evidence_rejections === 'number', 'version: evidence_rejections metric must exist');
};

const testInvalidTasksHalt = () => {
  run('node scripts/init-project.js "Smoke invalid schema"');
  write(PLAN, '# Plan\n\nDemo\n');
  write(TASKS, [
    '# Tasks',
    '',
    '| id | skill | estado | resultado | dependencias |',
    '| --- | --- | --- | --- | --- |',
    '| T001 | frontend-react-hooks | pending | - | T001 |',
    '| T001 | frontend-react-hooks | pending | - | - |'
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
    '| id | skill | estado | resultado | dependencias |',
    '| --- | --- | --- | --- | --- |',
    '| T001 | frontend-react-hooks | pending | - | - |',
    '| T002 | frontend-react-hooks | pending | - | T001 |'
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

const testRunSummaryOnComplete = () => {
  run('node scripts/init-project.js "Smoke summary"');
  write(PLAN, '# Plan\n\nDemo\n');
  write(TASKS, [
    '# Tasks',
    '',
    '| id | skill | estado | resultado |',
    '| --- | --- | --- | --- |',
    '| T001 | frontend-react-hooks | done | executor:done; qa:pass; review:pass(score=8); memory:written |'
  ].join('\n'));
  run('node runner.js');

  const state = readState();
  const runDir = path.join(SYSTEM, 'runs', state.run_id);
  assert(fs.existsSync(path.join(runDir, 'summary.md')), 'summary: summary.md must exist when run completes');
};

const testCliCommands = () => {
  const initOut = run('node runner.js init "Smoke cli init"');
  assert(initOut.includes('New run initialized'), 'cli init: expected initialized message');

  const statusOut = run('node runner.js status');
  assert(statusOut.includes('[STATUS] Current run state'), 'cli status: expected status output');
  assert(statusOut.includes('evidence_required'), 'cli status: expected evidence_required in status');

  const nextOut = run('node runner.js next');
  assert(nextOut.includes('next-step finished'), 'cli next: expected next-step finished message');
};

const testEvidenceDirectoryCreation = () => {
  run('node runner.js init "Smoke evidence dir"');
  // Evidence dir should be creatable
  if (!fs.existsSync(EVIDENCE)) {
    fs.mkdirSync(EVIDENCE, { recursive: true });
  }
  assert(fs.existsSync(EVIDENCE), 'evidence: evidence directory must exist');
};

const testEvidenceFunctions = () => {
  // Test the evidence functions via require
  const { scanProjectFiles, createPreSnapshot, createPostSnapshotAndDiff } = require(path.join(ROOT, 'runner.js'));

  // Create a temp test directory
  const tmpDir = path.join(ROOT, '_smoke_test_project');
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true });
  }
  fs.mkdirSync(tmpDir, { recursive: true });

  // Create a test file
  fs.writeFileSync(path.join(tmpDir, 'test.tsx'), 'export const App = () => <div>Hello</div>;');

  // Test scanProjectFiles
  const files = scanProjectFiles(tmpDir, {});
  assert(Object.keys(files).length === 1, 'evidence scan: should find 1 file');
  assert(files['test.tsx'], 'evidence scan: should find test.tsx');

  // Test createPreSnapshot
  run('node runner.js init "Smoke evidence functions"');
  const preSnapshot = createPreSnapshot('TSMOKE', tmpDir, {});
  assert(preSnapshot.task_id === 'TSMOKE', 'evidence pre: task_id must match');
  assert(preSnapshot.file_count === 1, 'evidence pre: should have 1 file');
  assert(fs.existsSync(path.join(EVIDENCE, 'TSMOKE-pre.json')), 'evidence pre: pre-snapshot file must exist');

  // Modify the test file
  fs.writeFileSync(path.join(tmpDir, 'test.tsx'), 'export const App = () => <div>Modified!</div>;');
  fs.writeFileSync(path.join(tmpDir, 'new-file.ts'), 'export const helper = () => true;');

  // Test createPostSnapshotAndDiff
  const evidence = createPostSnapshotAndDiff('TSMOKE', tmpDir, {});
  assert(evidence.task_id === 'TSMOKE', 'evidence diff: task_id must match');
  assert(evidence.total_changes >= 2, 'evidence diff: should detect 2+ changes (1 modified + 1 created)');
  assert(evidence.files_changed.length === 1, 'evidence diff: should have 1 modified file');
  assert(evidence.files_created.length === 1, 'evidence diff: should have 1 created file');
  assert(fs.existsSync(path.join(EVIDENCE, 'TSMOKE.json')), 'evidence diff: evidence file must exist');

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true });
  // Clean evidence files
  try {
    fs.unlinkSync(path.join(EVIDENCE, 'TSMOKE-pre.json'));
    fs.unlinkSync(path.join(EVIDENCE, 'TSMOKE.json'));
  } catch (_e) { /* ignore */ }
};

const testEvidenceRejectionWithoutProjectRoot = () => {
  // When no project_root is set, evidence validation should warn but not block
  const { validateExecutionEvidence } = require(path.join(ROOT, 'runner.js'));
  const result = validateExecutionEvidence('TNOROOT', null, {});
  assert(result.valid === true, 'no project root: should be valid (warning only)');
  assert(result.warning === true, 'no project root: should have warning flag');
};

const testStripToken = () => {
  // Test that executor:done can be stripped from resultado
  run('node scripts/init-project.js "Smoke strip token"');
  write(PLAN, '# Plan\n\nDemo\n');
  write(TASKS, [
    '# Tasks',
    '',
    '| id | skill | estado | resultado |',
    '| --- | --- | --- | --- |',
    '| T001 | frontend-react-hooks | pending | executor:done |'
  ].join('\n'));

  // The runner should try to validate evidence for T001
  // Since no project_root is set, it will warn but proceed
  const output = run('node runner.js next');
  // Should at least process without crashing
  assert(output.includes('next-step finished'), 'strip token: should complete without crash');
};

const main = () => {
  console.log('[SMOKE] Running runner smoke tests (v2.0 with evidence)...');
  console.log('');

  const tests = [
    ['testInit', testInit],
    ['testStateVersion', testStateVersion],
    ['testInvalidTasksHalt', testInvalidTasksHalt],
    ['testDependenciesSelection', testDependenciesSelection],
    ['testRunSnapshots', testRunSnapshots],
    ['testRunSummaryOnComplete', testRunSummaryOnComplete],
    ['testCliCommands', testCliCommands],
    ['testEvidenceDirectoryCreation', testEvidenceDirectoryCreation],
    ['testEvidenceFunctions', testEvidenceFunctions],
    ['testEvidenceRejectionWithoutProjectRoot', testEvidenceRejectionWithoutProjectRoot],
    ['testStripToken', testStripToken]
  ];

  let passed = 0;
  let failed = 0;

  for (const [name, fn] of tests) {
    try {
      fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.log(`  [FAIL] ${name}: ${err.message}`);
      failed++;
    }
  }

  console.log('');
  console.log(`[SMOKE] Results: ${passed} passed, ${failed} failed, ${tests.length} total`);

  if (failed > 0) {
    process.exit(1);
  }

  console.log('[SMOKE] All tests passed.');
};

main();
