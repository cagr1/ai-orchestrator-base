const assert = require('assert');
const path = require('path');

// Import functions from runner
const runnerPath = path.join(__dirname, '..', 'runner.js');
const {
  initializeTasks,
  getTaskById,
  updateTask,
  incrementTaskAttempts,
  isTaskExhausted,
  markTaskFailedPermanent,
  handleDependentTasksOnFailure,
  processTaskFailure
} = require(runnerPath);

console.log("Testing Phase 18: Attempts/Max Attempts (Mejora 2)...");

// Helper to create a tasks object with test tasks
const createTestTasks = () => {
  const runId = "test-run-" + Date.now();
  const tasks = initializeTasks(runId);
  
  // Add test tasks
  tasks.tasks = [
    {
      id: "T1",
      description: "Task 1 - will fail permanently",
      estado: "pending",
      priority: 1,
      depends_on: [],
      attempts: 0,
      max_attempts: 3,
      input: [],
      output: [],
      skill: "test-skill"
    },
    {
      id: "T2",
      description: "Task 2 - depends on T1",
      estado: "pending",
      priority: 2,
      depends_on: ["T1"],
      attempts: 0,
      max_attempts: 3,
      input: [],
      output: [],
      skill: "test-skill"
    },
    {
      id: "T3",
      description: "Task 3 - depends on T1 and T2",
      estado: "pending",
      priority: 3,
      depends_on: ["T1", "T2"],
      attempts: 0,
      max_attempts: 3,
      input: [],
      output: [],
      skill: "test-skill"
    },
    {
      id: "T4",
      description: "Task 4 - no attempts field (should default)",
      estado: "pending",
      priority: 4,
      depends_on: [],
      input: [],
      output: [],
      skill: "test-skill"
    },
    {
      id: "T5",
      description: "Task 5 - already done",
      estado: "done",
      priority: 5,
      depends_on: [],
      attempts: 1,
      max_attempts: 3,
      input: [],
      output: [],
      skill: "test-skill"
    }
  ];
  
  return tasks;
};

// Test 1: incrementTaskAttempts
console.log("\n--- Test 1: incrementTaskAttempts ---");
const tasks1 = createTestTasks();
const task1 = getTaskById(tasks1, "T1");
assert(task1.attempts === 0, "Initial attempts should be 0");

const updated = incrementTaskAttempts(tasks1, "T1");
assert(updated.attempts === 1, "After increment, attempts should be 1");
console.log("✓ incrementTaskAttempts works");

// Test 2: Default max_attempts when not specified
console.log("\n--- Test 2: Default max_attempts ---");
const tasks2 = createTestTasks();
const task4 = getTaskById(tasks2, "T4");
assert(task4.max_attempts === undefined, "max_attempts should be undefined initially");

const task4Updated = incrementTaskAttempts(tasks2, "T4");
assert(task4Updated.max_attempts === 3, "max_attempts should default to 3");
assert(task4Updated.attempts === 1, "attempts should be 1 after first increment");
console.log("✓ Default max_attempts (3) works");

// Test 3: isTaskExhausted
console.log("\n--- Test 3: isTaskExhausted ---");
const tasks3 = createTestTasks();

// Not exhausted - attempts < max_attempts
const t3 = getTaskById(tasks3, "T1");
t3.attempts = 2;
t3.max_attempts = 3;
assert(isTaskExhausted(t3) === false, "Should not be exhausted when attempts < max_attempts");
console.log("✓ isTaskExhausted returns false when attempts < max_attempts");

// Exhausted - attempts >= max_attempts
t3.attempts = 3;
assert(isTaskExhausted(t3) === true, "Should be exhausted when attempts >= max_attempts");
console.log("✓ isTaskExhausted returns true when attempts >= max_attempts");

// Exhausted - attempts > max_attempts
t3.attempts = 5;
assert(isTaskExhausted(t3) === true, "Should be exhausted when attempts > max_attempts");
console.log("✓ isTaskExhausted returns true when attempts > max_attempts");

// Null/undefined task
assert(isTaskExhausted(null) === false, "Should return false for null task");
assert(isTaskExhausted(undefined) === false, "Should return false for undefined task");
console.log("✓ isTaskExhausted handles null/undefined");

// Test 4: markTaskFailedPermanent
console.log("\n--- Test 4: markTaskFailedPermanent ---");
const tasks4 = createTestTasks();
const t4 = getTaskById(tasks4, "T1");
assert(t4.estado === "pending", "Initial estado should be pending");

markTaskFailedPermanent(tasks4, "T1");
const t4After = getTaskById(tasks4, "T1");
assert(t4After.estado === "failed_permanent", "estado should be failed_permanent");
console.log("✓ markTaskFailedPermanent changes estado to failed_permanent");

// Test 5: handleDependentTasksOnFailure
console.log("\n--- Test 5: handleDependentTasksOnFailure ---");
const tasks5 = createTestTasks();

// T1 fails permanently
markTaskFailedPermanent(tasks5, "T1");

// T2 depends on T1 - should be blocked
const t2Before = getTaskById(tasks5, "T2");
assert(t2Before.estado === "pending", "T2 should be pending before handling dependents");

const blocked = handleDependentTasksOnFailure(tasks5, "T1");

const t2After = getTaskById(tasks5, "T2");
assert(t2After.estado === "blocked", "T2 should be blocked after T1 failed");
assert(blocked.includes("T2"), "blocked list should include T2");
console.log("✓ handleDependentTasksOnFailure blocks dependent tasks");

// Test 6: T3 should also be blocked (depends on T1 and T2, T2 is now blocked)
const t3After = getTaskById(tasks5, "T3");
assert(t3After.estado === "blocked", "T3 should also be blocked (depends on blocked T2)");
console.log("✓ Dependent of dependent is also blocked");

// Test 7: processTaskFailure - retry allowed
console.log("\n--- Test 6: processTaskFailure - retry allowed ---");
const tasks6 = createTestTasks();
const mockState = {
  execution_control: {
    consecutive_failures: 0
  }
};

const result1 = processTaskFailure(tasks6, "T1", mockState);
assert(result1.action === "retry_allowed", "Should allow retry");
assert(result1.attempts === 1, "Should have 1 attempt");
assert(result1.max_attempts === 3, "Should have max 3 attempts");
assert(mockState.execution_control.consecutive_failures === 1, "consecutive_failures should increment");
console.log("✓ processTaskFailure allows retry when attempts < max_attempts");

// Test 8: processTaskFailure - permanent failure
console.log("\n--- Test 7: processTaskFailure - permanent failure ---");
const tasks7 = createTestTasks();

// Set attempts to 2 (one more failure will exhaust)
const t7 = getTaskById(tasks7, "T1");
t7.attempts = 2;
t7.max_attempts = 3;

const mockState2 = {
  execution_control: {
    consecutive_failures: 0
  }
};

const result2 = processTaskFailure(tasks7, "T1", mockState2);
assert(result2.action === "failed_permanent", "Should mark as failed_permanent");
assert(result2.blocked_dependents.includes("T2"), "T2 should be in blocked list");

const t7After = getTaskById(tasks7, "T1");
assert(t7After.estado === "failed_permanent", "T1 should be failed_permanent");
console.log("✓ processTaskFailure marks as failed_permanent when exhausted");

// Test 9: processTaskFailure - task not found
console.log("\n--- Test 8: processTaskFailure - task not found ---");
const tasks8 = createTestTasks();
const mockState3 = {
  execution_control: {
    consecutive_failures: 0
  }
};

const result3 = processTaskFailure(tasks8, "NONEXISTENT", mockState3);
assert(result3.action === "error", "Should return error action");
console.log("✓ processTaskFailure handles non-existent task");

// Test 10: Already done tasks should not be affected by dependent handling
console.log("\n--- Test 9: Done tasks not affected by dependent handling ---");
const tasks9 = createTestTasks();
markTaskFailedPermanent(tasks9, "T1");

const t5After = getTaskById(tasks9, "T5");
assert(t5After.estado === "done", "T5 should remain done");
console.log("✓ Done tasks remain done when dependent fails");

// Test 10: max_attempts can be customized
console.log("\n--- Test 10: Custom max_attempts ---");
const tasks10 = createTestTasks();
const t10 = getTaskById(tasks10, "T1");
t10.max_attempts = 1; // Only 1 attempt allowed

const result10 = processTaskFailure(tasks10, "T1", mockState3);
assert(result10.action === "failed_permanent", "Should fail permanent with custom max_attempts");
console.log("✓ Custom max_attempts works");

console.log("\n✅ Phase 18 (Attempts/Max Attempts) tests passed");
