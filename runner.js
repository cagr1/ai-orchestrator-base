#!/usr/bin/env node

/**
 * Agent System Runner v3.0 - Deterministic Parallel Orchestrator
 *
 * Phase 1: Simplified state.json with Run Lock + TTL
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const ROOT_DIR = __dirname;
const SYSTEM_DIR = path.join(ROOT_DIR, 'system');
const GOAL_FILE = path.join(SYSTEM_DIR, 'goal.md');
const PLAN_FILE = path.join(SYSTEM_DIR, 'plan.md');
const TASKS_FILE = path.join(SYSTEM_DIR, 'tasks.yaml');
const MEMORY_FILE = path.join(SYSTEM_DIR, 'memory.md');
const STATE_FILE = path.join(SYSTEM_DIR, 'state.json');
const CONFIG_FILE = path.join(SYSTEM_DIR, 'config.json');

// ============================================================
// FILE OPERATIONS
// ============================================================

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

const readYAML = (filepath) => {
  const content = readFile(filepath);
  if (!content) return null;
  return yaml.load(content);
};

const writeYAML = (filepath, data) => {
  writeFile(filepath, yaml.dump(data, { indent: 2 }));
};

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// ============================================================
// PHASE 1: STATE MANAGEMENT - SIMPLIFIED SCHEMA
// ============================================================

const generateRunId = (goal) => {
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const goalSlug = goal.slice(0, 20).toLowerCase().replace(/[^a-z0-9]/g, '-');
  return `${goalSlug}-${timestamp}`;
};

const initializeState = (goal, config) => {
  const runId = generateRunId(goal);
  
  const state = {
    version: "3.0",
    run_id: runId,
    phase: "planning",
    iteration: 0,
    max_iterations: config?.max_iterations || 50,
    status: "running",
    
    execution_control: {
      tasks_completed: 0,
      max_tasks_per_run: 5,
      last_checkpoint: 0,
      checkpoint_interval: 5,
      cooldown_trigger: false,
      consecutive_failures: 0
    },
    
    parallel_batch: {
      max_batch_size: 3
    },
    
    lock: {
      active: false,
      locked_at: null,
      locked_by: null,
      ttl_seconds: 1800
    },
    
    last_updated: new Date().toISOString(),
    halt_reason: null
  };
  
  writeJSON(STATE_FILE, state);
  return state;
};

const loadState = () => {
  return readJSON(STATE_FILE);
};

const saveState = (state) => {
  state.last_updated = new Date().toISOString();
  writeJSON(STATE_FILE, state);
};

// ============================================================
// PHASE 1: RUN LOCK WITH TTL
// ============================================================

const validateLock = (state) => {
  if (!state.lock.active) return;
  
  const now = Date.now();
  const lockedAt = new Date(state.lock.locked_at).getTime();
  const ttl = state.lock.ttl_seconds * 1000;
  
  if (now - lockedAt > ttl) {
    console.log("[WARN] STALE LOCK DETECTED - clearing");
    state.lock.active = false;
    state.lock.locked_at = null;
    state.lock.locked_by = null;
  }
};

const acquireLock = (state) => {
  if (state.lock.active) {
    throw new Error(
      `RUN LOCKED since ${state.lock.locked_at} by ${state.lock.locked_by}`
    );
  }
  
  state.lock.active = true;
  state.lock.locked_at = new Date().toISOString();
  state.lock.locked_by = process.pid;
};

const releaseLock = (state) => {
  state.lock.active = false;
  state.lock.locked_at = null;
  state.lock.locked_by = null;
};

// ============================================================
// PHASE 2: TASKS.YAML MANAGEMENT
// ============================================================

const loadTasks = () => {
  return readYAML(TASKS_FILE);
};

const saveTasks = (tasks) => {
  writeYAML(TASKS_FILE, tasks);
};

const initializeTasks = (runId) => {
  const tasks = {
    version: "3.0",
    generated_at: new Date().toISOString(),
    run_id: runId,
    tasks: [],
    metadata: {
      total_tasks: 0,
      completed: 0,
      pending: 0,
      failed: 0,
      blocked: 0
    }
  };
  saveTasks(tasks);
  return tasks;
};

const updateTaskMetadata = (tasks) => {
  const taskList = tasks.tasks || [];
  tasks.metadata = {
    total_tasks: taskList.length,
    completed: taskList.filter(t => t.estado === "done").length,
    pending: taskList.filter(t => t.estado === "pending").length,
    failed: taskList.filter(t => t.estado === "failed").length,
    blocked: taskList.filter(t => t.estado === "blocked").length
  };
};

const getTaskById = (tasks, taskId) => {
  return tasks.tasks.find(t => t.id === taskId);
};

const updateTask = (tasks, taskId, updates) => {
  const task = getTaskById(tasks, taskId);
  if (!task) return null;
  
  Object.assign(task, updates);
  task.updated_at = new Date().toISOString();
  updateTaskMetadata(tasks);
  return task;
};

// ============================================================
// PHASE 3: EXECUTION LIMITS
// ============================================================

const resetExecutionCounters = (state) => {
  state.execution_control.tasks_completed = 0;
  state.execution_control.consecutive_failures = 0;
  state.status = "running";
};

const canExecuteMoreTasks = (state) => {
  const completed = state.execution_control.tasks_completed;
  const max = state.execution_control.max_tasks_per_run;
  
  if (completed >= max) {
    state.phase = "paused";
    state.status = "paused";
    state.halt_reason = "max_tasks_per_run_reached";
    return false;
  }
  return true;
};

const checkIterationLimit = (state) => {
  if (state.iteration >= state.max_iterations) {
    state.phase = "needs_review";
    state.status = "needs_review";
    state.halt_reason = "max_iterations_reached";
    return false;
  }
  return true;
};

// ============================================================
// PHASE 4: PARALLEL BATCH SELECTION (Declarative)
// ============================================================

const getExecutableTasks = (tasks) => {
  const completedIds = new Set(
    tasks.filter(t => t.estado === "done").map(t => t.id)
  );
  
  return tasks.filter(t => {
    if (t.estado !== "pending") return false;
    return t.depends_on.every(depId => completedIds.has(depId));
  });
};

const selectBatchForExecution = (tasks, maxBatchSize) => {
  const executable = getExecutableTasks(tasks);
  
  // Deterministic ordering: priority first, then id
  const sorted = executable.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return a.id.localeCompare(b.id);
  });
  
  return sorted.slice(0, maxBatchSize);
};

// ============================================================
// PHASE 5: CHECKPOINT SYSTEM
// ============================================================

const shouldCreateCheckpoint = (state) => {
  const completed = state.execution_control.tasks_completed;
  const lastCheckpoint = state.execution_control.last_checkpoint;
  const interval = state.execution_control.checkpoint_interval;
  return (completed - lastCheckpoint) >= interval;
};

const createCheckpoint = (state, tasks) => {
  // Update memory.md with summary
  const summary = generateMemorySummary(tasks);
  appendToMemory(summary);
  
  // Update checkpoint tracking
  state.execution_control.last_checkpoint = state.execution_control.tasks_completed;
  
  console.log(`[CHECKPOINT] Created at ${state.execution_control.tasks_completed} tasks`);
};

const generateMemorySummary = (tasks) => {
  const completed = tasks.filter(t => t.estado === "done");
  return `## Checkpoint (${new Date().toISOString()})\n- Tasks completed: ${completed.length}\n- Total tasks: ${tasks.length}\n`;
};

const appendToMemory = (content) => {
  const existing = readFile(MEMORY_FILE) || "# Memory Log\n\n";
  writeFile(MEMORY_FILE, existing + content + "\n");
};

// ============================================================
// PHASE 6: COOLDOWN (LLM Fatigue Protection)
// ============================================================

const checkCooldownTrigger = (state) => {
  const consecutive = state.execution_control.consecutive_failures;
  const threshold = 3; // config.limits.cooldown_threshold
  
  if (consecutive >= threshold) {
    state.execution_control.cooldown_trigger = true;
    state.phase = "needs_review";
    state.status = "needs_review";
    state.halt_reason = "cooldown_triggered_due_to_consecutive_failures";
    return true;
  }
  return false;
};

const onTaskSuccess = (state) => {
  state.execution_control.consecutive_failures = 0;
};

const onTaskFailure = (state) => {
  state.execution_control.consecutive_failures++;
};

// ============================================================
// PHASE 7: EVIDENCE FORMAT (Simplified)
// ============================================================

const EVIDENCE_DIR = path.join(SYSTEM_DIR, 'evidence');

const saveEvidence = (taskId, evidence) => {
  ensureDir(EVIDENCE_DIR);
  const evidenceFile = path.join(EVIDENCE_DIR, `${taskId}.json`);
  const data = {
    task_id: taskId,
    executed_at: new Date().toISOString(),
    files_changed: evidence.files_changed || [],
    summary: evidence.summary || ''
  };
  writeJSON(evidenceFile, data);
};

const loadEvidence = (taskId) => {
  const evidenceFile = path.join(EVIDENCE_DIR, `${taskId}.json`);
  return readJSON(evidenceFile);
};

// ============================================================
// PHASE 11: R9 TASK SIZE VALIDATION
// ============================================================

const validateTaskSize = (task) => {
  const errors = [];
  
  // Validate output files count
  const outputFiles = task.output?.length ?? 0;
  if (outputFiles > 10) {
    errors.push(`output files (${outputFiles}) > 10`);
  }
  
  // Validate input files count
  const inputFiles = task.input?.length ?? 0;
  if (inputFiles > 10) {
    errors.push(`input files (${inputFiles}) > 10`);
  }
  
  // Validate description length (proxy for complexity)
  const descLength = task.description?.length ?? 0;
  if (descLength > 500) {
    errors.push(`description too long (${descLength} chars)`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

const validateAllTasks = (tasks) => {
  const violations = [];
  
  tasks.forEach(task => {
    const validation = validateTaskSize(task);
    if (!validation.valid) {
      violations.push({
        task_id: task.id,
        errors: validation.errors
      });
    }
  });
  
  if (violations.length > 0) {
    console.error("[ERROR] R9 Task Size violations detected:");
    violations.forEach(v => {
      console.error(`  Task ${v.task_id}: ${v.errors.join(", ")}`);
    });
    console.error("[ERROR] Planner must split these tasks before proceeding.");
    throw new Error("R9_VALIDATION_FAILED");
  }
};

// ============================================================
// PHASE 12: COMPLETION DETECTION
// ============================================================

const checkProjectCompletion = (tasks, state) => {
  const remaining = tasks.filter(t => t.estado !== "done");
  
  if (remaining.length === 0) {
    state.phase = "completed";
    state.status = "completed";
    state.halt_reason = "all_tasks_completed";
    return true;
  }
  
  return false;
};

// ============================================================
// PHASE 13: DEPENDENCY VALIDATION
// ============================================================

const validateDependencies = (tasks) => {
  const ids = new Set(tasks.map(t => t.id));
  
  tasks.forEach(task => {
    task.depends_on.forEach(dep => {
      if (!ids.has(dep)) {
        throw new Error(
          `Invalid dependency ${dep} in task ${task.id}`
        );
      }
    });
  });
};

const detectCycles = (tasks) => {
  const graph = {};
  tasks.forEach(t => {
    graph[t.id] = t.depends_on;
  });
  
  const visited = new Set();
  const stack = new Set();
  
  const visit = (node) => {
    if (stack.has(node)) {
      throw new Error(`Dependency cycle detected at ${node}`);
    }
    if (visited.has(node)) return;
    
    stack.add(node);
    graph[node].forEach(visit);
    stack.delete(node);
    visited.add(node);
  };
  
  Object.keys(graph).forEach(visit);
};

// ============================================================
// PHASE 14: R10 NO IMPLICIT TASKS (Anti-Hallucination)
// ============================================================

const validateEvidenceAgainstTask = (task, evidence) => {
  const allowed = new Set(task.output);
  
  evidence.files_changed.forEach(file => {
    let allowedMatch = false;
    
    allowed.forEach(path => {
      if (file.startsWith(path)) {
        allowedMatch = true;
      }
    });
    
    if (!allowedMatch) {
      throw new Error(
        `Unauthorized file change: ${file}. ` +
        `Only allowed: ${Array.from(allowed).join(", ")}`
      );
    }
  });
};

// ============================================================
// PHASE 17: R11 PLANNER GUARDRAIL (Anti-Destruction)
// ============================================================

const validatePlannerAllowed = (state, tasksExists) => {
  if (tasksExists && state.phase !== "planning") {
    throw new Error(
      "Planner not allowed after planning phase. " +
      "Manual reset required to regenerate tasks."
    );
  }
};

// ============================================================
// PHASE 10: RECALCULATION RULE
// ============================================================

const recalculateTaskStates = (tasks) => {
  const completedIds = new Set(
    tasks.filter(t => t.estado === "done").map(t => t.id)
  );
  
  tasks.forEach(task => {
    // Never change done or failed
    if (task.estado === "done" || task.estado === "failed") {
      return;
    }
    
    // Check dependencies
    const depsDone = task.depends_on.every(depId => completedIds.has(depId));
    
    if (!depsDone) {
      task.estado = "blocked";
    } else if (task.estado === "blocked") {
      task.estado = "pending";
    }
  });
  
  return tasks;
};

// ============================================================
// CLI COMMANDS
// ============================================================

const printStatus = () => {
  const state = loadState();
  if (!state) {
    console.log('[ERROR] No state found. Run: node runner.js init "Your goal"');
    return;
  }
  
  console.log('[STATUS] Current run state');
  console.log(`- run_id: ${state.run_id || '-'}`);
  console.log(`- version: ${state.version}`);
  console.log(`- phase: ${state.phase}`);
  console.log(`- iteration: ${state.iteration}/${state.max_iterations}`);
  console.log(`- status: ${state.status}`);
  console.log(`- halt_reason: ${state.halt_reason || '-'}`);
  console.log(`- lock: ${state.lock.active ? 'ACTIVE' : 'inactive'}`);
  console.log(`- tasks_completed: ${state.execution_control.tasks_completed}/${state.execution_control.max_tasks_per_run}`);
  console.log(`- consecutive_failures: ${state.execution_control.consecutive_failures}`);
};

const main = async () => {
  const args = process.argv.slice(2);
  const command = (args[0] || '').toLowerCase();
  
  console.log('\n[RUNNER] Agent System Runner v3.0');
  console.log('====================================\n');
  
  if (command === 'init') {
    const goal = args.slice(1).join(' ').trim() || 'Define project goal here';
    const config = readJSON(CONFIG_FILE) || {};
    
    ensureDir(SYSTEM_DIR);
    writeFile(GOAL_FILE, `# Goal\n\n${goal}\n`);
    
    const state = initializeState(goal, config);
    initializeTasks(state.run_id);
    
    console.log(`[INIT] New run initialized: ${state.run_id}`);
    console.log('[INIT] Phase: planning');
    console.log('[INIT] Tasks template created');
    console.log('\n[END] Run: node runner.js run\n');
    return;
  }
  
  if (command === 'status') {
    printStatus();
    console.log('\n[END] Runner finished\n');
    return;
  }
  
  if (command === 'run' || command === 'resume') {
    const state = loadState();
    if (!state) {
      console.error('[ERROR] No state found. Run: node runner.js init "Your goal"');
      process.exit(1);
    }
    
    // Phase 1: Validate and acquire lock
    validateLock(state);
    acquireLock(state);
    
    try {
      console.log(`[${command.toUpperCase()}] Starting execution...`);
      console.log(`[STATE] Phase: ${state.phase}`);
      console.log(`[STATE] Iteration: ${state.iteration}/${state.max_iterations}`);
      
      // TODO: Implement execution logic in future phases
      
      console.log('[INFO] Execution logic to be implemented in Phase 2+');
      console.log('[INFO] Current implementation: Phase 1 (State + Lock) complete');
      
    } finally {
      // Always release lock
      releaseLock(state);
      saveState(state);
    }
    
    console.log('\n[END] Runner finished\n');
    return;
  }
  
  if (command === 'review') {
    console.log('[REVIEW] Manual review mode');
    console.log('[REVIEW] Use this when status = needs_review');
    console.log('[INFO] Implementation pending');
    return;
  }
  
  // Default: show help
  console.log('Usage: node runner.js [command]');
  console.log('');
  console.log('Commands:');
  console.log('  init "goal"    Initialize new run');
  console.log('  run            Execute one round (up to 5 tasks)');
  console.log('  resume         Resume from paused state');
  console.log('  status         Show current state');
  console.log('  review         Manual review mode');
  console.log('');
};

if (require.main === module) {
  main().catch((err) => {
    console.error('[ERROR]', err.message);
    process.exit(1);
  });
}

// Export for tests
module.exports = {
  initializeState,
  loadState,
  saveState,
  acquireLock,
  releaseLock,
  validateLock,
  generateRunId,
  loadTasks,
  saveTasks,
  initializeTasks,
  getTaskById,
  updateTask,
  updateTaskMetadata,
  // Phase 3
  resetExecutionCounters,
  canExecuteMoreTasks,
  checkIterationLimit,
  // Phase 4
  getExecutableTasks,
  selectBatchForExecution,
  // Phase 5
  shouldCreateCheckpoint,
  createCheckpoint,
  // Phase 6
  checkCooldownTrigger,
  onTaskSuccess,
  onTaskFailure,
  // Phase 7
  saveEvidence,
  loadEvidence,
  // Phase 10
  recalculateTaskStates,
  // Phase 11
  validateTaskSize,
  validateAllTasks,
  // Phase 12
  checkProjectCompletion,
  // Phase 13
  validateDependencies,
  detectCycles,
  // Phase 14
  validateEvidenceAgainstTask,
  // Phase 17
  validatePlannerAllowed
};
