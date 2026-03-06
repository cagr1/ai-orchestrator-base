const assert = require('assert');
const path = require('path');

// Import functions from runner
const runnerPath = path.join(__dirname, '..', 'runner.js');
const {
  initializeTasks,
  getTaskById,
  generateCorrectiveTaskId,
  isCorrectiveTask,
  getOriginalTaskId,
  createCorrectiveTask,
  linkDependentToCorrective,
  createAndLinkCorrectiveTask
} = require(runnerPath);

console.log("Testing Phase 19: Corrective Tasks (Mejora 1)...");

// Helper to create a tasks object with test tasks
const createTestTasks = () => {
  const runId = "test-run-" + Date.now();
  const tasks = initializeTasks(runId);
  
  // Add test tasks
  tasks.tasks = [
    {
      id: "T1",
      description: "Task 1 - will fail",
      estado: "failed_permanent",
      priority: 1,
      depends_on: [],
      attempts: 3,
      max_attempts: 3,
      input: ["input1.txt"],
      output: ["output1.txt"],
      skill: "test-skill"
    },
    {
      id: "T2",
      description: "Task 2 - depends on T1",
      estado: "blocked",
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
      description: "Task 4 - independent",
      estado: "pending",
      priority: 4,
      depends_on: [],
      attempts: 0,
      max_attempts: 3,
      input: [],
      output: [],
      skill: "test-skill"
    }
  ];
  
  return tasks;
};

// Test 1: generateCorrectiveTaskId
console.log("\n--- Test 1: generateCorrectiveTaskId ---");
const id1 = generateCorrectiveTaskId("T5");
assert(id1 === "T5_fix", "Should generate T5_fix from T5");
console.log("✓ generateCorrectiveTaskId works");

const id2 = generateCorrectiveTaskId("T10");
assert(id2 === "T10_fix", "Should generate T10_fix from T10");
console.log("✓ generateCorrectiveTaskId works with multi-digit");

// Test 2: isCorrectiveTask
console.log("\n--- Test 2: isCorrectiveTask ---");
assert(isCorrectiveTask("T5_fix") === true, "T5_fix should be identified as corrective");
assert(isCorrectiveTask("T1") === false, "T1 should not be identified as corrective");
assert(isCorrectiveTask("fix_task") === false, "Non-standard format should not be identified");
console.log("✓ isCorrectiveTask works");

// Test 3: getOriginalTaskId
console.log("\n--- Test 3: getOriginalTaskId ---");
const orig1 = getOriginalTaskId("T5_fix");
assert(orig1 === "T5", "Should return T5 from T5_fix");
console.log("✓ getOriginalTaskId works");

const orig2 = getOriginalTaskId("T1");
assert(orig2 === null, "Should return null for non-corrective task");
console.log("✓ getOriginalTaskId handles non-corrective task");

// Test 4: createCorrectiveTask
console.log("\n--- Test 4: createCorrectiveTask ---");
const tasks1 = createTestTasks();

const corrective = createCorrectiveTask(tasks1, "T1", "Fix the broken implementation");
assert(corrective !== null, "Should create corrective task");
assert(corrective.id === "T1_fix", "Corrective task ID should be T1_fix");
assert(corrective.original_task === "T1", "Should reference original task");
assert(corrective.estado === "pending", "Should be pending");
assert(corrective.priority === 1, "Should inherit priority from original");
assert(corrective.attempts === 0, "Should start with 0 attempts");
assert(corrective.max_attempts === 1, "Should default to 1 attempt for corrective");
console.log("✓ createCorrectiveTask creates task correctly");

// Test 5: Original task remains unchanged (immutability)
console.log("\n--- Test 5: Original task immutability ---");
const original = getTaskById(tasks1, "T1");
assert(original.estado === "failed_permanent", "Original task should remain failed_permanent");
assert(original.id === "T1", "Original task ID should not change");
console.log("✓ Original task remains unchanged");

// Test 6: createCorrectiveTask - non-existent task
console.log("\n--- Test 6: createCorrectiveTask - non-existent task ---");
const tasks2 = createTestTasks();
const result = createCorrectiveTask(tasks2, "NONEXISTENT", "Fix");
assert(result === null, "Should return null for non-existent task");
console.log("✓ createCorrectiveTask handles non-existent task");

// Test 7: createCorrectiveTask - idempotent (doesn't create duplicate)
console.log("\n--- Test 7: createCorrectiveTask - idempotent ---");
const tasks3 = createTestTasks();
const first = createCorrectiveTask(tasks3, "T1", "First fix");
const second = createCorrectiveTask(tasks3, "T1", "Second fix");
assert(first.id === second.id, "Should return same corrective task");
assert(tasks3.tasks.filter(t => t.id === "T1_fix").length === 1, "Should only have one corrective task");
console.log("✓ createCorrectiveTask is idempotent");

// Test 8: linkDependentToCorrective
console.log("\n--- Test 8: linkDependentToCorrective ---");
const tasks4 = createTestTasks();
createCorrectiveTask(tasks4, "T1", "Fix T1");

const t2Before = getTaskById(tasks4, "T2");
assert(t2Before.depends_on.includes("T1"), "T2 should depend on T1");

const linked = linkDependentToCorrective(tasks4, "T1", "T1_fix");
assert(linked.includes("T2"), "T2 should be in linked list");
console.log("✓ linkDependentToCorrective links dependent tasks");

const t2After = getTaskById(tasks4, "T2");
assert(t2After.depends_on.includes("T1_fix"), "T2 should now depend on T1_fix");
assert(t2After.corrective_link === "T1", "Should track original dependency");
console.log("✓ Dependent now depends on corrective task");

// Test 9: createAndLinkCorrectiveTask - full flow
console.log("\n--- Test 9: createAndLinkCorrectiveTask - full flow ---");
const tasks5 = createTestTasks();
const result9 = createAndLinkCorrectiveTask(tasks5, "T1", {
  fixDescription: "Fix the issues",
  linkDependents: true
});

assert(result9.action === "corrective_created", "Should return corrective_created action");
assert(result9.corrective_task.id === "T1_fix", "Should create correct task");
assert(result9.linked_dependents.includes("T2"), "Should link T2");
console.log("✓ createAndLinkCorrectiveTask works");

// Test 10: createAndLinkCorrectiveTask - without linking dependents
console.log("\n--- Test 10: createAndLinkCorrectiveTask - without linking ---");
const tasks6 = createTestTasks();
const result10 = createAndLinkCorrectiveTask(tasks6, "T1", {
  fixDescription: "Fix without linking",
  linkDependents: false
});

assert(result10.action === "corrective_created", "Should create corrective task");
assert(result10.linked_dependents.length === 0, "Should not link any dependents");
console.log("✓ createAndLinkCorrectiveTask works without linking");

// Test 11: Corrective task inherits dependencies
console.log("\n--- Test 11: Corrective task inherits dependencies ---");
const tasks7 = createTestTasks();

// Add a task that T1 depends on
tasks7.tasks.push({
  id: "T0",
  description: "Predecessor",
  estado: "done",
  priority: 0,
  depends_on: [],
  attempts: 1,
  max_attempts: 3,
  input: [],
  output: [],
  skill: "test-skill"
});

// Update T1 to depend on T0
const t1 = getTaskById(tasks7, "T1");
t1.depends_on = ["T0"];

const corrective7 = createCorrectiveTask(tasks7, "T1", "Fix T1");
assert(corrective7.depends_on.includes("T0"), "Corrective task should inherit dependency on T0");
console.log("✓ Corrective task inherits dependencies");

// Test 12: Does not modify done tasks
console.log("\n--- Test 12: Does not modify done tasks ---");
const tasks8 = createTestTasks();
const t4Before = getTaskById(tasks8, "T4");
assert(t4Before.estado === "pending", "T4 should be pending");

linkDependentToCorrective(tasks8, "T1", "T1_fix");
const t4After = getTaskById(tasks8, "T4");
assert(t4After.estado === "pending", "T4 should remain pending (not done)");
console.log("✓ Independent tasks remain unchanged");

console.log("\n✅ Phase 19 (Corrective Tasks) tests passed");
