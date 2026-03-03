const assert = require('assert');

const {
  validateTaskSize,
  validateAllTasks,
  checkProjectCompletion,
  validateDependencies,
  detectCycles,
  validateEvidenceAgainstTask
} = require('../runner.js');

console.log("Testing Phases 11-14: Validations...");

// Phase 11: R9 Task Size Validation
console.log("\nPhase 11: R9 Task Size Validation");

const validTask = {
  id: "T1",
  description: "Short description",
  input: ["file1.md", "file2.md"],
  output: ["src/file1.js", "src/file2.js"]
};

const result1 = validateTaskSize(validTask);
assert(result1.valid === true, "Valid task should pass");
console.log("✓ Valid task passes");

const invalidTask = {
  id: "T2",
  description: "a".repeat(600), // Too long
  input: Array(12).fill("file.md"), // Too many
  output: Array(12).fill("output.js") // Too many
};

const result2 = validateTaskSize(invalidTask);
assert(result2.valid === false, "Invalid task should fail");
assert(result2.errors.length === 3, "Should have 3 errors");
console.log("✓ Invalid task detected");

// Phase 12: Completion Detection
console.log("\nPhase 12: Completion Detection");

const state = { phase: "execution", status: "running", halt_reason: null };
const allDone = [
  { id: "T1", estado: "done" },
  { id: "T2", estado: "done" }
];

const completed = checkProjectCompletion(allDone, state);
assert(completed === true, "Should detect completion");
assert(state.phase === "completed", "Phase should be completed");
assert(state.status === "completed", "Status should be completed");
console.log("✓ Completion detected");

const state2 = { phase: "execution", status: "running", halt_reason: null };
const notDone = [
  { id: "T1", estado: "done" },
  { id: "T2", estado: "pending" }
];

const notCompleted = checkProjectCompletion(notDone, state2);
assert(notCompleted === false, "Should not detect completion");
assert(state2.phase === "execution", "Phase should remain");
console.log("✓ Non-completion detected");

// Phase 13: Dependency Validation
console.log("\nPhase 13: Dependency Validation");

const validDeps = [
  { id: "T1", depends_on: [] },
  { id: "T2", depends_on: ["T1"] }
];

validateDependencies(validDeps); // Should not throw
console.log("✓ Valid dependencies pass");

const invalidDeps = [
  { id: "T1", depends_on: ["T99"] } // T99 doesn't exist
];

try {
  validateDependencies(invalidDeps);
  assert(false, "Should throw for invalid dependency");
} catch (e) {
  assert(e.message.includes("T99"));
}
console.log("✓ Invalid dependency detected");

const cycleDeps = [
  { id: "T1", depends_on: ["T2"] },
  { id: "T2", depends_on: ["T1"] }
];

try {
  detectCycles(cycleDeps);
  assert(false, "Should throw for cycle");
} catch (e) {
  assert(e.message.includes("cycle"));
}
console.log("✓ Cycle detected");

// Phase 14: R10 No Implicit Tasks
console.log("\nPhase 14: R10 No Implicit Tasks");

const task = {
  id: "T1",
  output: ["src/api/", "src/models/"]
};

const validEvidence = {
  files_changed: ["src/api/users.js", "src/models/user.ts"]
};

validateEvidenceAgainstTask(task, validEvidence); // Should not throw
console.log("✓ Valid evidence passes");

const invalidEvidence = {
  files_changed: ["src/unauthorized/file.js"]
};

try {
  validateEvidenceAgainstTask(task, invalidEvidence);
  assert(false, "Should throw for unauthorized file");
} catch (e) {
  assert(e.message.includes("Unauthorized"));
}
console.log("✓ Unauthorized file change detected");

console.log("\n✅ Phases 11-14 tests passed");
