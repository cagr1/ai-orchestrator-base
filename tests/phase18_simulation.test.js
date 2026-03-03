/**
 * Phase 18: Full Workflow Simulation Test
 * Tests the complete orchestrator flow from start to finish
 */

const assert = require('assert');
const {
  selectBatchForExecution,
  recalculateTaskStates,
  checkProjectCompletion,
  canExecuteMoreTasks,
  checkIterationLimit,
  validateDependencies,
  detectCycles,
  validateAllTasks,
  validateEvidenceAgainstTask,
  onTaskSuccess,
  onTaskFailure,
  checkCooldownTrigger
} = require('../runner');

console.log('\n========================================');
console.log('Phase 18: Full Workflow Simulation');
console.log('========================================\n');

// ============================================================
// SIMULATION 1: Simple Linear Workflow
// ============================================================
(function testLinearWorkflow() {
  console.log('Simulation 1: Linear Workflow (T1 → T2 → T3)...');
  
  const state = {
    iteration: 0,
    max_iterations: 50,
    execution_control: {
      tasks_completed: 0,
      max_tasks_per_run: 5,
      consecutive_failures: 0
    }
  };
  
  const tasks = [
    { id: "T1", estado: "pending", depends_on: [], priority: 1, input: [], output: ["file1.txt"] },
    { id: "T2", estado: "pending", depends_on: ["T1"], priority: 2, input: ["file1.txt"], output: ["file2.txt"] },
    { id: "T3", estado: "pending", depends_on: ["T2"], priority: 3, input: ["file2.txt"], output: ["file3.txt"] }
  ];
  
  // Validate dependencies and cycles
  validateDependencies(tasks);
  detectCycles(tasks);
  validateAllTasks(tasks);
  
  // Run 1: Only T1 executable
  recalculateTaskStates(tasks);
  let batch = selectBatchForExecution(tasks, 3);
  assert(batch.length === 1 && batch[0].id === "T1", 'Run 1: T1 should be executable');
  
  // Complete T1
  tasks[0].estado = "done";
  onTaskSuccess(state);
  state.execution_control.tasks_completed++;
  
  // Run 2: Only T2 executable
  recalculateTaskStates(tasks);
  batch = selectBatchForExecution(tasks, 3);
  assert(batch.length === 1 && batch[0].id === "T2", 'Run 2: T2 should be executable');
  
  // Complete T2
  tasks[1].estado = "done";
  onTaskSuccess(state);
  state.execution_control.tasks_completed++;
  
  // Run 3: Only T3 executable
  recalculateTaskStates(tasks);
  batch = selectBatchForExecution(tasks, 3);
  assert(batch.length === 1 && batch[0].id === "T3", 'Run 3: T3 should be executable');
  
  // Complete T3
  tasks[2].estado = "done";
  onTaskSuccess(state);
  state.execution_control.tasks_completed++;
  
  // Check completion
  assert(checkProjectCompletion(tasks, state) === true, 'Project should be complete');
  assert(state.halt_reason === "all_tasks_completed", 'Halt reason should be completion');
  
  console.log('  ✓ Linear workflow completed successfully');
})();

// ============================================================
// SIMULATION 2: Parallel Branch Workflow
// ============================================================
(function testParallelBranchWorkflow() {
  console.log('Simulation 2: Parallel Branch Workflow...');
  
  const tasks = [
    { id: "T1", estado: "pending", depends_on: [], priority: 1, input: [], output: ["base/"] },
    { id: "T2", estado: "pending", depends_on: ["T1"], priority: 2, input: ["base/"], output: ["frontend/"] },
    { id: "T3", estado: "pending", depends_on: ["T1"], priority: 2, input: ["base/"], output: ["backend/"] },
    { id: "T4", estado: "pending", depends_on: ["T2", "T3"], priority: 3, input: ["frontend/", "backend/"], output: ["tests/"] }
  ];
  
  // Run 1: T1
  recalculateTaskStates(tasks);
  let batch = selectBatchForExecution(tasks, 3);
  assert(batch.length === 1 && batch[0].id === "T1", 'T1 first');
  tasks[0].estado = "done";
  
  // Run 2: T2 and T3 in parallel
  recalculateTaskStates(tasks);
  batch = selectBatchForExecution(tasks, 3);
  assert(batch.length === 2, 'T2 and T3 parallel');
  assert(batch.some(t => t.id === "T2"), 'T2 in batch');
  assert(batch.some(t => t.id === "T3"), 'T3 in batch');
  tasks[1].estado = "done";
  tasks[2].estado = "done";
  
  // Run 3: T4
  recalculateTaskStates(tasks);
  batch = selectBatchForExecution(tasks, 3);
  assert(batch.length === 1 && batch[0].id === "T4", 'T4 last');
  tasks[3].estado = "done";
  
  assert(tasks.every(t => t.estado === "done"), 'All done');
  console.log('  ✓ Parallel branch workflow completed successfully');
})();

// ============================================================
// SIMULATION 3: Execution Limits
// ============================================================
(function testExecutionLimits() {
  console.log('Simulation 3: Execution Limits (max 5 tasks per run)...');
  
  const state = {
    iteration: 0,
    max_iterations: 50,
    phase: "execution",
    status: "running",
    halt_reason: null,
    execution_control: {
      tasks_completed: 0,
      max_tasks_per_run: 5,
      consecutive_failures: 0
    }
  };
  
  // Simulate completing 5 tasks
  for (let i = 0; i < 5; i++) {
    assert(canExecuteMoreTasks(state) === true, `Should allow task ${i + 1}`);
    state.execution_control.tasks_completed++;
  }
  
  // 6th task should be blocked
  assert(canExecuteMoreTasks(state) === false, 'Should block 6th task');
  assert(state.status === "paused", 'State should be paused');
  assert(state.halt_reason === "max_tasks_per_run_reached", 'Halt reason should be max_tasks');
  
  console.log('  ✓ Execution limits enforced correctly');
})();

// ============================================================
// SIMULATION 4: Iteration Limits
// ============================================================
(function testIterationLimits() {
  console.log('Simulation 4: Iteration Limits (max 50 iterations)...');
  
  const state = {
    iteration: 49,
    max_iterations: 50,
    phase: "execution",
    status: "running",
    halt_reason: null
  };
  
  // 49th iteration should be allowed
  assert(checkIterationLimit(state) === true, 'Iteration 49 should be allowed');
  
  // Increment to 50
  state.iteration = 50;
  assert(checkIterationLimit(state) === false, 'Iteration 50 should be blocked');
  assert(state.status === "needs_review", 'State should be needs_review');
  assert(state.halt_reason === "max_iterations_reached", 'Halt reason should be max_iterations');
  
  console.log('  ✓ Iteration limits enforced correctly');
})();

// ============================================================
// SIMULATION 5: Cooldown Trigger
// ============================================================
(function testCooldownTrigger() {
  console.log('Simulation 5: Cooldown (3 consecutive failures)...');
  
  const state = {
    phase: "execution",
    status: "running",
    halt_reason: null,
    execution_control: {
      consecutive_failures: 0,
      cooldown_trigger: false
    }
  };
  
  // 2 failures - no cooldown
  onTaskFailure(state);
  onTaskFailure(state);
  assert(checkCooldownTrigger(state) === false, '2 failures should not trigger cooldown');
  assert(state.status === "running", 'Status should still be running');
  
  // 3rd failure - cooldown triggered
  onTaskFailure(state);
  assert(checkCooldownTrigger(state) === true, '3 failures should trigger cooldown');
  assert(state.status === "needs_review", 'Status should be needs_review');
  assert(state.halt_reason === "cooldown_triggered_due_to_consecutive_failures", 'Correct halt reason');
  
  // Success resets counter
  onTaskSuccess(state);
  assert(state.execution_control.consecutive_failures === 0, 'Success should reset counter');
  
  console.log('  ✓ Cooldown trigger works correctly');
})();

// ============================================================
// SIMULATION 6: Evidence Validation
// ============================================================
(function testEvidenceValidation() {
  console.log('Simulation 6: Evidence Validation (R10)...');
  
  const task = {
    id: "T1",
    output: ["src/api/", "docs/"]
  };
  
  // Valid evidence
  const validEvidence = {
    files_changed: ["src/api/users.js", "docs/api.md"]
  };
  validateEvidenceAgainstTask(task, validEvidence);
  console.log('  ✓ Valid evidence accepted');
  
  // Invalid evidence
  const invalidEvidence = {
    files_changed: ["src/api/users.js", "random/file.js"]
  };
  try {
    validateEvidenceAgainstTask(task, invalidEvidence);
    assert(false, 'Should throw for unauthorized file');
  } catch (e) {
    assert(e.message.includes("Unauthorized file change"), 'Correct error message');
  }
  console.log('  ✓ Invalid evidence rejected');
})();

// ============================================================
// SIMULATION 7: Complex Dependency Chain
// ============================================================
(function testComplexDependencyChain() {
  console.log('Simulation 7: Complex Dependency Chain...');
  
  const tasks = [
    { id: "A", estado: "pending", depends_on: [], priority: 1 },
    { id: "B", estado: "pending", depends_on: ["A"], priority: 2 },
    { id: "C", estado: "pending", depends_on: ["A"], priority: 2 },
    { id: "D", estado: "pending", depends_on: ["B", "C"], priority: 3 },
    { id: "E", estado: "pending", depends_on: ["D"], priority: 4 },
    { id: "F", estado: "pending", depends_on: ["D"], priority: 4 },
    { id: "G", estado: "pending", depends_on: ["E", "F"], priority: 5 }
  ];
  
  const executionOrder = [];
  
  while (tasks.some(t => t.estado !== "done")) {
    recalculateTaskStates(tasks);
    const batch = selectBatchForExecution(tasks, 5);
    
    if (batch.length === 0) break;
    
    batch.forEach(task => {
      task.estado = "done";
      executionOrder.push(task.id);
    });
  }
  
  // Verify order respects dependencies
  assert(executionOrder.indexOf("A") < executionOrder.indexOf("B"), 'A before B');
  assert(executionOrder.indexOf("A") < executionOrder.indexOf("C"), 'A before C');
  assert(executionOrder.indexOf("B") < executionOrder.indexOf("D"), 'B before D');
  assert(executionOrder.indexOf("C") < executionOrder.indexOf("D"), 'C before D');
  assert(executionOrder.indexOf("D") < executionOrder.indexOf("E"), 'D before E');
  assert(executionOrder.indexOf("D") < executionOrder.indexOf("F"), 'D before F');
  assert(executionOrder.indexOf("E") < executionOrder.indexOf("G"), 'E before G');
  assert(executionOrder.indexOf("F") < executionOrder.indexOf("G"), 'F before G');
  
  console.log(`  ✓ Complex chain executed: ${executionOrder.join(' → ')}`);
})();

console.log('\n========================================');
console.log('All Simulation Tests Passed! ✓');
console.log('========================================\n');
