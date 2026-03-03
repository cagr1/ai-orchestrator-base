const assert = require('assert');
const path = require('path');

// Import functions from runner
const runnerPath = path.join(__dirname, '..', 'runner.js');

console.log("Testing Phase 1: State Schema...");

// Test 1: Initialize state creates correct schema
const { initializeState } = require(runnerPath);
const state = initializeState("test goal", { max_iterations: 50 });

// Verify version
assert(state.version === "3.0", "version must be 3.0");
console.log("✓ Version is 3.0");

// Verify lock exists
assert(state.lock !== undefined, "lock must exist");
assert(state.lock.active === false, "lock should start inactive");
assert(state.lock.ttl_seconds === 1800, "lock TTL should be 1800 seconds");
console.log("✓ Lock structure correct");

// Verify execution_control exists
assert(state.execution_control !== undefined, "execution_control must exist");
assert(state.execution_control.tasks_completed === 0, "tasks_completed should start at 0");
assert(state.execution_control.max_tasks_per_run === 5, "max_tasks_per_run should be 5");
assert(state.execution_control.consecutive_failures === 0, "consecutive_failures should start at 0");
console.log("✓ Execution control structure correct");

// Test 2: No forbidden fields
const forbidden = [
  "current_tasks",
  "completed_tasks",
  "failed_tasks",
  "blocked_tasks"
];

forbidden.forEach(field => {
  assert(!(field in state), `Forbidden field found: ${field}`);
});
console.log("✓ No forbidden fields (task duplication prevented)");

// Test 3: Lock functionality
const { acquireLock, releaseLock, validateLock } = require(runnerPath);

// Clear any existing lock
state.lock.active = false;
state.lock.locked_at = null;
state.lock.locked_by = null;

// Acquire lock
acquireLock(state);
assert(state.lock.active === true, "lock should be active after acquire");
assert(state.lock.locked_at !== null, "lock should have timestamp");
assert(state.lock.locked_by !== null, "lock should have owner");
console.log("✓ Lock acquire works");

// Try double lock (should throw)
try {
  acquireLock(state);
  assert(false, "double lock should fail");
} catch (e) {
  assert(e.message.includes("LOCKED"), "should throw lock error: " + e.message);
}
console.log("✓ Double lock prevention works");

// Release lock
releaseLock(state);
assert(state.lock.active === false, "lock should be inactive after release");
assert(state.lock.locked_at === null, "lock timestamp should be cleared");
console.log("✓ Lock release works");

// Test 4: Stale lock detection
acquireLock(state);
const originalLockedAt = state.lock.locked_at;

// Simulate stale lock (set locked_at to 2 hours ago)
const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
state.lock.locked_at = twoHoursAgo;

// Validate should clear stale lock
validateLock(state);
assert(state.lock.active === false, "stale lock should be cleared");
console.log("✓ Stale lock detection works");

console.log("\n✅ Phase 1 tests passed");
