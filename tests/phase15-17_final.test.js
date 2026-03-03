/**
 * Tests for Phases 15-17:
 * - Phase 15: Crash Recovery (Lock TTL validation)
 * - Phase 16: Deterministic Ordering
 * - Phase 17: R11 Planner Guardrail
 */

const assert = require('assert');
const {
  validateLock,
  acquireLock,
  releaseLock,
  selectBatchForExecution,
  validatePlannerAllowed
} = require('../runner');

console.log('\n========================================');
console.log('Testing Phases 15-17: Final Features');
console.log('========================================\n');

// ============================================================
// PHASE 15: CRASH RECOVERY (Lock TTL)
// ============================================================
console.log('Phase 15: Crash Recovery (Lock TTL)...');

// Test 1: Stale lock detection - lock older than TTL should be cleared
(function testStaleLockDetection() {
  const state = {
    lock: {
      active: true,
      locked_at: new Date(Date.now() - 2000 * 1000).toISOString(), // 2000 seconds ago
      locked_by: 12345,
      ttl_seconds: 1800
    }
  };
  
  validateLock(state);
  
  assert(state.lock.active === false, 'Stale lock should be cleared');
  assert(state.lock.locked_at === null, 'locked_at should be null after clearing');
  assert(state.lock.locked_by === null, 'locked_by should be null after clearing');
  console.log('  ✓ Stale lock (> TTL) is cleared');
})();

// Test 2: Fresh lock should remain active
(function testFreshLockRemains() {
  const state = {
    lock: {
      active: true,
      locked_at: new Date(Date.now() - 100 * 1000).toISOString(), // 100 seconds ago
      locked_by: 12345,
      ttl_seconds: 1800
    }
  };
  
  validateLock(state);
  
  assert(state.lock.active === true, 'Fresh lock should remain active');
  assert(state.lock.locked_at !== null, 'locked_at should not be null for fresh lock');
  console.log('  ✓ Fresh lock (< TTL) remains active');
})();

// Test 3: Inactive lock should remain unchanged
(function testInactiveLockUnchanged() {
  const state = {
    lock: {
      active: false,
      locked_at: null,
      locked_by: null,
      ttl_seconds: 1800
    }
  };
  
  validateLock(state);
  
  assert(state.lock.active === false, 'Inactive lock should stay inactive');
  console.log('  ✓ Inactive lock remains unchanged');
})();

console.log('✓ Phase 15 tests passed\n');

// ============================================================
// PHASE 16: DETERMINISTIC ORDERING
// ============================================================
console.log('Phase 16: Deterministic Ordering...');

// Test 1: Same input produces same output (determinism)
(function testDeterministicOutput() {
  const tasks = [
    { id: "T3", estado: "pending", depends_on: [], priority: 2 },
    { id: "T1", estado: "pending", depends_on: [], priority: 2 },
    { id: "T2", estado: "pending", depends_on: [], priority: 2 }
  ];
  
  const batch1 = selectBatchForExecution(tasks, 3);
  const batch2 = selectBatchForExecution(tasks, 3);
  const batch3 = selectBatchForExecution(tasks, 3);
  
  const ids1 = batch1.map(t => t.id).join(',');
  const ids2 = batch2.map(t => t.id).join(',');
  const ids3 = batch3.map(t => t.id).join(',');
  
  assert(ids1 === ids2, `Run 1 vs 2 non-deterministic: ${ids1} vs ${ids2}`);
  assert(ids2 === ids3, `Run 2 vs 3 non-deterministic: ${ids2} vs ${ids3}`);
  assert(ids1 === "T1,T2,T3", `Expected T1,T2,T3 got ${ids1}`);
  console.log('  ✓ Same input produces same output (deterministic)');
})();

// Test 2: Priority ordering takes precedence over id
(function testPriorityOrdering() {
  const tasks = [
    { id: "A1", estado: "pending", depends_on: [], priority: 3 },
    { id: "B2", estado: "pending", depends_on: [], priority: 1 },
    { id: "C3", estado: "pending", depends_on: [], priority: 2 }
  ];
  
  const batch = selectBatchForExecution(tasks, 3);
  const ids = batch.map(t => t.id).join(',');
  
  assert(ids === "B2,C3,A1", `Priority ordering failed: expected B2,C3,A1 got ${ids}`);
  console.log('  ✓ Priority ordering takes precedence over id');
})();

// Test 3: Id tie-breaker when priorities equal
(function testIdTieBreaker() {
  const tasks = [
    { id: "Z9", estado: "pending", depends_on: [], priority: 1 },
    { id: "A1", estado: "pending", depends_on: [], priority: 1 },
    { id: "M5", estado: "pending", depends_on: [], priority: 1 }
  ];
  
  const batch = selectBatchForExecution(tasks, 3);
  const ids = batch.map(t => t.id).join(',');
  
  assert(ids === "A1,M5,Z9", `Id tie-breaker failed: expected A1,M5,Z9 got ${ids}`);
  console.log('  ✓ Id tie-breaker works when priorities equal');
})();

// Test 4: Deterministic with dependencies
(function testDeterministicWithDependencies() {
  const tasks = [
    { id: "T1", estado: "done", depends_on: [], priority: 1 },
    { id: "T2", estado: "pending", depends_on: ["T1"], priority: 1 },
    { id: "T3", estado: "pending", depends_on: ["T1"], priority: 1 },
    { id: "T4", estado: "pending", depends_on: ["T2"], priority: 1 }
  ];
  
  const batch1 = selectBatchForExecution(tasks, 3);
  const batch2 = selectBatchForExecution(tasks, 3);
  
  const ids1 = batch1.map(t => t.id).join(',');
  const ids2 = batch2.map(t => t.id).join(',');
  
  assert(ids1 === ids2, `Non-deterministic with deps: ${ids1} vs ${ids2}`);
  assert(ids1 === "T2,T3", `Expected T2,T3 (both depend on T1) got ${ids1}`);
  console.log('  ✓ Deterministic with dependencies respected');
})();

console.log('✓ Phase 16 tests passed\n');

// ============================================================
// PHASE 17: R11 PLANNER GUARDRAIL
// ============================================================
console.log('Phase 17: R11 Planner Guardrail...');

// Test 1: Planner allowed when no tasks exist
(function testPlannerAllowedNoTasks() {
  const state = { phase: "planning" };
  
  // Should not throw
  validatePlannerAllowed(state, false);
  console.log('  ✓ Planner allowed when no tasks exist');
})();

// Test 2: Planner allowed in planning phase
(function testPlannerAllowedInPlanning() {
  const state = { phase: "planning" };
  
  // Should not throw even if tasks exist
  validatePlannerAllowed(state, true);
  console.log('  ✓ Planner allowed in planning phase');
})();

// Test 3: Planner blocked in execution phase
(function testPlannerBlockedInExecution() {
  const state = { phase: "execution" };
  
  try {
    validatePlannerAllowed(state, true);
    assert(false, 'Should throw in execution phase');
  } catch (e) {
    assert(e.message.includes("Planner not allowed"), `Wrong error message: ${e.message}`);
    assert(e.message.includes("planning phase"), `Error should mention planning phase: ${e.message}`);
  }
  console.log('  ✓ Planner blocked in execution phase');
})();

// Test 4: Planner blocked in paused phase
(function testPlannerBlockedInPaused() {
  const state = { phase: "paused" };
  
  try {
    validatePlannerAllowed(state, true);
    assert(false, 'Should throw in paused phase');
  } catch (e) {
    assert(e.message.includes("Planner not allowed"), `Wrong error message: ${e.message}`);
  }
  console.log('  ✓ Planner blocked in paused phase');
})();

// Test 5: Planner blocked in needs_review phase
(function testPlannerBlockedInNeedsReview() {
  const state = { phase: "needs_review" };
  
  try {
    validatePlannerAllowed(state, true);
    assert(false, 'Should throw in needs_review phase');
  } catch (e) {
    assert(e.message.includes("Planner not allowed"), `Wrong error message: ${e.message}`);
  }
  console.log('  ✓ Planner blocked in needs_review phase');
})();

// Test 6: Planner blocked in completed phase
(function testPlannerBlockedInCompleted() {
  const state = { phase: "completed" };
  
  try {
    validatePlannerAllowed(state, true);
    assert(false, 'Should throw in completed phase');
  } catch (e) {
    assert(e.message.includes("Planner not allowed"), `Wrong error message: ${e.message}`);
  }
  console.log('  ✓ Planner blocked in completed phase');
})();

// Test 7: Planner allowed after tasks deleted (tasksExists=false)
(function testPlannerAllowedAfterTasksDeleted() {
  const state = { phase: "execution" };
  
  // Should not throw if tasks don't exist
  validatePlannerAllowed(state, false);
  console.log('  ✓ Planner allowed when tasks.yaml deleted');
})();

// Test 8: Error message mentions manual reset
(function testErrorMessageMentionsReset() {
  const state = { phase: "execution" };
  
  try {
    validatePlannerAllowed(state, true);
    assert(false, 'Should throw');
  } catch (e) {
    assert(e.message.includes("Manual reset"), `Error should mention manual reset: ${e.message}`);
    assert(e.message.includes("regenerate"), `Error should mention regenerate: ${e.message}`);
  }
  console.log('  ✓ Error message mentions manual reset requirement');
})();

console.log('✓ Phase 17 tests passed\n');

console.log('========================================');
console.log('All Phases 15-17 tests passed! ✓');
console.log('========================================\n');
